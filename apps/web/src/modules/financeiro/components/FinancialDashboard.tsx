"use client";

import { useMemo } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, DollarSign, Target, CalendarDays, CarFront } from "lucide-react";
import { formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import { FinancialFilterBar } from "./FinancialFilterBar";

export function FinancialDashboard() {
    const { data, loading, error, filters } = useFinancialData();

    const financialMetrics = useMemo(() => {
        const revenueCents = data?.dre.vehicleSalesRevenueCents ?? 0;
        const salesCount = data?.entries.filter((entry) => entry.type === "RECEIVABLE" && entry.source === "VEHICLE_SALE").length ?? 0;
        const inventoryCents = data?.inventoryValueCents ?? 0;
        const avgTicket = salesCount > 0 ? revenueCents / salesCount : 0;

        let monthsInPeriod = 12;
        if (filters.month) {
            monthsInPeriod = 1;
        } else if (filters.year) {
            monthsInPeriod = 12;
        } else if (data?.entries && data.entries.length > 0) {
            const firstDate = new Date(data.entries[data.entries.length - 1]?.createdAt || new Date());
            const today = new Date();
            const diffMonths = (today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth());
            monthsInPeriod = Math.max(1, diffMonths);
        }

        const monthlyAvg = monthsInPeriod > 0 ? revenueCents / monthsInPeriod : 0;

        return {
            salesCount,
            revenueCents,
            avgTicket,
            monthlyAvg,
            inventoryCents,
        };
    }, [data, filters]);

    if (loading) {
        return <div className="text-sm text-black/55">Carregando dashboard...</div>;
    }

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <div className="grid gap-6">
            <FinancialFilterBar />
            <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <h2 className="font-display text-2xl font-bold text-io-dark">Visão Geral</h2>
                    <p className="mt-2 text-sm text-black/55">
                        Resumo do fluxo de caixa com base nos lançamentos previstos.
                    </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        title="Entradas previstas"
                        value={formatMoney(data?.cashFlow.entryCents ?? null)}
                        description="Baseado em contas a receber em aberto"
                        icon={<ArrowUpCircle className="h-5 w-5" />}
                        tone="emerald"
                    />
                    <SummaryCard
                        title="Saídas previstas"
                        value={formatMoney(data?.cashFlow.exitCents ?? null)}
                        description="Baseado em contas a pagar em aberto"
                        icon={<ArrowDownCircle className="h-5 w-5" />}
                        tone="rose"
                    />
                    <SummaryCard
                        title="Saldo projetado"
                        value={formatMoney(data?.cashFlow.balanceCents ?? null)}
                        description="Entradas menos saídas"
                        icon={<Wallet className="h-5 w-5" />}
                        tone="dark"
                    />
                </div>
            </section>

            <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <h2 className="font-display text-2xl font-bold text-io-dark">Desempenho Estratégico</h2>
                    <p className="mt-2 text-sm text-black/55">
                        Métricas de faturamento, vendas e valor total investido no estoque atual.
                    </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-5">
                    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><TrendingUp className="h-5 w-5" /></span>
                            <span className="text-3xl font-bold text-io-dark">{financialMetrics.salesCount}</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-black/80">Total de Vendas</p>
                        <p className="text-xs text-black/55">No período filtrado</p>
                    </article>
                    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700"><DollarSign className="h-5 w-5" /></span>
                            <span className="text-2xl font-bold text-io-dark">{formatMoney(financialMetrics.revenueCents)}</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-black/80">Receita Total</p>
                        <p className="text-xs text-black/55">Faturamento bruto</p>
                    </article>
                    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-orange-700"><Target className="h-5 w-5" /></span>
                            <span className="text-2xl font-bold text-io-dark">{formatMoney(financialMetrics.avgTicket)}</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-black/80">Ticket Médio</p>
                        <p className="text-xs text-black/55">Por veículo vendido</p>
                    </article>
                    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-100 text-purple-700"><CalendarDays className="h-5 w-5" /></span>
                            <span className="text-2xl font-bold text-io-dark">{formatMoney(financialMetrics.monthlyAvg)}</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-black/80">Média Mensal</p>
                        <p className="text-xs text-black/55">Faturamento do período</p>
                    </article>
                    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white"><CarFront className="h-5 w-5" /></span>
                            <span className="text-2xl font-bold text-io-dark">{formatMoney(financialMetrics.inventoryCents)}</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-black/80">Patrimônio</p>
                        <p className="text-xs text-black/55">Valor em estoque ativo</p>
                    </article>
                </div>
            </section>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    description,
    icon,
    tone,
}: {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
    tone: "emerald" | "rose" | "dark";
}) {
    const isDark = tone === "dark";

    const iconPalette = {
        emerald: "bg-emerald-100 text-emerald-700",
        rose: "bg-rose-100 text-rose-700",
        dark: "bg-white/10 text-white",
    }[tone];

    const cardPalette = isDark
        ? "border-black bg-black text-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
        : "border-black/10 bg-white text-io-dark shadow-[0_18px_45px_rgba(0,0,0,0.06)]";

    const descriptionTone = isDark ? "text-white/60" : "text-black/55";

    return (
        <div className={`rounded-[28px] border px-5 py-5 ${cardPalette}`}>
            <div className="flex items-center justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${iconPalette}`}>{icon}</span>
                <p className="text-3xl font-bold">{value}</p>
            </div>
            <p className="mt-4 text-sm font-semibold">{title}</p>
            <p className={`mt-1 text-xs ${descriptionTone}`}>{description}</p>
        </div>
    );
}
