"use client";

import { ReactNode } from "react";
import { CalendarClock, PencilLine } from "lucide-react";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import type { FinancialEntryRecord } from "@/modules/financeiro/types";
import { statusTone, statusLabel, categoryLabel, formatDate } from "./financial-utils";

type Props = {
    title: string;
    subtitle: string;
    icon: ReactNode;
    total: string;
    secondary: string;
    entries: FinancialEntryRecord[];
    loading: boolean;
    onEdit: (entry: FinancialEntryRecord) => void;
};

export function FinancialAccountPanel({
    title,
    subtitle,
    icon,
    total,
    secondary,
    entries,
    loading,
    onEdit,
}: Props) {
    return (
        <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shrink-0">{icon}</span>
                    <div>
                        <h2 className="font-display text-2xl font-bold text-io-dark">{title}</h2>
                        <p className="text-sm text-black/55">{subtitle}</p>
                    </div>
                </div>

                <div className="text-left md:text-right">
                    <p className="text-xs uppercase tracking-[0.22em] text-black/35">Total em aberto</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{total}</p>
                    <p className="mt-1 text-xs text-black/45">{secondary}</p>
                </div>
            </div>

            <div className="mt-6 grid gap-3">
                {loading ? (
                    <div className="rounded-[24px] border border-dashed border-black/10 px-5 py-10 text-center text-sm text-black/45">
                        Carregando lançamentos...
                    </div>
                ) : entries.length ? (
                    entries.map((entry) => (
                        <div key={`${entry.source}-${entry.id}`} className="rounded-[24px] border border-black/10 bg-[#fbfbfb] px-5 py-4 transition hover:bg-[#f5f5f5]">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-io-dark">{entry.description}</p>
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(entry.status)}`}>
                                            {statusLabel(entry.status)}
                                        </span>
                                        <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-semibold text-black/55">
                                            {categoryLabel(entry.category)}
                                        </span>
                                        {entry.source === "VEHICLE_SALE" ? (
                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                                Venda do estoque
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-black/50">
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarClock className="h-3.5 w-3.5" />
                                            <span>Vencimento: {formatDate(entry.dueDate)}</span>
                                        </span>
                                        <span>Contraparte: {entry.counterparty ?? "-"}</span>
                                        <span>Atualizado: {formatDateTime(entry.updatedAt)}</span>
                                    </div>

                                    {entry.notes ? <p className="mt-3 text-sm text-black/55">{entry.notes}</p> : null}
                                </div>

                                <div className="flex items-center gap-3">
                                    <p className="text-lg font-bold text-io-dark">{formatMoney(entry.amountCents)}</p>
                                    {entry.source === "MANUAL" ? (
                                        <button
                                            type="button"
                                            onClick={() => onEdit(entry)}
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
                    ))
                ) : (
                    <div className="rounded-[24px] border border-dashed border-black/10 px-5 py-10 text-center text-sm text-black/45">
                        Nenhum lançamento encontrado.
                    </div>
                )}
            </div>
        </article>
    );
}
