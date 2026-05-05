"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import type { FinancialEntryRecord } from "@/modules/financeiro/types";
import { sortEntries } from "./financial-utils";
import { FinancialAccountPanel } from "./FinancialAccountPanel";
import { FinancialEntryModal } from "./FinancialEntryModal";
import { FinancialFilterBar } from "./FinancialFilterBar";

export function FinancialContas() {
    const { data, loading } = useFinancialData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<FinancialEntryRecord | null>(null);

    const receivables = useMemo(
        () => sortEntries((data?.entries ?? []).filter((entry) => entry.type === "RECEIVABLE")),
        [data?.entries]
    );

    const payables = useMemo(
        () => sortEntries((data?.entries ?? []).filter((entry) => entry.type === "PAYABLE")),
        [data?.entries]
    );

    const chartData = useMemo(() => {
        const map = new Map<string, { monthStr: string; receivable: number; payable: number }>();

        data?.entries?.forEach((entry) => {
            if (!entry.dueDate) return;
            const monthKey = entry.dueDate.substring(0, 7); // "YYYY-MM"
            if (!map.has(monthKey)) {
                const [year, month] = monthKey.split("-");
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);

                // Formato Ex: "Jan/2026"
                let monthStr = date.toLocaleString("pt-BR", { month: "short", year: "numeric" });
                monthStr = monthStr.replace(". de ", "/").replace(" de ", "/");
                // Capitalize
                monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

                map.set(monthKey, { monthStr, receivable: 0, payable: 0 });
            }

            const item = map.get(monthKey)!;
            if (entry.type === "RECEIVABLE") {
                item.receivable += entry.amountCents;
            } else if (entry.type === "PAYABLE") {
                item.payable += entry.amountCents;
            }
        });

        const sorted = Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map((v) => v[1]);

        return {
            categories: sorted.map((s) => s.monthStr),
            receivables: sorted.map((s) => s.receivable / 100),
            payables: sorted.map((s) => s.payable / 100),
        };
    }, [data?.entries]);

    const chartOptions: Highcharts.Options = useMemo(() => {
        return {
            chart: {
                type: "column",
                style: { fontFamily: "inherit" },
                backgroundColor: "transparent",
            },
            title: { text: undefined },
            xAxis: {
                categories: chartData.categories,
                labels: { style: { color: "rgba(0,0,0,0.6)" } },
                lineColor: "rgba(0,0,0,0.1)",
            },
            yAxis: {
                title: { text: undefined },
                labels: {
                    style: { color: "rgba(0,0,0,0.6)" },
                    formatter: function () {
                        return "R$ " + this.axis.defaultLabelFormatter.call(this);
                    },
                },
                gridLineColor: "rgba(0,0,0,0.05)",
            },
            plotOptions: {
                column: {
                    borderRadius: 4,
                    borderWidth: 0,
                    groupPadding: 0.1,
                },
            },
            tooltip: {
                shared: true,
                valuePrefix: "R$ ",
                valueDecimals: 2,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                borderColor: "rgba(0,0,0,0.1)",
                borderRadius: 12,
                style: { color: "#212121" },
            },
            colors: ["#10b981", "#f43f5e"], // emerald-500, rose-500
            series: [
                {
                    type: "column",
                    name: "Entradas Previstas",
                    data: chartData.receivables,
                },
                {
                    type: "column",
                    name: "Contas a Pagar",
                    data: chartData.payables,
                },
            ],
            legend: {
                itemStyle: { color: "rgba(0,0,0,0.7)", fontWeight: "500" },
            },
            credits: { enabled: false },
        };
    }, [chartData]);

    function handleEdit(entry: FinancialEntryRecord) {
        setEditingEntry(entry);
        setIsModalOpen(true);
    }

    function handleOpenNew() {
        setEditingEntry(null);
        setIsModalOpen(true);
    }

    return (
        <div className="grid gap-6">
            <FinancialFilterBar>
                <button
                    onClick={handleOpenNew}
                    className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111]"
                >
                    <Plus className="h-4 w-4" />
                    <span>Nova Conta</span>
                </button>
            </FinancialFilterBar>

            <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="mb-4">
                    <h3 className="font-display text-xl font-bold text-io-dark">Previsão Mensal</h3>
                    <p className="text-sm text-black/55">Entradas previstas vs Contas a pagar</p>
                </div>
                {chartData.categories.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                ) : (
                    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-black/10">
                        <p className="text-sm text-black/45">Sem dados suficientes para gerar o gráfico.</p>
                    </div>
                )}
            </article>

            <div className="grid gap-6 grid-cols-1 items-start">
                <FinancialAccountPanel
                    title="Contas a receber"
                    subtitle="Inclui automaticamente os veículos vendidos"
                    icon={<ArrowUpCircle className="h-5 w-5" />}
                    total={formatMoney(data?.accountsReceivable.openAmountCents ?? null)}
                    secondary={`Em atraso: ${data?.accountsReceivable.overdueCount ?? 0} | Liquidadas: ${formatMoney(data?.accountsReceivable.settledAmountCents ?? 0)}`}
                    entries={receivables}
                    loading={loading}
                    onEdit={handleEdit}
                />

                <FinancialAccountPanel
                    title="Contas a pagar"
                    subtitle="Despesas registradas manualmente para controlar saídas"
                    icon={<ArrowDownCircle className="h-5 w-5" />}
                    total={formatMoney(data?.accountsPayable.openAmountCents ?? null)}
                    secondary={`Em atraso: ${data?.accountsPayable.overdueCount ?? 0} | Liquidadas: ${formatMoney(data?.accountsPayable.settledAmountCents ?? 0)}`}
                    entries={payables}
                    loading={loading}
                    onEdit={handleEdit}
                />
            </div>

            <FinancialEntryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                mode="contas"
                editingEntry={editingEntry}
            />
        </div>
    );
}
