"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import type { FinancialEntryRecord, FinancialEntryType } from "@/modules/financeiro/types";
import {
    availableSubcategoryGroups,
    emptyForm,
    entryToForm,
    parseAmount,
    type FinancialFormState,
} from "./financial-utils";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    editingEntry?: FinancialEntryRecord | null;
};

function formatAmountInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";

    const cents = parseInt(digits, 10);
    return (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function todayDateString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function FinancialTransactionModal({ isOpen, onClose, editingEntry }: Props) {
    const { data, saveEntry, deleteEntry } = useFinancialData();
    const [form, setForm] = useState<FinancialFormState>(emptyForm("RECEIVABLE"));
    const [selectedSectionCode, setSelectedSectionCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const sections = data?.dreStructure.sections ?? [];

    const subcategoryGroups = useMemo(
        () => availableSubcategoryGroups(sections, form.type),
        [sections, form.type]
    );

    const selectedGroup = useMemo(
        () => subcategoryGroups.find((group) => group.code === selectedSectionCode) ?? subcategoryGroups[0] ?? null,
        [selectedSectionCode, subcategoryGroups]
    );

    const availableSubcategories = selectedGroup?.subcategories ?? [];

    const buildEmptyForm = (type: FinancialEntryType) => {
        const groups = availableSubcategoryGroups(sections, type);
        const firstGroup = groups[0];
        const firstSubcategoryId = firstGroup?.subcategories[0]?.id ?? "";
        const nextForm = emptyForm(type, firstSubcategoryId);
        nextForm.dueDate = todayDateString();
        nextForm.settled = true;
        return {
            nextForm,
            nextSectionCode: firstGroup?.code ?? "",
        };
    };

    useEffect(() => {
        if (!isOpen) return;

        if (editingEntry && editingEntry.source === "MANUAL") {
            const nextForm = entryToForm(editingEntry);
            nextForm.settled = true;
            nextForm.dueDate = nextForm.dueDate || todayDateString();
            setForm(nextForm);
            setSelectedSectionCode(editingEntry.dreSectionCode);
            setSaveError(null);
            return;
        }

        const { nextForm, nextSectionCode } = buildEmptyForm("RECEIVABLE");
        setForm(nextForm);
        setSelectedSectionCode(nextSectionCode);
        setSaveError(null);
    }, [editingEntry, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (!selectedGroup) {
            setSelectedSectionCode(subcategoryGroups[0]?.code ?? "");
            return;
        }

        if (!availableSubcategories.some((subcategory) => subcategory.id === form.dreSubcategoryId)) {
            setForm((current) => ({
                ...current,
                dreSubcategoryId: availableSubcategories[0]?.id ?? "",
            }));
        }
    }, [availableSubcategories, form.dreSubcategoryId, isOpen, selectedGroup, subcategoryGroups]);

    if (!isOpen) return null;

    function handleTypeChange(nextType: FinancialEntryType) {
        const groups = availableSubcategoryGroups(sections, nextType);
        const nextSection =
            groups.find((group) => group.code === selectedSectionCode) ??
            groups.find((group) => group.subcategories.some((subcategory) => subcategory.id === form.dreSubcategoryId)) ??
            groups[0];

        setForm((current) => ({
            ...current,
            type: nextType,
            dreSubcategoryId: nextSection?.subcategories[0]?.id ?? "",
        }));
        setSelectedSectionCode(nextSection?.code ?? "");
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
            setSaveError(null);

        try {
            setSaving(true);

            if (!form.dreSubcategoryId) {
                throw new Error("Selecione uma subcategoria para a transação.");
            }

            const amountCents = parseAmount(form.amount);
            if (!amountCents) {
                throw new Error("Informe um valor válido maior que zero.");
            }

            await saveEntry(form.id, {
                description: form.description.trim(),
                type: form.type,
                dreSubcategoryId: form.dreSubcategoryId,
                amountCents,
                dueDate: form.dueDate || todayDateString(),
                counterparty: null,
                notes: null,
                settled: true,
            });

            onClose();
        } catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar a transação.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!form.id) return;
        if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

        setSaveError(null);

        try {
            setDeleting(true);
            await deleteEntry(form.id);
            onClose();
        } catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : "Não foi possível excluir a transação.");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-xl rounded-[32px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
                <div className="border-b border-black/8 px-6 py-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-6 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-black/35 transition hover:bg-black/[0.06] hover:text-black/65"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <h2 className="pr-14 font-display text-2xl font-bold uppercase tracking-[-0.02em] text-io-dark">
                        {form.id ? "Editar Transação" : "Nova Transação"}
                    </h2>
                </div>

                <form className="grid gap-5 px-6 py-6" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4">
                        {([
                            { type: "RECEIVABLE" as const, label: "Entrada" },
                            { type: "PAYABLE" as const, label: "Saída" },
                        ]).map((option) => {
                            const isActive = form.type === option.type;
                            const activeTone =
                                option.type === "RECEIVABLE"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-rose-300 bg-rose-50 text-rose-700";
                            return (
                                <button
                                    key={option.type}
                                    type="button"
                                    onClick={() => handleTypeChange(option.type)}
                                    className={`rounded-2xl border px-4 py-3 text-base font-semibold transition ${
                                        isActive
                                            ? activeTone
                                            : "border-black/10 bg-white text-black/45 hover:border-black/20 hover:text-black/70"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Descrição *</span>
                        <input
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder="Ex: Venda Carro X"
                            className="h-14 rounded-2xl border border-black/10 bg-[#fafafa] px-4 text-sm text-io-dark outline-none transition placeholder:text-black/30 focus:border-black/20"
                            required
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid min-w-0 gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Valor *</span>
                            <div className="flex h-14 items-center rounded-2xl border border-black/10 bg-[#fafafa] px-4 focus-within:border-black/20">
                                <span className="mr-2 text-sm font-semibold text-black/45">R$</span>
                                <input
                                    type="text"
                                    value={form.amount}
                                    onChange={(event) => setForm((current) => ({ ...current, amount: formatAmountInput(event.target.value) }))}
                                    placeholder="0,00"
                                    className="w-full min-w-0 bg-transparent text-sm text-io-dark outline-none placeholder:text-black/30"
                                    required
                                />
                            </div>
                        </label>

                        <label className="grid min-w-0 gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Data *</span>
                            <div className="flex h-14 items-center rounded-2xl border border-black/10 bg-[#fafafa] px-4 focus-within:border-black/20">
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                                    className="w-full min-w-0 bg-transparent text-sm text-io-dark outline-none"
                                    required
                                />
                                <CalendarDays className="h-4 w-4 shrink-0 text-black/42" />
                            </div>
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid min-w-0 gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Categoria *</span>
                            <select
                                value={selectedSectionCode}
                                onChange={(event) => {
                                    const nextSectionCode = event.target.value;
                                    const nextGroup = subcategoryGroups.find((group) => group.code === nextSectionCode);
                                    setSelectedSectionCode(nextSectionCode);
                                    setForm((current) => ({
                                        ...current,
                                        dreSubcategoryId: nextGroup?.subcategories[0]?.id ?? "",
                                    }));
                                }}
                                className="h-14 w-full min-w-0 rounded-2xl border border-black/10 bg-[#fafafa] px-4 text-sm text-io-dark outline-none transition focus:border-black/20"
                                required
                            >
                                {!subcategoryGroups.length ? <option value="">Selecione...</option> : null}
                                {subcategoryGroups.map((group) => (
                                    <option key={group.code} value={group.code}>
                                        {group.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="grid min-w-0 gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Subcategoria *</span>
                            <select
                                value={form.dreSubcategoryId}
                                onChange={(event) => setForm((current) => ({ ...current, dreSubcategoryId: event.target.value }))}
                                className="h-14 w-full min-w-0 rounded-2xl border border-black/10 bg-[#fafafa] px-4 text-sm text-io-dark outline-none transition focus:border-black/20"
                                required
                            >
                                {!availableSubcategories.length ? <option value="">Selecione...</option> : null}
                                {availableSubcategories.map((subcategory) => (
                                    <option key={subcategory.id} value={subcategory.id}>
                                        {subcategory.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {!subcategoryGroups.length ? (
                        <p className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            Cadastre ao menos uma categoria/subcategoria desta direção no DRE para criar transações.
                        </p>
                    ) : null}

                    {saveError ? (
                        <p className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {saveError}
                        </p>
                    ) : null}

                    {form.id ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={saving || deleting}
                            className="text-sm font-bold text-red-600 transition hover:text-red-700 disabled:opacity-50"
                        >
                            {deleting ? "Excluindo..." : "Excluir transação"}
                        </button>
                    ) : null}

                    <button
                        type="submit"
                        disabled={saving || deleting || !availableSubcategories.length}
                        className="mt-1 h-14 rounded-2xl bg-black px-6 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#111] disabled:cursor-wait disabled:opacity-70"
                    >
                        {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Salvar transação"}
                    </button>
                </form>
            </div>
        </div>
    );
}
