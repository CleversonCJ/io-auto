"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign, X } from "lucide-react";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import type { FinancialEntryType, FinancialEntryCategory, FinancialEntryRecord } from "@/modules/financeiro/types";
import {
    type FinancialFormState,
    emptyForm,
    categoryOptions,
    parseAmount,
    entryToForm,
    addMonthsToDate,
} from "./financial-utils";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    mode: "contas" | "movimentacao";
    initialType?: FinancialEntryType;
    editingEntry?: FinancialEntryRecord | null;
};

export function FinancialEntryModal({ isOpen, onClose, mode, initialType = "RECEIVABLE", editingEntry }: Props) {
    const { saveEntry, deleteEntry } = useFinancialData();
    const [form, setForm] = useState<FinancialFormState>(emptyForm(initialType));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        if (editingEntry && editingEntry.source === "MANUAL") {
            setForm(entryToForm(editingEntry));
            setSaveError(null);
            setSaveSuccess(null);
        } else {
            setForm(emptyForm(initialType));
        }
    }, [isOpen, editingEntry, initialType]);

    useEffect(() => {
        if (mode === "movimentacao") {
            setForm((current) => ({
                ...current,
                category: current.type === "RECEIVABLE" ? "OTHER_REVENUE" : "OTHER_EXPENSE",
                settled: true,
            }));
        } else {
            const options = categoryOptions(form.type);
            if (!options.some((option) => option.value === form.category)) {
                setForm((current) => ({ ...current, category: options[0].value }));
            }
        }
    }, [form.type, form.category, mode]);

    if (!isOpen) return null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaveError(null);
        setSaveSuccess(null);

        try {
            setSaving(true);

            if (form.isInstallment && !form.id) {
                const count = parseInt(form.installmentsCount, 10);
                const instAmountCents = parseAmount(form.installmentAmount);
                if (!instAmountCents || isNaN(count) || count < 2 || !form.firstInstallmentDate) {
                    throw new Error("Preencha todos os campos do parcelamento corretamente.");
                }

                for (let i = 0; i < count; i++) {
                    const nextDate = addMonthsToDate(form.firstInstallmentDate, i);
                    await saveEntry(null, {
                        description: `${form.description.trim()} (Parcela ${i + 1}/${count})`,
                        type: form.type,
                        category: form.category,
                        amountCents: instAmountCents,
                        dueDate: nextDate,
                        counterparty: mode === "contas" ? (form.counterparty.trim() || null) : null,
                        notes: mode === "contas" ? (form.notes.trim() || null) : null,
                        settled: form.settled,
                    });
                }
            } else {
                const amountCents = parseAmount(form.amount);
                if (!amountCents) throw new Error("Informe um valor válido maior que zero.");

                await saveEntry(form.id, {
                    description: form.description.trim(),
                    type: form.type,
                    category: form.category,
                    amountCents,
                    dueDate: form.dueDate || null,
                    counterparty: mode === "contas" ? (form.counterparty.trim() || null) : null,
                    notes: mode === "contas" ? (form.notes.trim() || null) : null,
                    settled: form.settled,
                });
            }

            setForm(emptyForm(initialType));
            setSaveSuccess(form.id ? "Lançamento atualizado com sucesso." : "Lançamento criado com sucesso.");
            setTimeout(() => {
                onClose();
                setSaveSuccess(null);
            }, 1000);
        } catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar o lançamento.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!form.id) return;
        if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
        
        setSaveError(null);
        try {
            setDeleting(true);
            await deleteEntry(form.id);
            setSaveSuccess("Lançamento excluído com sucesso.");
            setTimeout(() => {
                onClose();
                setSaveSuccess(null);
            }, 1000);
        } catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : "Não foi possível excluir o lançamento.");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-black/60 transition hover:bg-black/[0.06] hover:text-black"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-io-purple text-white shrink-0">
                        <BadgeDollarSign className="h-5 w-5" />
                    </span>
                    <div className="pr-12">
                        <h2 className="font-display text-2xl font-bold text-io-dark">
                            {form.id ? "Editar" : "Novo"} {mode === "movimentacao" ? "Lançamento de Caixa" : "Lançamento de Conta"}
                        </h2>
                        <p className="text-sm text-black/55">
                            {mode === "movimentacao" ? "Registre uma movimentação real de fluxo de caixa." : "Cadastre uma conta a pagar ou a receber."}
                        </p>
                    </div>
                </div>

                <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2 text-sm font-medium text-black/65">
                            <span>Tipo {mode === "movimentacao" ? "(Entrada/Saída)" : ""}</span>
                            <select
                                value={form.type}
                                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinancialEntryType }))}
                                className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                            >
                                {mode === "movimentacao" ? (
                                    <>
                                        <option value="RECEIVABLE">Entrada</option>
                                        <option value="PAYABLE">Saída</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="RECEIVABLE">Conta a receber</option>
                                        <option value="PAYABLE">Conta a pagar</option>
                                    </>
                                )}
                            </select>
                        </label>

                        {mode === "contas" && (
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Categoria</span>
                                <select
                                    value={form.category}
                                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as FinancialEntryCategory }))}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                >
                                    {categoryOptions(form.type).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {mode === "movimentacao" && (
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Data do lançamento</span>
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    required
                                />
                            </label>
                        )}
                    </div>

                    <label className="grid gap-2 text-sm font-medium text-black/65">
                        <span>{mode === "movimentacao" ? "Título" : "Descrição"}</span>
                        <input
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder={mode === "movimentacao" ? "Ex.: Conta de luz, Venda à vista..." : "Ex.: pagamento de fornecedor ou serviço"}
                            className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                            required
                        />
                    </label>

                    {!form.id && mode === "contas" && (
                        <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-black/65 cursor-pointer hover:bg-black/[0.05] transition">
                            <input
                                type="checkbox"
                                checked={form.isInstallment}
                                onChange={(event) => setForm((current) => ({ ...current, isInstallment: event.target.checked }))}
                                className="h-4 w-4"
                            />
                            <span>Gerar conta parcelada (várias parcelas)?</span>
                        </label>
                    )}

                    {form.isInstallment && !form.id && mode === "contas" ? (
                        <div className="grid gap-4 md:grid-cols-3 bg-io-purple/[0.03] p-4 rounded-2xl border border-io-purple/10">
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Qtd. de parcelas</span>
                                <input
                                    type="number"
                                    min="2"
                                    value={form.installmentsCount}
                                    onChange={(event) => setForm((current) => ({ ...current, installmentsCount: event.target.value }))}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    required
                                />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Valor da parcela</span>
                                <input
                                    type="text"
                                    value={form.installmentAmount}
                                    onChange={(event) => {
                                        let rawValue = event.target.value.replace(/\D/g, "");
                                        if (!rawValue) return setForm((current) => ({ ...current, installmentAmount: "" }));
                                        const cents = parseInt(rawValue, 10);
                                        const formatted = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        setForm((current) => ({ ...current, installmentAmount: formatted }));
                                    }}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    required
                                />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>1º Vencimento</span>
                                <input
                                    type="date"
                                    value={form.firstInstallmentDate}
                                    onChange={(event) => setForm((current) => ({ ...current, firstInstallmentDate: event.target.value }))}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    required
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Valor (R$)</span>
                                <input
                                    type="text"
                                    value={form.amount}
                                    onChange={(event) => {
                                        let rawValue = event.target.value.replace(/\D/g, "");
                                        if (!rawValue) {
                                            setForm((current) => ({ ...current, amount: "" }));
                                            return;
                                        }
                                        const cents = parseInt(rawValue, 10);
                                        const formatted = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        setForm((current) => ({ ...current, amount: formatted }));
                                    }}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    required
                                />
                            </label>

                            {mode === "contas" && (
                                <label className="grid gap-2 text-sm font-medium text-black/65">
                                    <span>Vencimento</span>
                                    <input
                                        type="date"
                                        value={form.dueDate}
                                        onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                                        className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                    />
                                </label>
                            )}
                        </div>
                    )}

                    {mode === "contas" && (
                        <>
                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Cliente / fornecedor</span>
                                <input
                                    value={form.counterparty}
                                    onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))}
                                    placeholder="Nome da contraparte"
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-medium text-black/65">
                                <span>Observações</span>
                                <textarea
                                    value={form.notes}
                                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    rows={3}
                                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                                />
                            </label>

                            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/65 cursor-pointer hover:bg-black/[0.05] transition">
                                <input
                                    type="checkbox"
                                    checked={form.settled}
                                    onChange={(event) => setForm((current) => ({ ...current, settled: event.target.checked }))}
                                    className="h-4 w-4"
                                />
                                <span>Marcar como liquidado no momento do cadastro</span>
                            </label>
                        </>
                    )}

                    {saveError ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p> : null}
                    {saveSuccess ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveSuccess}</p> : null}

                    <div className="flex flex-wrap items-center justify-end gap-3 mt-4 pt-4 border-t border-black/10">
                        {form.id && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving || deleting}
                                className="mr-auto rounded-full bg-red-50 px-6 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                                {deleting ? "Excluindo..." : "Excluir"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving || deleting}
                            className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-black/65 transition hover:border-black/20 hover:text-black"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || deleting}
                            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111] disabled:cursor-wait disabled:opacity-70"
                        >
                            {saving ? "Salvando..." : form.id ? "Atualizar" : "Salvar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
