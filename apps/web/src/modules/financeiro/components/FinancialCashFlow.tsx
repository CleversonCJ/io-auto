"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PencilLine, Plus, Search } from "lucide-react";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import { entryPrimaryLabel, entrySecondaryLabel, formatDate, sortEntries, statusLabel, statusTone } from "./financial-utils";
import { FinancialTransactionModal } from "./FinancialTransactionModal";
import type { FinancialEntryRecord } from "@/modules/financeiro/types";

export function FinancialCashFlow() {
    const { data, loading, error } = useFinancialData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<FinancialEntryRecord | null>(null);

    const [typeFilter, setTypeFilter] = useState<"ALL" | "RECEIVABLE" | "PAYABLE">("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredEntries = useMemo(() => {
        let entries = (data?.entries ?? []).filter((entry) => entry.status === "SETTLED" || Boolean(entry.settledAt));

        if (typeFilter !== "ALL") {
            entries = entries.filter((entry) => entry.type === typeFilter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            entries = entries.filter((entry) => {
                return (
                    entry.description.toLowerCase().includes(query) ||
                    entryPrimaryLabel(entry).toLowerCase().includes(query) ||
                    entrySecondaryLabel(entry).toLowerCase().includes(query) ||
                    (entry.counterparty && entry.counterparty.toLowerCase().includes(query)) ||
                    (entry.notes && entry.notes.toLowerCase().includes(query))
                );
            });
        }

        if (startDate || endDate) {
            entries = entries.filter((entry) => {
                const targetDate = entry.dueDate || (entry.createdAt ? entry.createdAt.substring(0, 10) : null);
                if (!targetDate) return true;
                if (startDate && targetDate < startDate) return false;
                if (endDate && targetDate > endDate) return false;
                return true;
            });
        }

        return sortEntries(entries);
    }, [data?.entries, endDate, searchQuery, startDate, typeFilter]);

    const summary = useMemo(() => {
        let entradas = 0;
        let saidas = 0;

        for (const entry of filteredEntries) {
            if (entry.type === "RECEIVABLE") entradas += entry.amountCents;
            if (entry.type === "PAYABLE") saidas += entry.amountCents;
        }

        return {
            entradas,
            saidas,
            saldo: entradas - saidas,
        };
    }, [filteredEntries]);

    if (loading) {
        return <div className="text-sm text-black/55">Carregando fluxo de caixa...</div>;
    }

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <div className="grid gap-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-2xl border border-black/10 bg-black/5 p-1">
                        {(["ALL", "RECEIVABLE", "PAYABLE"] as const).map((type) => {
                            const labels = { ALL: "Todas", RECEIVABLE: "Entradas", PAYABLE: "Saídas" };
                            const isActive = typeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-io-purple text-white shadow-sm" : "text-black/60 hover:text-black"}`}
                                >
                                    {labels[type]}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2">
                        <span className="text-sm font-medium text-black/50">Período:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="cursor-pointer bg-transparent text-sm text-io-dark outline-none"
                        />
                        <span className="text-black/30">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="cursor-pointer bg-transparent text-sm text-io-dark outline-none"
                        />
                    </div>

                    <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2">
                        <Search className="h-4 w-4 shrink-0 text-black/40" />
                        <input
                            type="text"
                            placeholder="Buscar por descrição, subcategoria, seção ou contraparte"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/40"
                        />
                    </div>

                    {(typeFilter !== "ALL" || startDate || endDate || searchQuery) ? (
                        <button
                            onClick={() => {
                                setTypeFilter("ALL");
                                setStartDate("");
                                setEndDate("");
                                setSearchQuery("");
                            }}
                            className="ml-1 shrink-0 text-xs font-semibold text-red-600 underline transition hover:text-red-700"
                        >
                            Limpar filtros
                        </button>
                    ) : null}
                </div>

                <button
                    onClick={() => {
                        setEditingEntry(null);
                        setIsModalOpen(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111]"
                >
                    <Plus className="h-4 w-4" />
                    <span>Nova transação</span>
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-black/10 bg-[#fbfbfb] p-5 shadow-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">Entradas</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatMoney(summary.entradas)}</p>
                </div>
                <div className="rounded-[24px] border border-black/10 bg-[#fbfbfb] p-5 shadow-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-black/50">Saídas</p>
                    <p className="text-2xl font-bold text-rose-600">{formatMoney(summary.saidas)}</p>
                </div>
                <div className="rounded-[24px] border border-black/10 bg-black p-5 text-white shadow-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50">Saldo</p>
                    <p className="text-2xl font-bold">{formatMoney(summary.saldo)}</p>
                </div>
            </div>

            <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="grid gap-3">
                    {!filteredEntries.length ? (
                        <div className="rounded-[24px] border border-dashed border-black/10 px-5 py-10 text-center text-sm text-black/45">
                            Nenhuma movimentação registrada neste período.
                        </div>
                    ) : (
                        filteredEntries.map((entry) => {
                            const isReceivable = entry.type === "RECEIVABLE";

                            return (
                                <div key={`${entry.source}-${entry.id}`} className="rounded-[24px] border border-black/10 bg-[#fbfbfb] px-5 py-4 transition hover:bg-[#f5f5f5]">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isReceivable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                                    {isReceivable ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                </span>
                                                <p className="text-sm font-semibold text-io-dark">{entry.description}</p>
                                                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(entry.status)}`}>
                                                    {statusLabel(entry.status)}
                                                </span>
                                                <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-semibold text-black/55">
                                                    {entryPrimaryLabel(entry)}
                                                </span>
                                                <span className="rounded-full bg-black/[0.03] px-3 py-1 text-[11px] font-semibold text-black/45">
                                                    {entrySecondaryLabel(entry)}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-black/50">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                    <span>Data: {formatDate(entry.dueDate)}</span>
                                                </span>
                                                {entry.counterparty ? <span>Contraparte: {entry.counterparty}</span> : null}
                                                <span>Atualizado: {formatDateTime(entry.updatedAt)}</span>
                                            </div>

                                            {entry.notes ? <p className="mt-3 text-sm text-black/55">{entry.notes}</p> : null}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <p className={`text-lg font-bold ${isReceivable ? "text-emerald-600" : "text-rose-600"}`}>
                                                {isReceivable ? "+" : "-"}{formatMoney(entry.amountCents)}
                                            </p>
                                            {entry.source === "MANUAL" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingEntry(entry);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/60 transition hover:border-black/20 hover:text-black"
                                                    aria-label={`Editar ${entry.description}`}
                                                    title="Editar lançamento"
                                                >
                                                    <PencilLine className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <FinancialTransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    editingEntry={editingEntry}
                />
            </article>
        </div>
    );
}
