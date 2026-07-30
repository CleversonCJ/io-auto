"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, Landmark, PencilLine, Plus, Tags, Trash2, TrendingUp } from "lucide-react";
import { formatMoney } from "@/modules/ioauto/formatters";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";
import type {
    FinancialDreSectionCode,
    FinancialDreSectionRecord,
    FinancialDreSubcategoryRecord,
    FinancialEntryType,
    SaveDreSubcategoryPayload,
} from "@/modules/financeiro/types";
import { FinancialFilterBar } from "./FinancialFilterBar";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

type DreTab = "report" | "categories";

type SectionSummarySubcategory = FinancialDreSubcategoryRecord & { amountCents: number };

type SectionSummary = Omit<FinancialDreSectionRecord, "subcategories"> & {
    receivableTotalCents: number;
    payableTotalCents: number;
    netTotalCents: number;
    subcategories: SectionSummarySubcategory[];
};

type ReportLine = {
    key: string;
    label: string;
    helper: string;
    amountCents: number;
    kind: "section" | "derived";
    tone: "positive" | "negative" | "neutral" | "dark";
    subcategories: SectionSummarySubcategory[];
};

type SubcategoryDialogState = {
    open: boolean;
    sectionCode: FinancialDreSectionCode | null;
    subcategory: FinancialDreSubcategoryRecord | null;
};

type SectionCardProps = {
    summary: SectionSummary;
    onCreate: (sectionCode: FinancialDreSectionCode) => void;
    onEdit: (sectionCode: FinancialDreSectionCode, subcategory: FinancialDreSubcategoryRecord) => void;
    onDelete: (subcategory: FinancialDreSubcategoryRecord) => void;
};

const TAB_LABELS: Record<DreTab, string> = {
    report: "Relatório DRE",
    categories: "Categorias",
};

const REPORT_CARD_TONES: Record<ReportLine["tone"], { shell: string; title: string; value: string; sub: string }> = {
    positive: {
        shell: "border-emerald-100 bg-white",
        title: "bg-emerald-50 text-emerald-800",
        value: "text-emerald-600",
        sub: "text-black/45",
    },
    negative: {
        shell: "border-rose-100 bg-white",
        title: "bg-rose-50 text-rose-700",
        value: "text-rose-600",
        sub: "text-black/45",
    },
    neutral: {
        shell: "border-amber-100 bg-white",
        title: "bg-amber-50 text-amber-800",
        value: "text-io-dark",
        sub: "text-black/45",
    },
    dark: {
        shell: "border-io-purple/15 bg-white",
        title: "bg-[linear-gradient(135deg,rgba(107,0,227,0.16),rgba(132,49,226,0.08))] text-io-dark",
        value: "text-io-purple",
        sub: "text-black/50",
    },
};

const SECTION_DIRECTION_LABEL: Record<string, string> = {
    RECEIVABLE: "Entradas",
    PAYABLE: "Saídas",
    BOTH: "Entradas e saídas",
};

