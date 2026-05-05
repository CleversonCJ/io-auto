"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Plus, Search } from "lucide-react";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import { sortEntries, statusTone, statusLabel, categoryLabel, formatDate } from "./financial-utils";
import { FinancialEntryModal } from "./FinancialEntryModal";
import type { FinancialEntryRecord } from "@/modules/financeiro/types";

export function FinancialCashFlow() {
    const { data, loading, error } = useFinancialData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<FinancialEntryRecord | null>(null);

    // Filters
    const [typeFilter, setTypeFilter] = useState<"ALL" | "RECEIVABLE" | "PAYABLE">("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredEntries = useMemo(() => {
        let entries = data?.entries ?? [];

        // Filter by Type
        if (typeFilter !== "ALL") {
            entries = entries.filter((e) => e.type === typeFilter);
        }

        // Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            entries = entries.filter((e) => {
                return (
                    e.description.toLowerCase().includes(query) ||
                    (e.counterparty && e.counterparty.toLowerCase().includes(query)) ||
                    categoryLabel(e.category).toLowerCase().includes(query) ||
                    (e.notes && e.notes.toLowerCase().includes(query))
                );
            });
        }

        // Filter by Period (using dueDate, fallback to createdAt)
        if (startDate || endDate) {
            entries = entries.filter((e) => {
                const targetDate = e.dueDate || (e.createdAt ? e.createdAt.substring(0, 10) : null);
                if (!targetDate) return true; // If no date, include it or exclude it? Let's include if date is unknown.

                if (startDate && targetDate < startDate) return false;
                if (endDate && targetDate > endDate) return false;

                return true;
            });
        }

        return sortEntries(entries);
    }, [data?.entries, typeFilter, searchQuery, startDate, endDate]);

    const summary = useMemo(() => {
        let entradas = 0;
        let saidas = 0;

        for (const entry of filteredEntries) {
            if (entry.type === "RECEIVABLE") {
                entradas += entry.amountCents;
            } else if (entry.type === "PAYABLE") {
                saidas += entry.amountCents;
            }
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

            {/* Top Bar matching requested layout */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Toggle Type */}
                    <div className="flex items-center rounded-2xl bg-black/5 p-1 border border-black/10">
                        {(["ALL", "RECEIVABLE", "PAYABLE"] as const).map((type) => {
                            const labels = { ALL: "Todas", RECEIVABLE: "Entradas", PAYABLE: "Saídas" };
                            const isActive = typeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${isActive ? "bg-io-purple text-white shadow-sm" : "text-black/60 hover:text-black"
                                        }`}
                                >
                                    {labels[type]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Date Period */}
                    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2">
                        <span className="text-sm text-black/50 font-medium">Período:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-sm text-io-dark outline-none cursor-pointer"
                        />
                        <span className="text-black/30">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-sm text-io-dark outline-none cursor-pointer"
                        />
                    </div>

                    {/* Search Bar */}
                    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 flex-1 min-w-[280px]">
                        <Search className="h-4 w-4 text-black/40 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar por descrição, categoria, banco ou tag"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-sm text-io-dark outline-none w-full placeholder:text-black/40"
                        />
                    </div>

                    {(typeFilter !== "ALL" || startDate || endDate || searchQuery) && (
                        <button
                            onClick={() => {
                                setTypeFilter("ALL");
                                setStartDate("");
                                setEndDate("");
                                setSearchQuery("");
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 underline transition shrink-0 ml-1"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>

                <button
                    onClick={() => {
                        setEditingEntry(null);
                        setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111] shrink-0"
                >
                    <Plus className="h-4 w-4" />
                    <span>Criar uma movimentação</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-black/10 bg-[#fbfbfb] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-black/50 mb-1">Entradas</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatMoney(summary.entradas)}</p>
                </div>
                <div className="rounded-[24px] border border-black/10 bg-[#fbfbfb] p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-black/50 mb-1">Saídas</p>
                    <p className="text-2xl font-bold text-rose-600">{formatMoney(summary.saidas)}</p>
                </div>
                <div className="rounded-[24px] border border-black/10 bg-black p-5 shadow-sm text-white">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Saldo</p>
                    <p className="text-2xl font-bold">{formatMoney(summary.saldo)}</p>
                </div>
            </div>

            {/* List */}
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
                                                    {categoryLabel(entry.category)}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-black/50">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                    <span>Data: {formatDate(entry.dueDate)}</span>
                                                </span>
                                                {entry.counterparty && <span>Contraparte: {entry.counterparty}</span>}
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
                                                    className="text-xs font-semibold text-black/40 hover:text-black/80 transition"
                                                >
                                                    Editar
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <FinancialEntryModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    mode="contas"
                    editingEntry={editingEntry}
                />
            </article>
        </div>
    );
}
