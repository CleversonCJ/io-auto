"use client";

import { Landmark, FileSpreadsheet } from "lucide-react";
import { formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";

export function FinancialDRE() {
    const { data, loading, error } = useFinancialData();

    if (loading) {
        return <div className="text-sm text-black/55">Carregando DRE...</div>;
    }

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white">
                    <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                    <h2 className="font-display text-2xl font-bold text-io-dark">DRE simplificado</h2>
                    <p className="text-sm text-black/55">Leitura rápida da operação com receitas e despesas.</p>
                </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
                <MetricTile label="Receita com veículos vendidos" value={formatMoney(data?.dre.vehicleSalesRevenueCents ?? null)} />
                <MetricTile label="Outras receitas" value={formatMoney(data?.dre.otherRevenueCents ?? null)} />
                <MetricTile label="Impostos" value={formatMoney(data?.dre.taxExpensesCents ?? null)} />
                <MetricTile label="Despesas operacionais" value={formatMoney(data?.dre.operatingExpensesCents ?? null)} />
            </div>

            <div className="mt-4 rounded-[26px] border border-black/10 bg-black px-5 py-5 text-white">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/55">Resultado líquido</p>
                        <p className="mt-2 text-3xl font-bold">{formatMoney(data?.dre.netResultCents ?? null)}</p>
                    </div>
                    <Landmark className="h-8 w-8 text-white/75" />
                </div>
                <p className="mt-3 text-sm text-white/60">Receita bruta atual: {formatMoney(data?.dre.grossRevenueCents ?? null)}</p>
            </div>
        </article>
    );
}

function MetricTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.03] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-black/38">{label}</p>
            <p className="mt-3 text-2xl font-bold text-io-dark">{value}</p>
        </div>
    );
}