const SECTION_HEADER_TONES: Record<FinancialDreSectionCode, { header: string; chip: string; iconButton: string; totalBox: string }> = {
    GROSS_REVENUE: {
        header: "bg-emerald-50",
        chip: "bg-emerald-100 text-emerald-700",
        iconButton: "border-emerald-200 bg-white/90 text-emerald-700 hover:bg-white",
        totalBox: "bg-emerald-50/70",
    },
    GROSS_REVENUE_DEDUCTIONS: {
        header: "bg-rose-50",
        chip: "bg-rose-100 text-rose-700",
        iconButton: "border-rose-200 bg-white/90 text-rose-700 hover:bg-white",
        totalBox: "bg-rose-50/70",
    },
    COST_OF_SALES: {
        header: "bg-amber-50",
        chip: "bg-amber-100 text-amber-700",
        iconButton: "border-amber-200 bg-white/90 text-amber-700 hover:bg-white",
        totalBox: "bg-amber-50/70",
    },
    SALES_EXPENSES: {
        header: "bg-orange-50",
        chip: "bg-orange-100 text-orange-700",
        iconButton: "border-orange-200 bg-white/90 text-orange-700 hover:bg-white",
        totalBox: "bg-orange-50/70",
    },
    ADMINISTRATIVE_EXPENSES: {
        header: "bg-sky-50",
        chip: "bg-sky-100 text-sky-700",
        iconButton: "border-sky-200 bg-white/90 text-sky-700 hover:bg-white",
        totalBox: "bg-sky-50/70",
    },
    FINANCIAL_REVENUES: {
        header: "bg-violet-50",
        chip: "bg-violet-100 text-violet-700",
        iconButton: "border-violet-200 bg-white/90 text-violet-700 hover:bg-white",
        totalBox: "bg-violet-50/70",
    },
    FINANCIAL_EXPENSES: {
        header: "bg-fuchsia-50",
        chip: "bg-fuchsia-100 text-fuchsia-700",
        iconButton: "border-fuchsia-200 bg-white/90 text-fuchsia-700 hover:bg-white",
        totalBox: "bg-fuchsia-50/70",
    },
    OTHER_OPERATING_RESULTS: {
        header: "bg-indigo-50",
        chip: "bg-indigo-100 text-indigo-700",
        iconButton: "border-indigo-200 bg-white/90 text-indigo-700 hover:bg-white",
        totalBox: "bg-indigo-50/70",
    },
};

export function FinancialDRE() {
    const { data, loading, error, saveDreSubcategory, deleteDreSubcategory } = useFinancialData();
    const [activeTab, setActiveTab] = useState<DreTab>("report");
    const [dialog, setDialog] = useState<SubcategoryDialogState>({ open: false, sectionCode: null, subcategory: null });
    const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

    const sectionSummaries = useMemo<SectionSummary[]>(() => {
        const sections = data?.dreStructure.sections ?? [];
        const entries = data?.entries ?? [];

        return sections
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((section) => {
                const subcategories = section.subcategories
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                    .map((subcategory) => ({
                        ...subcategory,
                        amountCents: entries
                            .filter((entry) => entry.dreSubcategoryId === subcategory.id)
                            .reduce((total, entry) => total + entry.amountCents, 0),
                    }));

                const receivableTotalCents = entries
                    .filter((entry) => entry.dreSectionCode === section.code && entry.type === "RECEIVABLE")
                    .reduce((total, entry) => total + entry.amountCents, 0);
                const payableTotalCents = entries
                    .filter((entry) => entry.dreSectionCode === section.code && entry.type === "PAYABLE")
                    .reduce((total, entry) => total + entry.amountCents, 0);

                return {
                    ...section,
                    receivableTotalCents,
                    payableTotalCents,
                    netTotalCents: receivableTotalCents - payableTotalCents,
                    subcategories,
                };
            });
    }, [data?.dreStructure.sections, data?.entries]);

    const sectionSummaryByCode = useMemo<Map<FinancialDreSectionCode, SectionSummary>>(() => {
        const map = new Map<FinancialDreSectionCode, SectionSummary>();
        for (const section of sectionSummaries) {
            map.set(section.code, section);
        }
        return map;
    }, [sectionSummaries]);

    const lineSubcategories = (sectionCode: FinancialDreSectionCode) => (sectionSummaryByCode.get(sectionCode)?.subcategories ?? []) as ReportLine["subcategories"];

    const reportLines = useMemo<ReportLine[]>(() => {
        if (!data) return [];

        return [
            {
                key: "gross-revenue",
                label: "Receita Bruta",
                helper: "Entradas de faturamento bruto vinculadas ao Fluxo de Caixa.",
                amountCents: data.dre.grossRevenueCents,
                kind: "section",
                tone: "positive",
                subcategories: lineSubcategories("GROSS_REVENUE"),
            },
            {
                key: "gross-deductions",
                label: "(-) Deduções da Receita Bruta",
                helper: "Impostos e abatimentos vinculados ao faturamento.",
                amountCents: data.dre.taxExpensesCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("GROSS_REVENUE_DEDUCTIONS"),
            },
            {
                key: "net-revenue",
                label: "(=) Receita Líquida",
                helper: "Receita bruta menos deduções.",
                amountCents: data.dre.netRevenueCents,
                kind: "derived",
                tone: "dark",
                subcategories: [],
            },
            {
                key: "cost-of-sales",
                label: "(-) Custos das Vendas (CMV)",
                helper: "Custos diretamente ligados aos veículos vendidos.",
                amountCents: data.dre.costOfSalesCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("COST_OF_SALES"),
            },
            {
                key: "gross-profit",
                label: "(=) Lucro Bruto",
                helper: "Receita líquida menos CMV.",
                amountCents: data.dre.grossProfitCents,
                kind: "derived",
                tone: "dark",
                subcategories: [],
            },
            {
                key: "other-operating-revenue",
                label: "(+) Outras Receitas Operacionais",
                helper: "Receitas operacionais extras registradas no caixa.",
                amountCents: data.dre.otherOperatingRevenueCents,
                kind: "section",
                tone: "positive",
                subcategories: lineSubcategories("OTHER_OPERATING_RESULTS").filter((subcategory) => subcategory.entryType === "RECEIVABLE"),
            },
            {
                key: "sales-expenses",
                label: "(-) Despesas com Vendas",
                helper: "Comissões, marketing e demais gastos comerciais.",
                amountCents: data.dre.salesExpensesCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("SALES_EXPENSES"),
            },
            {
                key: "admin-expenses",
                label: "(-) Despesas Administrativas",
                helper: "Estrutura, equipe e operação administrativa.",
                amountCents: data.dre.administrativeExpensesCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("ADMINISTRATIVE_EXPENSES"),
            },
            {
                key: "other-operating-expense",
                label: "(-) Outras Despesas Operacionais",
                helper: "Saídas operacionais diversas fora do CMV.",
                amountCents: data.dre.otherOperatingExpenseCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("OTHER_OPERATING_RESULTS").filter((subcategory) => subcategory.entryType === "PAYABLE"),
            },
            {
                key: "operating-result",
                label: "(=) Resultado Operacional",
                helper: "Lucro bruto ajustado pelas despesas e receitas operacionais.",
                amountCents: data.dre.operatingResultCents,
                kind: "derived",
                tone: "dark",
                subcategories: [],
            },
            {
                key: "financial-revenue",
                label: "(+) Receitas Financeiras",
                helper: "Rendimentos financeiros vinculados aos lançamentos.",
                amountCents: data.dre.financialRevenueCents,
                kind: "section",
                tone: "positive",
                subcategories: lineSubcategories("FINANCIAL_REVENUES"),
            },
            {
                key: "financial-expense",
                label: "(-) Despesas Financeiras",
                helper: "Juros, tarifas e demais despesas financeiras.",
                amountCents: data.dre.financialExpenseCents,
                kind: "section",
                tone: "negative",
                subcategories: lineSubcategories("FINANCIAL_EXPENSES"),
            },
            {
                key: "net-result",
                label: "(=) Resultado Líquido",
                helper: "Resultado operacional somado ao resultado financeiro.",
                amountCents: data.dre.netResultCents,
                kind: "derived",
                tone: "dark",
                subcategories: [],
            },
        ];
    }, [data, lineSubcategories]);

    async function handleDeleteSubcategory(subcategory: FinancialDreSubcategoryRecord) {
        if (!confirm(`Deseja excluir a subcategoria "${subcategory.name}"?`)) return;

        try {
            setDeleteBusyId(subcategory.id);
            await deleteDreSubcategory(subcategory.id);
        } catch (cause) {
            alert(cause instanceof Error ? cause.message : "Não foi possível excluir a subcategoria.");
        } finally {
            setDeleteBusyId(null);
        }
    }

    if (loading) {
        return <SystemPageLoader label="Carregando DRE" description="Calculando receitas, custos e resultados..." />;
    }

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <div className="grid gap-6">
            <section className="rounded-[34px] border border-io-purple/10 bg-[linear-gradient(180deg,rgba(107,0,227,0.04),rgba(255,255,255,1))] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <MetricCard label="Receita líquida" value={formatMoney(data?.dre.netRevenueCents ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
                        <MetricCard label="Lucro bruto" value={formatMoney(data?.dre.grossProfitCents ?? 0)} icon={<Landmark className="h-4 w-4" />} />
                        <MetricCard label="Resultado líquido" value={formatMoney(data?.dre.netResultCents ?? 0)} icon={<FileSpreadsheet className="h-4 w-4" />} dark />
                    </div>
                </div>

                <div className="mt-6 border-b border-black/10">
                    <div className="flex flex-wrap gap-2">
                        {(["report", "categories"] as const).map((tab) => {
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative rounded-t-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? "text-io-purple" : "text-black/45 hover:text-io-purple/80"}`}
                                >
                                    {TAB_LABELS[tab]}
                                    <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full transition ${isActive ? "bg-io-purple" : "bg-transparent"}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <FinancialFilterBar />

            {activeTab === "report" ? (
                <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
                        <div className="grid gap-4">
                            {reportLines.map((line) => (
                                <ReportLineCard key={line.key} line={line} />
                            ))}
                        </div>

                        <aside className="grid content-start gap-4">
                            <div className="rounded-[28px] border border-black/10 bg-[#fbfbfb] p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Como ler</p>
                                <div className="mt-4 grid gap-3 text-sm text-black/60">
                                    <p>As linhas do DRE são calculadas a partir dos lançamentos e vendas marcadas no estoque.</p>
                                    <p>Os valores respeitam o filtro atual de mês e ano, sem quebrar a estrutura contábil.</p>
                                    <p>Cada subcategoria criada no DRE passa a estar disponível no cadastro de contas e movimentações.</p>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-io-purple/15 bg-[linear-gradient(160deg,rgba(107,0,227,0.14),rgba(132,49,226,0.05))] p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-io-purple/70">Fechamento</p>
                                <div className="mt-4 grid gap-4">
                                    <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-4">
                                        <p className="text-sm text-black/55">Receitas totais</p>
                                        <p className="mt-2 text-2xl font-bold text-io-dark">{formatMoney((data?.dre.grossRevenueCents ?? 0) + (data?.dre.financialRevenueCents ?? 0) + (data?.dre.otherOperatingRevenueCents ?? 0))}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-4">
                                        <p className="text-sm text-black/55">Despesas totais</p>
                                        <p className="mt-2 text-2xl font-bold text-io-dark">{formatMoney((data?.dre.taxExpensesCents ?? 0) + (data?.dre.costOfSalesCents ?? 0) + (data?.dre.salesExpensesCents ?? 0) + (data?.dre.administrativeExpensesCents ?? 0) + (data?.dre.otherOperatingExpenseCents ?? 0) + (data?.dre.financialExpenseCents ?? 0))}</p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            ) : (
                <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="mb-6">
                        <h3 className="font-display text-2xl font-bold text-io-dark">Estrutura do DRE</h3>
                        <p className="mt-2 max-w-4xl text-sm text-black/55">
                            As categorias mestre definem a matemática do DRE. Cadastre subcategorias em cada seção para organizar o Fluxo de Caixa e refletir os valores no relatório.
                        </p>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {sectionSummaries.map((summary) => (
                            <SectionCard
                                key={summary.code}
                                summary={summary}
                                onCreate={(sectionCode) => setDialog({ open: true, sectionCode, subcategory: null })}
                                onEdit={(sectionCode, subcategory) => setDialog({ open: true, sectionCode, subcategory })}
                                onDelete={handleDeleteSubcategory}
                            />
                        ))}
                    </div>
                </section>
            )}

            <DreSubcategoryDialog
                state={dialog}
                onClose={() => setDialog({ open: false, sectionCode: null, subcategory: null })}
                onSave={saveDreSubcategory}
                sections={data?.dreStructure.sections ?? []}
                busyDeleteId={deleteBusyId}
            />
        </div>
    );
}

function MetricCard({ label, value, icon, dark = false }: { label: string; value: string; icon: ReactNode; dark?: boolean }) {
    return (
        <div className={`rounded-[24px] border px-4 py-4 shadow-sm ${dark ? "border-io-purple/20 bg-[linear-gradient(160deg,rgba(107,0,227,0.16),rgba(132,49,226,0.06))] text-io-dark" : "border-black/10 bg-[#fbfbfb] text-io-dark"}`}>
            <div className="flex items-center justify-between gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-2xl ${dark ? "bg-io-purple text-white" : "bg-white text-io-purple"}`}>{icon}</span>
                <p className="text-right text-2xl font-bold">{value}</p>
            </div>
            <p className={`mt-3 text-sm font-semibold ${dark ? "text-io-purple/80" : "text-black/60"}`}>{label}</p>
        </div>
    );
}

function ReportLineCard({ line }: { line: ReportLine }) {
    const tone = REPORT_CARD_TONES[line.tone];

    return (
        <article className={`rounded-[30px] border p-4 shadow-[0_18px_45px_rgba(0,0,0,0.06)] ${tone.shell}`}>
            <div className={`rounded-[22px] px-5 py-4 ${tone.title}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em]">{line.label}</p>
                        <p className={`mt-2 text-sm ${tone.sub}`}>{line.helper}</p>
                    </div>
                    <p className={`text-3xl font-bold ${tone.value}`}>{formatMoney(line.amountCents)}</p>
                </div>
            </div>

            {line.kind === "section" ? (
                <div className="mt-4">
                    {line.subcategories.length ? (
                        <div className="grid gap-2">
                            {line.subcategories.map((subcategory) => (
                                <div key={subcategory.id} className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-io-dark">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">{subcategory.name}</p>
                                        <p className="mt-1 text-xs text-io-purple/75">{subcategory.entryType === "RECEIVABLE" ? "Entrada" : "Saída"}</p>
                                    </div>
                                    <p className="shrink-0 font-bold">{formatMoney(subcategory.amountCents)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-black/45">
                            Nenhum valor registrado nesta linha no período filtrado.
                        </div>
                    )}
                </div>
            ) : null}
        </article>
    );
}

function SectionCard({ summary, onCreate, onEdit, onDelete }: SectionCardProps) {
    const displayTotal = summary.entryTypeMode === "BOTH" ? summary.netTotalCents : summary.receivableTotalCents - summary.payableTotalCents;
    const tone = SECTION_HEADER_TONES[summary.code];

    return (
        <article className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
            <div className={`flex items-start justify-between gap-4 border-b border-black/10 px-5 py-5 ${tone.header}`}>
                <div>
                    <h4 className="font-display text-xl font-bold text-io-dark">{summary.label}</h4>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
                        {SECTION_DIRECTION_LABEL[summary.entryTypeMode]}
                    </p>
                    <p className="mt-3 text-sm text-black/60">{summary.description}</p>
                </div>

                <button
                    type="button"
                    onClick={() => onCreate(summary.code)}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${tone.iconButton}`}
                    title={`Adicionar subcategoria em ${summary.label}`}
                >
                    <Plus className="h-5 w-5" />
                </button>
            </div>

            <div className={`flex items-center justify-between gap-3 border-b border-black/10 px-5 py-3 ${tone.totalBox}`}>
                <div className="flex items-center gap-2 text-sm text-black/55">
                    <Tags className="h-4 w-4 text-io-purple" />
                    <span>{summary.subcategories.length} subcategoria(s)</span>
                </div>
                <p className="text-sm font-semibold text-io-dark">{formatMoney(displayTotal)}</p>
            </div>

            <div className="grid divide-y divide-black/10">
                {summary.subcategories.length ? (
                    summary.subcategories.map((subcategory) => (
                        <div key={subcategory.id} className="flex items-center gap-3 px-5 py-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-io-dark">{subcategory.name}</p>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}>
                                        {subcategory.entryType === "RECEIVABLE" ? "Entrada" : "Saída"}
                                    </span>
                                    {subcategory.locked ? (
                                        <span className="rounded-full bg-io-purple/10 px-2.5 py-1 text-[11px] font-semibold text-io-purple">
                                            Padrão
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-2 text-sm text-black/45">Valor no filtro atual: {formatMoney(subcategory.amountCents)}</p>
                            </div>

                            {!subcategory.locked ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onEdit(summary.code, subcategory)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-io-purple/20 bg-io-purple/10 text-io-purple transition hover:bg-io-purple/15"
                                        title={`Editar ${subcategory.name}`}
                                    >
                                        <PencilLine className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(subcategory)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                        title={`Excluir ${subcategory.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ))
                ) : (
                    <div className="px-5 py-8 text-center text-sm text-black/45">Nenhuma subcategoria cadastrada.</div>
                )}
            </div>
        </article>
    );
}

function DreSubcategoryDialog({
    state,
    onClose,
    onSave,
    sections,
    busyDeleteId,
}: {
    state: SubcategoryDialogState;
    onClose: () => void;
    onSave: (id: string | null, payload: SaveDreSubcategoryPayload) => Promise<void>;
    sections: FinancialDreSectionRecord[];
    busyDeleteId: string | null;
}) {
    const [name, setName] = useState("");
    const [entryType, setEntryType] = useState<FinancialEntryType>("PAYABLE");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const section = useMemo(
        () => sections.find((candidate) => candidate.code === state.sectionCode) ?? null,
        [sections, state.sectionCode]
    );

    useEffect(() => {
        if (!state.open || !section) return;
        setName(state.subcategory?.name ?? "");
        if (section.entryTypeMode === "BOTH") {
            setEntryType(state.subcategory?.entryType ?? "PAYABLE");
        } else {
            setEntryType(section.entryTypeMode as FinancialEntryType);
        }
        setError(null);
    }, [section, state.open, state.subcategory]);

    if (!state.open || !section) return null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (!section) return;

        try {
            setSaving(true);
            await onSave(state.subcategory?.id ?? null, {
                sectionCode: section.code,
                name,
                entryType: section.entryTypeMode === "BOTH" ? entryType : undefined,
            });
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar a subcategoria.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-io-purple/70">{section.label}</p>
                        <h4 className="mt-2 font-display text-2xl font-bold text-io-dark">
                            {state.subcategory ? "Editar subcategoria" : "Nova subcategoria"}
                        </h4>
                        <p className="mt-2 text-sm text-black/55">
                            Essa subcategoria ficará disponível para novos lançamentos e refletirá automaticamente no DRE.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-io-purple/15 bg-io-purple/10 text-io-purple transition hover:bg-io-purple/15"
                    >
                        <Plus className="h-4 w-4 rotate-45" />
                    </button>
                </div>

                <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                    <label className="grid gap-2 text-sm font-medium text-black/65">
                        <span>Nome</span>
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Ex.: Comissão de parceiros"
                            className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                            required
                        />
                    </label>

                    {section.entryTypeMode === "BOTH" ? (
                        <label className="grid gap-2 text-sm font-medium text-black/65">
                            <span>Direção do valor</span>
                            <select
                                value={entryType}
                                onChange={(event) => setEntryType(event.target.value as FinancialEntryType)}
                                className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/20"
                            >
                                <option value="RECEIVABLE">Entrada</option>
                                <option value="PAYABLE">Saída</option>
                            </select>
                        </label>
                    ) : (
                        <div className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm text-black/55">
                            Direção fixa desta seção: <span className="font-semibold text-io-dark">{SECTION_DIRECTION_LABEL[section.entryTypeMode]}</span>
                        </div>
                    )}

                    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                    {busyDeleteId ? <p className="text-xs text-black/35">Atualizando estrutura do DRE...</p> : null}

                    <div className="mt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-black/65 transition hover:border-black/20 hover:text-black"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-full bg-io-purple px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
                        >
                            {saving ? "Salvando..." : state.subcategory ? "Atualizar" : "Salvar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
