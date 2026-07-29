"use client";

import { superAdminSections, type SuperAdminAlert, type SuperAdminChart, type SuperAdminInsight, type SuperAdminLeaderboardRow, type SuperAdminMetric, type SuperAdminSection, type SuperAdminSectionKey, type SuperAdminStatCard } from "@/modules/superadmin/data";

export type LiveVisualSectionKey = Exclude<SuperAdminSectionKey, "tenants">;

export type TenantSnapshot = {
    tenantId: string;
    companyName: string;
    companyEmail: string;
    planName?: string | null;
    planKey?: string | null;
    status?: string | null;
    subscriptionAmountCents?: number | null;
    billingRecurrence?: string | null;
    entryDate?: string | null;
    lastAccessAt?: string | null;
    mrrCents?: number | null;
    city?: string | null;
    region?: string | null;
    originSource?: string | null;
    stockCount?: number | null;
    activeAdsCount?: number | null;
    healthScore?: number | null;
    healthClassification?: string | null;
};

export type CustomerHealthRow = {
    tenantId: string;
    companyName: string;
    planName?: string | null;
    city?: string | null;
    region?: string | null;
    score: number;
    classification: string;
    riskLevel: string;
    lastAccessAt?: string | null;
};

export type CatalogLeadRow = {
    id: string;
    tenantId: string;
    companyName: string;
    fullName: string;
    whatsapp: string;
    vehicleInterestName: string;
    sellerName?: string | null;
    originSource: string;
    createdAt: string;
    convertedToSale: boolean;
    convertedSaleId?: string | null;
};

export type SupportTicketSummary = {
    ticketId: string;
    tenantId: string;
    companyName: string;
    title: string;
    category: string;
    urgency: string;
    status: string;
    bugArea?: string | null;
    createdAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    closedAt?: string | null;
};

type BuildArgs = {
    section: LiveVisualSectionKey;
    dashboardData: Record<string, any> | null;
    tenantRows: TenantSnapshot[];
    billingSnapshot: Record<string, any> | null;
    healthRows: CustomerHealthRow[];
    catalogLeads: CatalogLeadRow[];
    supportTickets: SupportTicketSummary[];
};

type Pair = {
    label: string;
    value: number;
};

type ChartFormat = "currency" | "number" | "percent";

const PIE_COLORS = ["#6b00e3", "#14b8a6", "#0f172a", "#f59e0b", "#ef4444", "#38bdf8"];

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function integer(value: number) {
    return Math.round(value).toLocaleString("pt-BR");
}

function decimal(value: number, digits = 1) {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function preciseDecimal(value: number, digits = 2) {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    });
}

function currency(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format((cents || 0) / 100);
}

function percent(value: number, digits = 2) {
    return `${decimal(value, digits)}%`;
}

function signedPercent(value: number, digits = 2) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${decimal(value, digits)}%`;
}

function monthLabelFromCount(value: number) {
    return value === 1 ? "mês" : "meses";
}

function dayLabel(value: number) {
    return value === 1 ? "dia" : "dias";
}

function minuteLabel(value: number) {
    return value === 1 ? "min" : "min";
}

function formatMonthsDuration(months: number) {
    const totalDays = Math.round(Math.max(months, 0) * 30);
    if (totalDays <= 0) return `0 ${dayLabel(0)}`;
    if (totalDays < 30) return `${integer(totalDays)} ${dayLabel(totalDays)}`;

    const wholeMonths = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;
    if (remainingDays === 0) {
        return `${integer(wholeMonths)} ${monthLabelFromCount(wholeMonths)}`;
    }

    return `${integer(wholeMonths)} ${monthLabelFromCount(wholeMonths)} e ${integer(remainingDays)} ${dayLabel(remainingDays)}`;
}

function formatHoursDuration(hours: number) {
    const totalMinutes = Math.round(Math.max(hours, 0) * 60);
    if (totalMinutes < 60) return `${integer(totalMinutes)} ${minuteLabel(totalMinutes)}`;

    const wholeHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) return `${integer(wholeHours)} h`;
    return `${integer(wholeHours)} h ${integer(remainingMinutes)} min`;
}

function formatMinutesDuration(minutes: number) {
    const roundedMinutes = Math.round(Math.max(minutes, 0));
    if (roundedMinutes < 60) return `${integer(roundedMinutes)} min`;
    const wholeHours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    if (remainingMinutes === 0) return `${integer(wholeHours)} h`;
    return `${integer(wholeHours)} h ${integer(remainingMinutes)} min`;
}

function changeRate(current: number, previous: number) {
    if (!previous) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

function monthLabel(value?: string | null) {
    if (!value) return "Período";

    const isoMonth = /^(\d{4})-(\d{2})$/;
    const match = value.match(isoMonth);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
        return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    }

    return value;
}

function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR");
}

function titleCase(value?: string | null) {
    if (!value) return "-";
    return value
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
}

function planLabel(row: { planName?: string | null; planKey?: string | null }) {
    return row.planName || row.planKey || "Sem plano";
}

function featureLabel(featureKey?: string | null) {
    const normalized = (featureKey || "").toUpperCase();
    if (normalized.includes("MARKET")) return "Integração com marketplaces";
    if (normalized.includes("SITE") || normalized.includes("WEBSITE")) return "Site próprio";
    if (normalized.includes("FINANC")) return "Financeiro";
    if (normalized.includes("REPORT")) return "Relatórios";
    if (normalized.includes("LEAD")) return "Leads";
    if (normalized.includes("STOCK") || normalized.includes("INVENT")) return "Estoque";
    return titleCase(normalized);
}

function platformLabel(value?: string | null) {
    const normalized = (value || "").trim();
    if (!normalized) return "Não informado";
    if (normalized.toUpperCase() === "MERCADO_LIVRE") return "Mercado Livre";
    return titleCase(normalized);
}

function originLabel(value?: string | null) {
    const normalized = (value || "").trim().toLowerCase();
    if (!normalized) return "Não informado";
    if (normalized.includes("indic")) return "Indicação";
    if (normalized.includes("pago") || normalized.includes("ads") || normalized.includes("meta") || normalized.includes("google")) return "Tráfego pago";
    if (normalized.includes("organ")) return "Orgânico";
    if (normalized.includes("parce")) return "Parceiros";
    if (normalized.includes("seller")) return "Link do vendedor";
    return titleCase(normalized.replace(/[-_]+/g, " "));
}

function stockBucket(count?: number | null) {
    const total = toNumber(count);
    if (total <= 20) return "Até 20";
    if (total <= 50) return "20 a 50";
    return "50+";
}

function activeCustomerStatus(status?: string | null) {
    return ["ACTIVE", "OVERDUE"].includes((status || "").toUpperCase());
}

function revenueCustomerStatus(status?: string | null) {
    return ["ACTIVE", "OVERDUE", "BLOCKED"].includes((status || "").toUpperCase());
}

function daysSince(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function average(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function total(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0);
}

function topPairs<T>(
    rows: T[],
    labelSelector: (row: T) => string,
    valueSelector: (row: T) => number,
    limit = 6,
) {
    const grouped = new Map<string, number>();
    rows.forEach((row) => {
        const label = labelSelector(row);
        const value = valueSelector(row);
        if (!label) return;
        grouped.set(label, (grouped.get(label) ?? 0) + value);
    });

    return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, limit);
}

function fallbackPairs(rows: Pair[], label = "Sem dados") {
    return rows.length ? rows : [{ label, value: 0 }];
}

function formatTopRows<T>(rows: T[], mapRow: (row: T) => SuperAdminLeaderboardRow, limit = 3) {
    return rows.slice(0, limit).map(mapRow);
}

function metric(label: string, value: string, hint: string, delta?: string, tone?: SuperAdminMetric["tone"]): SuperAdminMetric {
    return { label, value, hint, delta, tone };
}

function alert(title: string, description: string, severity: SuperAdminAlert["severity"]): SuperAdminAlert {
    return { title, description, severity };
}

function statCard(label: string, value: string, detail: string): SuperAdminStatCard {
    return { label, value, detail };
}

function insight(title: string, description: string, tone: SuperAdminInsight["tone"]): SuperAdminInsight {
    return { title, description, tone };
}

function chartFromPairs(
    title: string,
    subtitle: string,
    type: SuperAdminChart["type"],
    rows: Pair[],
    options?: {
        name?: string;
        color?: string;
        valueFormat?: ChartFormat;
        valueDecimals?: number;
        pieColors?: string[];
    },
): SuperAdminChart {
    const safeRows = fallbackPairs(rows);
    return {
        title,
        subtitle,
        type,
        categories: safeRows.map((row) => row.label),
        series: [
            {
                name: options?.name || title,
                data: safeRows.map((row) => Number(row.value.toFixed(2))),
                color: options?.color,
            },
        ],
        valueFormat: options?.valueFormat,
        valueDecimals: options?.valueDecimals,
        pieColors: options?.pieColors,
    };
}

function toCurrencyUnitsFromCents(value: number) {
    return value / 100;
}

function buildFinanceSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.financeiro;
    const cards = args.dashboardData?.cards ?? {};
    const chartRows = Array.isArray(args.dashboardData?.chart) ? args.dashboardData.chart : [];
    const billingCards = args.billingSnapshot?.cards ?? {};
    const revenueRows = args.tenantRows.filter((row) => revenueCustomerStatus(row.status) && toNumber(row.mrrCents) > 0);
    const previousMrr = toNumber(chartRows.at(-2)?.totalMrrCents);
    const currentMrr = toNumber(cards.mrrCents);
    const mrrDelta = changeRate(currentMrr, previousMrr || currentMrr);
    const currentLostMrr = toNumber(chartRows.at(-1)?.lostMrrCents);
    const currentChurn = toNumber(chartRows.at(-1)?.churnRate ?? cards.financialChurnRate);
    const overdueRevenue = toNumber(billingCards.overdueRevenueCents);
    const overdueCustomers = toNumber(billingCards.overdueCustomers);
    const overdueRatio = currentMrr > 0 ? (overdueRevenue / currentMrr) * 100 : 0;
    const revenueByPlan = topPairs(revenueRows, (row) => planLabel(row), (row) => toCurrencyUnitsFromCents(toNumber(row.mrrCents)));
    const revenueByRegion = topPairs(revenueRows, (row) => row.region || "Não informado", (row) => toCurrencyUnitsFromCents(toNumber(row.mrrCents)));
    const revenueByStock = topPairs(revenueRows, (row) => stockBucket(row.stockCount), (row) => toCurrencyUnitsFromCents(toNumber(row.mrrCents)));
    const annualCustomers = revenueRows.filter((row) => (row.billingRecurrence || "").toUpperCase() === "ANNUAL");
    const totalLostMrr = total(chartRows.map((row: Record<string, any>) => toNumber(row.lostMrrCents)));
    const averageChurn = average(chartRows.map((row: Record<string, any>) => toNumber(row.churnRate)));

    return {
        ...meta,
        metrics: [
            metric("MRR", currency(currentMrr), "Receita recorrente mensal consolidada.", signedPercent(mrrDelta), "emerald"),
            metric("ARR", currency(toNumber(cards.arrCents)), "Receita anual projetada da carteira.", undefined, "sky"),
            metric("Ticket médio", currency(toNumber(cards.averageTicketCents)), "Média mensal por cliente pagante.", undefined, "violet"),
            metric("LTV", currency(toNumber(cards.ltvCents)), "Valor de vida calculado pela permanência média.", undefined, "amber"),
            metric("Churn financeiro", percent(toNumber(cards.financialChurnRate)), "Receita perdida por cancelamentos no período.", undefined, "rose"),
        ],
        alerts: [
            alert(
                mrrDelta < 0 ? "Queda de MRR detectada" : "MRR em trajetória positiva",
                mrrDelta < 0
                    ? `O MRR atual recuou ${percent(Math.abs(mrrDelta), 2)} frente ao fechamento anterior.`
                    : `O MRR atual cresceu ${percent(mrrDelta, 2)} frente ao fechamento anterior.`,
                mrrDelta < 0 ? "critical" : mrrDelta < 5 ? "attention" : "stable",
            ),
            alert(
                overdueRatio >= 8 ? "Inadimplência pressionando caixa" : "Inadimplência monitorada",
                `Há ${integer(overdueCustomers)} clientes com ${currency(overdueRevenue)} em atraso, equivalente a ${percent(overdueRatio, 2)} do MRR atual.`,
                overdueRatio >= 8 ? "critical" : overdueRatio >= 4 ? "attention" : "stable",
            ),
            alert(
                currentChurn >= 3 ? "Cancelamentos do mês acima do ideal" : "Cancelamentos dentro da faixa",
                `No fechamento mais recente, o sistema registrou ${currency(currentLostMrr)} de MRR perdido e churn de ${percent(currentChurn, 2)}.`,
                currentChurn >= 3 ? "critical" : currentChurn >= 1.5 ? "attention" : "stable",
            ),
        ],
        charts: [
            {
                title: "Crescimento do MRR",
                subtitle: "MRR total e perda por cancelamentos ao longo do ano.",
                type: "line",
                categories: fallbackPairs(chartRows.map((row: Record<string, any>) => ({
                    label: monthLabel(row.month),
                    value: toCurrencyUnitsFromCents(toNumber(row.totalMrrCents)),
                }))).map((row) => row.label),
                series: [
                    {
                        name: "MRR",
                        data: fallbackPairs(chartRows.map((row: Record<string, any>) => ({
                            label: monthLabel(row.month),
                            value: toCurrencyUnitsFromCents(toNumber(row.totalMrrCents)),
                        }))).map((row) => Number(row.value.toFixed(2))),
                        color: "#6b00e3",
                    },
                    {
                        name: "MRR perdido",
                        data: fallbackPairs(chartRows.map((row: Record<string, any>) => ({
                            label: monthLabel(row.month),
                            value: toCurrencyUnitsFromCents(toNumber(row.lostMrrCents)),
                        }))).map((row) => Number(row.value.toFixed(2))),
                        color: "#ef4444",
                    },
                ],
                valueFormat: "currency",
                valueDecimals: 2,
            },
            chartFromPairs("Receita por plano", "MRR agrupado pela assinatura ativa.", "column", revenueByPlan, {
                name: "Receita",
                color: "#0f172a",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
            chartFromPairs("Receita por região", "Concentração geográfica da carteira.", "bar", revenueByRegion, {
                name: "Receita",
                color: "#14b8a6",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
            chartFromPairs("MRR por porte da revenda", "Leitura de pricing por tamanho do estoque.", "column", revenueByStock, {
                name: "MRR",
                color: "#f59e0b",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
        ],
        statCards: [
            statCard("Receita em atraso", currency(overdueRevenue), `${integer(overdueCustomers)} clientes com cobrança pendente.`),
            statCard("MRR perdido no ano", currency(totalLostMrr), `Churn médio de ${percent(averageChurn, 2)} no recorte anual.`),
            statCard("Assinaturas anuais", integer(annualCustomers.length), `${percent(revenueRows.length ? (annualCustomers.length / revenueRows.length) * 100 : 0, 1)} da carteira com recorrência anual.`),
        ],
        leaderboardTitle: "Blocos com maior retorno",
        leaderboard: [
            ...(revenueByPlan[0] ? [{ name: revenueByPlan[0].label, detail: "Plano com maior MRR", value: revenueByPlan[0].value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }), badge: "Plano líder" }] : []),
            ...(revenueByRegion[0] ? [{ name: revenueByRegion[0].label, detail: "Região que mais concentra receita", value: revenueByRegion[0].value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }), badge: "Maior concentração" }] : []),
            ...(revenueByStock[0] ? [{ name: revenueByStock[0].label, detail: "Faixa de estoque dominante", value: revenueByStock[0].value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }), badge: "Base de pricing" }] : []),
        ],
        insights: [
            insight("Pricing guiado por porte", `A faixa ${revenueByStock[0]?.label || "principal"} concentra a maior parte do MRR e deve liderar ajustes de valor e limites.`, "positive"),
            insight("Cobrança impacta visão de caixa", `A carteira em atraso já equivale a ${percent(overdueRatio, 2)} do MRR atual.`, overdueRatio >= 4 ? "warning" : "positive"),
            insight("Churn deixou rastro mensurável", `O painel financeiro agora mostra mês a mês quanto de receita se perde com cancelamentos, sem precisar de consolidação manual.`, "positive"),
        ],
    };
}

function buildCustomersSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.clientes;
    const activeRows = args.tenantRows.filter((row) => activeCustomerStatus(row.status));
    const riskyRows = [...args.healthRows].sort((left, right) => left.score - right.score);
    const inactiveRows = args.healthRows.filter((row) => (daysSince(row.lastAccessAt) ?? 0) >= 7);
    const criticalRows = args.healthRows.filter((row) => row.score < 40);
    const healthAverage = average(args.healthRows.map((row) => row.score));
    const regionPairs = topPairs(activeRows, (row) => row.region || "Não informado", () => 1);
    const stockPairs = topPairs(activeRows, (row) => stockBucket(row.stockCount), () => 1);
    const planPairs = topPairs(activeRows, (row) => planLabel(row), () => 1);
    const healthPairs = topPairs(args.healthRows, (row) => row.classification || "Sem classificação", () => 1);
    const planHealth = topPairs(
        args.healthRows,
        (row) => row.planName || "Sem plano",
        (row) => row.score,
    ).map((row) => ({
        label: row.label,
        value: planPairs.find((pair) => pair.label === row.label)?.value ? row.value / (planPairs.find((pair) => pair.label === row.label)?.value || 1) : 0,
    }));
    const weakestPlan = [...planHealth].sort((left, right) => left.value - right.value)[0];
    const healthiestRegion = [...args.healthRows].reduce<Map<string, number[]>>((map, row) => {
        const key = row.region || "Não informado";
        map.set(key, [...(map.get(key) ?? []), row.score]);
        return map;
    }, new Map<string, number[]>());
    const topHealthyRegion = Array.from(healthiestRegion.entries())
        .map(([label, values]) => ({ label, value: average(values) }))
        .sort((left, right) => right.value - left.value)[0];
    const weakestPlanLabel = weakestPlan?.label || "Sem plano";
    const weakestPlanScore = weakestPlan?.value ?? 0;

    return {
        ...meta,
        metrics: [
            metric("Clientes ativos", integer(toNumber(args.dashboardData?.totalActiveCustomers)), "Revendas pagantes em operação.", `${integer(inactiveRows.length)} com baixo acesso`, "emerald"),
            metric("Novos clientes", integer(toNumber(args.dashboardData?.newCustomersInPeriod)), "Entradas registradas no período.", undefined, "sky"),
            metric("Cancelados", integer(toNumber(args.dashboardData?.canceledCustomersInPeriod)), "Saidas confirmadas da base.", undefined, "rose"),
            metric("Taxa de churn", percent(toNumber(args.dashboardData?.churnRate)), "Churn de clientes no recorte filtrado.", undefined, "violet"),
            metric("Permanência média", formatMonthsDuration(toNumber(args.dashboardData?.averageLifetimeMonths)), "Tempo médio de contrato ativo.", undefined, "amber"),
        ],
        alerts: [
            alert(
                "Clientes com risco de cancelamento",
                `${integer(criticalRows.length)} contas estão em faixas mais sensíveis de health score e pedem acompanhamento imediato.`,
                criticalRows.length >= 10 ? "critical" : criticalRows.length >= 4 ? "attention" : "stable",
            ),
            alert(
                "Clientes sem login recente",
                `${integer(inactiveRows.length)} contas não acessam a plataforma há pelo menos 7 dias.`,
                inactiveRows.length >= 15 ? "critical" : inactiveRows.length >= 6 ? "attention" : "stable",
            ),
            alert(
                weakestPlanScore < 40 ? "Plano com saúde crítica" : weakestPlanScore < 55 ? "Plano com saúde em atenção" : "Plano com saúde sustentável",
                `${weakestPlanLabel} hoje carrega health score médio de ${preciseDecimal(weakestPlanScore, 2)} entre os planos filtrados.`,
                weakestPlanScore < 40 ? "critical" : weakestPlanScore < 55 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Clientes por região", "Distribuição geográfica da base ativa.", "bar", regionPairs, {
                name: "Clientes",
                color: "#0f172a",
            }),
            chartFromPairs("Distribuição por estoque", "Segmentação por tamanho de operação.", "column", stockPairs, {
                name: "Clientes",
                color: "#f59e0b",
            }),
            chartFromPairs("Mix por plano", "Peso de cada assinatura na base ativa.", "pie", planPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Health score por faixa", "Classificação atual dos clientes acompanhados.", "bar", healthPairs, {
                name: "Clientes",
                color: "#14b8a6",
            }),
        ],
        statCards: [
            statCard("Sem acesso há 7 dias", integer(inactiveRows.length), "Fila ideal para reativação e CS preventivo."),
            statCard("Health médio", preciseDecimal(healthAverage, 2), "Média consolidada do Customer Health Score."),
            statCard("Clientes críticos", integer(criticalRows.length), "Contas nas faixas mais próximas de cancelamento."),
        ],
        leaderboardTitle: "Clientes que pedem ação",
        leaderboard: formatTopRows(riskyRows, (row) => ({
            name: row.companyName,
            detail: `${row.planName || "Sem plano"} | ${row.region || row.city || "Sem região"}`,
            value: `Score ${integer(row.score)}`,
            badge: row.riskLevel || row.classification,
        })),
        insights: [
            insight("Health score virou radar real", "A tela de clientes agora combina score, último acesso e filtros operacionais em tempo real para retenção.", "positive"),
            insight("Reativação pode ser direcionada", `${integer(inactiveRows.length)} contas já aparecem destacadas pela falta de login recente.`, inactiveRows.length >= 6 ? "warning" : "positive"),
            insight("Existe benchmark interno por região", `${topHealthyRegion?.label || "A base"} lidera saúde média hoje e pode servir de referência para onboarding e CS.`, "positive"),
        ],
    };
}

function buildProductSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.produto;
    const usage = Array.isArray(args.dashboardData?.featureUsage) ? args.dashboardData.featureUsage : [];
    const uniquePairs = usage.map((row: Record<string, any>) => ({
        label: featureLabel(row.featureKey),
        value: toNumber(row.uniqueCustomersCount),
    })).sort((left: Pair, right: Pair) => right.value - left.value);
    const adoptionPairs = usage.map((row: Record<string, any>) => ({
        label: featureLabel(row.featureKey),
        value: toNumber(row.adoptionRate),
    })).sort((left: Pair, right: Pair) => right.value - left.value);
    const totalUsagePairs = usage.map((row: Record<string, any>) => ({
        label: featureLabel(row.featureKey),
        value: toNumber(row.usageCount),
    })).sort((left: Pair, right: Pair) => right.value - left.value);
    const totalUsage = total(totalUsagePairs.map((row) => row.value));
    const underused = adoptionPairs.filter((row) => row.value < 25);
    const topFeature = uniquePairs[0];
    const topFeatureAdoption = adoptionPairs.find((row) => row.label === topFeature?.label)?.value ?? 0;
    const averageAdoption = average(adoptionPairs.map((row) => row.value));

    return {
        ...meta,
        metrics: [
            metric("Veículos cadastrados", integer(toNumber(args.dashboardData?.totalVehicles)), "Total de veículos cadastrados no sistema.", undefined, "emerald"),
            metric("Média por cliente", preciseDecimal(toNumber(args.dashboardData?.averageVehiclesPerCustomer), 2), "Média de veículos nas contas ativas.", undefined, "sky"),
            metric("Anúncios ativos", integer(toNumber(args.dashboardData?.activeMarketplaceAds)), "Anúncios ativos nas plataformas integradas.", undefined, "violet"),
            metric("Integrações ativas", integer(toNumber(args.dashboardData?.activeIntegrations)), "Integrações funcionando no recorte atual.", undefined, "amber"),
        ],
        alerts: [
            alert(
                underused.length >= 4 ? "Features com adoção crítica" : underused.length >= 2 ? "Features subutilizadas em atenção" : "Features com adoção saudável",
                `${integer(underused.length)} funcionalidades ainda operam com adoção abaixo de 25% da base acompanhada.`,
                underused.length >= 4 ? "critical" : underused.length >= 2 ? "attention" : "stable",
            ),
            alert(
                topFeatureAdoption < 25 ? "Feature líder ainda com pouca penetração" : topFeatureAdoption < 45 ? "Feature líder ganhando tração" : "Feature líder consolidada",
                `${topFeature?.label || "Nenhuma feature"} hoje lidera com ${integer(topFeature?.value || 0)} clientes únicos e ${percent(topFeatureAdoption, 2)} de adoção.`,
                topFeatureAdoption < 25 ? "critical" : topFeatureAdoption < 45 ? "attention" : "stable",
            ),
            alert(
                averageAdoption < 20 ? "Adoção média do produto abaixo do ideal" : averageAdoption < 35 ? "Adoção média do produto em evolução" : "Adoção média do produto saudável",
                `A adoção média das features monitoradas está em ${percent(averageAdoption, 2)} no período analisado.`,
                averageAdoption < 20 ? "critical" : averageAdoption < 35 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Clientes únicos por feature", "Aderência por funcionalidade no período.", "bar", uniquePairs, {
                name: "Clientes",
                color: "#6b00e3",
            }),
            chartFromPairs("Adoção por feature", "Percentual de clientes ativos que usam cada funcionalidade.", "column", adoptionPairs, {
                name: "Adoção",
                color: "#14b8a6",
                valueFormat: "percent",
                valueDecimals: 2,
            }),
            chartFromPairs("Uso total por feature", "Volume bruto de interações registradas.", "column", totalUsagePairs, {
                name: "Eventos",
                color: "#0f172a",
            }),
            chartFromPairs("Participação por feature", "Share relativo das funcionalidades mais usadas.", "pie", uniquePairs.slice(0, 6), {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
        ],
        statCards: [
            statCard("Período analisado", `${formatDate(args.dashboardData?.fromDate)} até ${formatDate(args.dashboardData?.toDate)}`, "Recorte usado para medir adoção e uso real."),
            statCard("Feature líder", topFeature?.label || "Sem dados", `${integer(topFeature?.value || 0)} clientes únicos no período.`),
            statCard("Interações registradas", integer(totalUsage), "Soma bruta dos eventos de uso considerados pelo painel."),
        ],
        leaderboardTitle: "Funcionalidades que puxam valor",
        leaderboard: formatTopRows(totalUsagePairs, (row) => ({
            name: row.label,
            detail: `${integer(uniquePairs.find((item) => item.label === row.label)?.value || 0)} clientes únicos`,
            value: integer(row.value),
            badge: `${percent(adoptionPairs.find((item) => item.label === row.label)?.value || 0, 1)} de adoção`,
        })),
        insights: [
            insight("Produto orientado por uso real", "O dashboard deixa claro quais features movimentam a base e quais ainda pedem educação de produto.", "positive"),
            insight("Adoção baixa vira backlog acionável", `${integer(underused.length)} features já aparecem destacadas para onboarding, nudges e revisão de UX.`, underused.length ? "warning" : "positive"),
            insight("Integrações puxam recorrência de uso", "Quando marketplaces e site próprio aparecem no topo, a leitura de valor do produto fica muito mais objetiva.", "positive"),
        ],
    };
}

function buildMarketplaceSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.marketplaces;
    const adsByPlatform = Array.isArray(args.dashboardData?.adsByPlatform) ? args.dashboardData.adsByPlatform : [];
    const salesByPlatform = Array.isArray(args.dashboardData?.salesByPlatform) ? args.dashboardData.salesByPlatform : [];
    const performance = Array.isArray(args.dashboardData?.platformPerformance) ? args.dashboardData.platformPerformance : [];
    const adsPairs = adsByPlatform.map((row: Record<string, any>) => ({ label: platformLabel(row.platform), value: toNumber(row.count) }));
    const salesPairs = salesByPlatform.map((row: Record<string, any>) => ({ label: platformLabel(row.platform), value: toNumber(row.salesCount) }));
    const conversionPairs = performance.map((row: Record<string, any>) => ({ label: platformLabel(row.platform), value: toNumber(row.conversionRate) }));
    const soldValuePairs = performance.map((row: Record<string, any>) => ({ label: platformLabel(row.platform), value: toCurrencyUnitsFromCents(toNumber(row.totalValueCents)) }));
    const totalAds = total(adsPairs.map((row) => row.value));
    const totalLeads = total(performance.map((row: Record<string, any>) => toNumber(row.leadsCount)));
    const totalSales = total(salesPairs.map((row) => row.value));
    const totalValue = total(performance.map((row: Record<string, any>) => toNumber(row.totalValueCents)));
    const weightedConversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
    const topAds = [...adsPairs].sort((left, right) => right.value - left.value)[0];
    const topConversion = [...conversionPairs].sort((left, right) => right.value - left.value)[0];
    const topValue = [...soldValuePairs].sort((left, right) => right.value - left.value)[0];
    const topAdsShare = totalAds > 0 ? ((topAds?.value || 0) / totalAds) * 100 : 0;
    const weakPlatforms = conversionPairs.filter((row) => row.value > 0 && row.value < 5);

    return {
        ...meta,
        metrics: [
            metric("Anúncios ativos", integer(totalAds), "Volume total de anúncios ativos nas plataformas.", undefined, "emerald"),
            metric("Leads nas plataformas", integer(totalLeads), "Leads atribuidos aos canais com performance.", undefined, "sky"),
            metric("Vendas por canal", integer(totalSales), "Vendas fechadas com origem de plataforma informada.", undefined, "violet"),
            metric("Conversão média", percent(weightedConversion), "Conversão ponderada entre leads e vendas.", undefined, "amber"),
            metric("Valor vendido", currency(totalValue), "Receita total vendida pelos canais listados.", undefined, "rose"),
        ],
        alerts: [
            alert(
                topAdsShare >= 75 ? "Dependência crítica de um único canal" : topAdsShare >= 60 ? "Dependência alta de um único canal" : "Mix de canais equilibrado",
                `${topAds?.label || "A principal plataforma"} concentra ${percent(topAdsShare, 2)} dos anúncios ativos monitorados.`,
                topAdsShare >= 75 ? "critical" : topAdsShare >= 60 ? "attention" : "stable",
            ),
            alert(
                weakPlatforms.length >= 2 ? "Plataformas com conversão crítica" : weakPlatforms.length ? "Plataformas com baixa conversão" : "Conversão sem gargalos graves",
                weakPlatforms.length
                    ? `${weakPlatforms.map((row) => row.label).join(", ")} hoje operam abaixo de 5% de conversão.`
                    : "Não há plataformas com conversão crítica entre as que possuem leads registrados.",
                weakPlatforms.length >= 2 ? "critical" : weakPlatforms.length ? "attention" : "stable",
            ),
            alert(
                weightedConversion < 5 ? "Conversão média dos canais pressionada" : weightedConversion < 10 ? "Conversão média dos canais em atenção" : "Conversão média dos canais saudável",
                `Os canais somam ${integer(totalSales)} vendas sobre ${integer(totalLeads)} leads, com conversão consolidada de ${percent(weightedConversion, 2)}.`,
                weightedConversion < 5 ? "critical" : weightedConversion < 10 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Anúncios por plataforma", "Base ativa de anúncios por canal.", "column", adsPairs, {
                name: "Anúncios",
                color: "#6b00e3",
            }),
            chartFromPairs("Vendas por plataforma", "Volume de negócios fechados por canal.", "column", salesPairs, {
                name: "Vendas",
                color: "#14b8a6",
            }),
            chartFromPairs("Conversão por plataforma", "Leads convertidos em venda por canal.", "bar", conversionPairs, {
                name: "Conversão",
                color: "#f59e0b",
                valueFormat: "percent",
                valueDecimals: 2,
            }),
            chartFromPairs("Valor vendido por plataforma", "Receita vendida por canal no período.", "bar", soldValuePairs, {
                name: "Valor vendido",
                color: "#0f172a",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
        ],
        statCards: [
            statCard("Canal com mais anúncios", topAds?.label || "Sem dados", `${integer(topAds?.value || 0)} anúncios ativos no recorte.`),
            statCard("Melhor conversão", topConversion?.label || "Sem dados", `${percent(topConversion?.value || 0, 2)} de conversão.`),
            statCard("Maior valor vendido", topValue?.label || "Sem dados", `${(topValue?.value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 })} vendidos.`),
        ],
        leaderboardTitle: "Plataformas de maior impacto",
        leaderboard: formatTopRows(
            [...performance].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(right.totalValueCents) - toNumber(left.totalValueCents)),
            (row: Record<string, any>) => ({
                name: platformLabel(row.platform),
                detail: `${integer(toNumber(row.leadsCount))} leads | ${integer(toNumber(row.salesCount))} vendas`,
                value: currency(toNumber(row.totalValueCents)),
                badge: percent(toNumber(row.conversionRate), 1),
            }),
        ),
        insights: [
            insight("Marketplaces viraram vantagem mensurável", "O painel diferencia claramente volume, eficiência e valor vendido por canal.", "positive"),
            insight("Concentração de anúncios precisa ser saudável", `${topAds?.label || "O principal canal"} hoje lidera a distribuição e merece monitoramento de dependência.`, topAdsShare >= 60 ? "warning" : "positive"),
            insight("ROI por canal está mais próximo", "Com leads, vendas e valor vendido por plataforma, a base para evoluir para ROI já está montada.", "positive"),
        ],
    };
}

function buildGrowthSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.crescimento;
    const leadsByOrigin = Array.isArray(args.dashboardData?.leadsByOrigin) ? args.dashboardData.leadsByOrigin : [];
    const customerOrigins = Array.isArray(args.dashboardData?.customerOrigins) ? args.dashboardData.customerOrigins : [];
    const leadPairs = leadsByOrigin.map((row: Record<string, any>) => ({ label: originLabel(row.origin), value: toNumber(row.total) })).sort((left: Pair, right: Pair) => right.value - left.value);
    const customerPairs = customerOrigins.map((row: Record<string, any>) => ({ label: originLabel(row.origin), value: toNumber(row.total) })).sort((left: Pair, right: Pair) => right.value - left.value);
    const leadsGenerated = toNumber(args.dashboardData?.leadsGenerated);
    const closedSales = toNumber(args.dashboardData?.closedSales);
    const conversionRate = toNumber(args.dashboardData?.conversionRate);
    const topLeadOrigin = leadPairs[0];
    const topLeadOriginShare = leadsGenerated > 0 ? ((topLeadOrigin?.value || 0) / leadsGenerated) * 100 : 0;
    const openLeadBacklog = Math.max(leadsGenerated - closedSales, 0);
    const openLeadBacklogRate = leadsGenerated > 0 ? (openLeadBacklog / leadsGenerated) * 100 : 0;
    const sellerLinkedLeads = args.catalogLeads.filter((lead) => Boolean(lead.sellerName)).length;
    const groupedOriginLabels = Array.from(new Set([...leadPairs, ...customerPairs].map((row) => row.label)));

    return {
        ...meta,
        metrics: [
            metric("Leads gerados", integer(leadsGenerated), "Leads vindos da página de catálogo.", undefined, "emerald"),
            metric("Vendas fechadas", integer(closedSales), "Vendas atribuidas ao recorte atual.", undefined, "sky"),
            metric("Taxa de conversão", percent(conversionRate), "Relação entre leads e vendas fechadas.", undefined, "violet"),
        ],
        alerts: [
            alert(
                conversionRate < 5 ? "Conversão abaixo do ideal" : conversionRate < 8 ? "Conversão em atenção" : "Conversão em faixa saudável",
                `A taxa atual está em ${percent(conversionRate, 2)} para ${integer(leadsGenerated)} leads gerados no recorte.`,
                conversionRate < 5 ? "critical" : conversionRate < 8 ? "attention" : "stable",
            ),
            alert(
                topLeadOriginShare >= 75 ? "Origem excessivamente dominante" : topLeadOriginShare >= 60 ? "Origem dominante na aquisição" : "Mix de origem bem distribuído",
                `${topLeadOrigin?.label || "A principal origem"} responde por ${percent(topLeadOriginShare, 2)} dos leads gerados.`,
                topLeadOriginShare >= 75 ? "critical" : topLeadOriginShare >= 60 ? "attention" : "stable",
            ),
            alert(
                openLeadBacklogRate >= 70 ? "Backlog comercial alto" : openLeadBacklogRate >= 45 ? "Backlog comercial em atenção" : "Backlog comercial controlado",
                `${integer(openLeadBacklog)} leads ainda não viraram venda, o equivalente a ${percent(openLeadBacklogRate, 2)} da captação do período.`,
                openLeadBacklogRate >= 70 ? "critical" : openLeadBacklogRate >= 45 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Leads por origem", "Canais que mais geram demanda.", "column", leadPairs, {
                name: "Leads",
                color: "#6b00e3",
            }),
            chartFromPairs("Origem dos clientes", "Canais que mais convertem em clientes.", "pie", customerPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Funil resumido", "Comparativo entre captação e fechamento.", "column", [
                { label: "Leads", value: leadsGenerated },
                { label: "Vendas", value: closedSales },
            ], {
                name: "Volume",
                color: "#14b8a6",
            }),
            {
                title: "Leads vs clientes por origem",
                subtitle: "Comparação direta entre atração e assinatura.",
                type: "column",
                categories: groupedOriginLabels.length ? groupedOriginLabels : ["Sem dados"],
                series: [
                    {
                        name: "Leads",
                        data: (groupedOriginLabels.length ? groupedOriginLabels : ["Sem dados"]).map((label) => leadPairs.find((row) => row.label === label)?.value ?? 0),
                        color: "#0f172a",
                    },
                    {
                        name: "Clientes",
                        data: (groupedOriginLabels.length ? groupedOriginLabels : ["Sem dados"]).map((label) => customerPairs.find((row) => row.label === label)?.value ?? 0),
                        color: "#38bdf8",
                    },
                ],
            },
        ],
        statCards: [
            statCard("Leads em aberto", integer(openLeadBacklog), "Volume que ainda não virou venda dentro do recorte atual."),
            statCard("Origens ativas", integer(leadPairs.length), "Quantidade de canais aparecendo na aquisição."),
            statCard("Leads com vendedor", integer(sellerLinkedLeads), "Demandas capturadas por links de vendedor."),
        ],
        leaderboardTitle: "Origens com mais tração",
        leaderboard: formatTopRows(leadPairs, (row) => ({
            name: row.label,
            detail: `${integer(customerPairs.find((item) => item.label === row.label)?.value || 0)} clientes originados`,
            value: integer(row.value),
            badge: percent(leadsGenerated ? (row.value / leadsGenerated) * 100 : 0, 1),
        })),
        insights: [
            insight("Aquisição e retenção passam a conversar", "Leads, vendas e origem de cliente agora ficam no mesmo painel executivo.", "positive"),
            insight("Mix de origem influencia escala", `${topLeadOrigin?.label || "A principal origem"} lidera a captação e pode orientar investimento e parcerias.`, topLeadOriginShare >= 60 ? "warning" : "positive"),
            insight("Leitura de crescimento ficou mais objetiva", "A tela foca no que já está medido hoje: leads, vendas, conversão e origem da aquisição.", "positive"),
        ],
    };
}

function buildBillingSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.cobranca;
    const cards = args.dashboardData?.cards ?? {};
    const overdueCustomers = Array.isArray(args.dashboardData?.overdueCustomers) ? args.dashboardData.overdueCustomers : [];
    const overduePairs = overdueCustomers
        .map((row: Record<string, any>) => ({
            label: row.companyName || "Empresa",
            value: toCurrencyUnitsFromCents(toNumber(row.overdueAmountCents)),
        }))
        .sort((left: Pair, right: Pair) => right.value - left.value)
        .slice(0, 6);
    const planPairs = topPairs(overdueCustomers, (row: Record<string, any>) => row.planName || "Sem plano", (row: Record<string, any>) => toCurrencyUnitsFromCents(toNumber(row.overdueAmountCents)));
    const statusPairs = topPairs(overdueCustomers, (row: Record<string, any>) => titleCase(row.billingStatus) || "Não informado", () => 1);
    const agingPairs = [
        { label: "Até 7 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) <= 7).length },
        { label: "8 a 15 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 7 && toNumber(row.delayDays) <= 15).length },
        { label: "16 a 30 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 15 && toNumber(row.delayDays) <= 30).length },
        { label: "30+ dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 30).length },
    ];
    const largestDebt = [...overdueCustomers].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(right.overdueAmountCents) - toNumber(left.overdueAmountCents))[0];
    const criticalDelay = overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 10);
    const recoverableRevenue = total(overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) <= 7).map((row: Record<string, any>) => toNumber(row.overdueAmountCents)));
    const paymentFailureRate = toNumber(cards.paymentFailureRate);
    const averageDelay = toNumber(cards.averageDelayDays);
    const criticalDelayShare = overdueCustomers.length > 0 ? (criticalDelay.length / overdueCustomers.length) * 100 : 0;

    return {
        ...meta,
        metrics: [
            metric("Clientes inadimplentes", integer(toNumber(cards.overdueCustomers)), "Clientes com cobrança em atraso.", undefined, "emerald"),
            metric("Receita em atraso", currency(toNumber(cards.overdueRevenueCents)), "Valor total vencido no recorte filtrado.", undefined, "rose"),
            metric("Atraso médio", `${preciseDecimal(averageDelay, 2)} dias`, "Tempo médio de atraso das cobranças vencidas.", undefined, "amber"),
            metric("Falha de pagamento", percent(paymentFailureRate), "Taxa consolidada de falha em cobrança.", undefined, "violet"),
        ],
        alerts: [
            alert(
                paymentFailureRate >= 8 ? "Cartões recusados acima do ideal" : "Falhas de pagamento em controle",
                `A taxa atual de falha está em ${percent(paymentFailureRate, 2)}.`,
                paymentFailureRate >= 8 ? "critical" : paymentFailureRate >= 4 ? "attention" : "stable",
            ),
            alert(
                averageDelay >= 10 ? "Boletos vencidos em excesso" : "Atraso médio sob monitoramento",
                `O atraso médio atual está em ${preciseDecimal(averageDelay, 2)} dias na carteira filtrada.`,
                averageDelay >= 10 ? "critical" : averageDelay >= 6 ? "attention" : "stable",
            ),
            alert(
                criticalDelayShare >= 40 ? "Carteira crítica concentrada em atrasos longos" : criticalDelayShare >= 20 ? "Carteira crítica em observação" : "Carteira crítica sob controle",
                `${integer(criticalDelay.length)} clientes já passaram de 10 dias de atraso, representando ${percent(criticalDelayShare, 2)} da carteira inadimplente.`,
                criticalDelayShare >= 40 ? "critical" : criticalDelayShare >= 20 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Aging da carteira", "Distribuição da inadimplência por faixa de atraso.", "column", agingPairs, {
                name: "Clientes",
                color: "#f59e0b",
            }),
            chartFromPairs("Receita em atraso por plano", "Peso da inadimplência em cada assinatura.", "bar", planPairs, {
                name: "Receita em atraso",
                color: "#6b00e3",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
            chartFromPairs("Status de cobrança", "Carteira agrupada por billing status.", "pie", statusPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Maiores valores em atraso", "Contas que mais pressionam a carteira.", "bar", overduePairs, {
                name: "Receita em atraso",
                color: "#0f172a",
                valueFormat: "currency",
                valueDecimals: 2,
            }),
        ],
        statCards: [
            statCard("Maior conta em atraso", largestDebt?.companyName || "Sem dados", largestDebt ? currency(toNumber(largestDebt.overdueAmountCents)) : "R$ 0,00"),
            statCard("Carteira crítica", integer(criticalDelay.length), "Clientes com mais de 10 dias de atraso."),
            statCard("Receita recuperável em 7 dias", currency(recoverableRevenue), "Valor em atraso concentrado nas cobranças mais recentes."),
        ],
        leaderboardTitle: "Contas que exigem ação",
        leaderboard: formatTopRows(
            [...overdueCustomers].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(right.overdueAmountCents) - toNumber(left.overdueAmountCents)),
            (row: Record<string, any>) => ({
                name: row.companyName,
                detail: `${row.planName || "Sem plano"} | ${titleCase(row.billingStatus)}`,
                value: currency(toNumber(row.overdueAmountCents)),
                badge: `${preciseDecimal(toNumber(row.delayDays), 2)} dias`,
            }),
        ),
        insights: [
            insight("Cobrança ficou operacional", "Os alertas agora mostram atraso, falha de pagamento e concentração da carteira usando dados reais.", "positive"),
            insight("Recuperação pode ser priorizada", `${integer(criticalDelay.length)} contas já entram automaticamente na faixa de maior pressão.`, criticalDelay.length ? "warning" : "positive"),
            insight("Planos mais sensíveis ficam visíveis", "O gráfico por plano ajuda a entender onde a inadimplência está pesando mais na base.", "positive"),
        ],
    };
}

function buildOperationsSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.operacional;
    const cards = args.dashboardData?.cards ?? {};
    const bugsByArea = Array.isArray(args.dashboardData?.bugsByArea) ? args.dashboardData.bugsByArea : [];
    const bugPairs = bugsByArea.map((row: Record<string, any>) => ({
        label: row.bugArea || "Não informado",
        value: toNumber(row.total),
    })).sort((left: Pair, right: Pair) => right.value - left.value);
    const statusPairs = topPairs(args.supportTickets, (row) => titleCase(row.status), () => 1);
    const urgencyPairs = topPairs(args.supportTickets, (row) => titleCase(row.urgency), () => 1);
    const companyPairs = topPairs(args.supportTickets, (row) => row.companyName, () => 1);
    const waitingCustomer = args.supportTickets.filter((row) => row.status === "WAITING_CUSTOMER").length;
    const highUrgency = args.supportTickets.filter((row) => row.urgency === "HIGH" || row.urgency === "CRITICAL").length;
    const openBacklog = args.supportTickets.filter((row) => !["RESOLVED", "CLOSED"].includes(row.status)).length;
    const oldestOpen = [...args.supportTickets]
        .filter((row) => !["RESOLVED", "CLOSED"].includes(row.status))
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())[0];
    const responseMinutes = toNumber(cards.averageFirstResponseMinutes);
    const resolutionHours = toNumber(cards.averageResolutionHours);

    return {
        ...meta,
        metrics: [
            metric("Tickets abertos", integer(toNumber(cards.openTickets)), "Fila aberta de suporte no momento.", undefined, "emerald"),
            metric("Resposta média", formatMinutesDuration(responseMinutes), "Tempo médio até a primeira resposta.", undefined, "sky"),
            metric("Resolução média", formatHoursDuration(resolutionHours), "Tempo médio até a conclusão do ticket.", undefined, "amber"),
            metric("Bugs reportados", integer(toNumber(cards.bugsReported)), "Tickets categorizados como bug.", undefined, "rose"),
        ],
        alerts: [
            alert(
                toNumber(cards.bugsReported) >= 8 ? "Bugs reportados acima do normal" : "Fila de bugs administrável",
                `${integer(toNumber(cards.bugsReported))} bugs foram reportados no recorte atual.`,
                toNumber(cards.bugsReported) >= 8 ? "critical" : toNumber(cards.bugsReported) >= 4 ? "attention" : "stable",
            ),
            alert(
                responseMinutes > 30 ? "Tempo de primeira resposta lento" : "Primeira resposta em faixa saudável",
                `O tempo médio atual está em ${formatMinutesDuration(responseMinutes)}.`,
                responseMinutes > 30 ? "critical" : responseMinutes > 20 ? "attention" : "stable",
            ),
            alert(
                resolutionHours > 8 || highUrgency >= 4 ? "Resolução do suporte pressionada" : resolutionHours > 6 || highUrgency >= 2 ? "Resolução do suporte em atenção" : "Resolução do suporte saudável",
                `A resolução média está em ${formatHoursDuration(resolutionHours)} e há ${integer(highUrgency)} tickets de alta urgência na fila.`,
                resolutionHours > 8 || highUrgency >= 4 ? "critical" : resolutionHours > 6 || highUrgency >= 2 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Bugs por categoria", "áreas onde os bugs estão concentrados.", "bar", bugPairs, {
                name: "Bugs",
                color: "#ef4444",
            }),
            chartFromPairs("Tickets por status", "Distribuição da fila operacional.", "pie", statusPairs, {
                name: "Tickets",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Urgência dos tickets", "Peso de severidade na fila atual.", "column", urgencyPairs, {
                name: "Tickets",
                color: "#f59e0b",
            }),
            chartFromPairs("Empresas com mais tickets", "Contas que mais acionaram o suporte no recorte.", "bar", companyPairs, {
                name: "Tickets",
                color: "#0f172a",
            }),
        ],
        statCards: [
            statCard("Aguardando cliente", integer(waitingCustomer), "Tickets pendentes de retorno da conta atendida."),
            statCard("Alta urgência", integer(highUrgency), "Chamados classificados como high ou critical."),
            statCard("Backlog aberto", integer(openBacklog), oldestOpen ? `Ticket mais antigo aberto em ${new Date(oldestOpen.createdAt).toLocaleDateString("pt-BR")}.` : "Nenhum ticket em aberto."),
        ],
        leaderboardTitle: "Contas mais ativas no suporte",
        leaderboard: formatTopRows(companyPairs, (row) => ({
            name: row.label,
            detail: "Tickets registrados no recorte atual",
            value: integer(row.value),
            badge: row.value >= 3 ? "Acompanhar" : "Normal",
        })),
        insights: [
            insight("Operação e suporte falam a mesma língua", "Os mesmos tickets alimentam os cards executivos, os gráficos e a mesa operacional detalhada.", "positive"),
            insight("Urgência não fica escondida", `${integer(highUrgency)} tickets de alta urgência já aparecem resumidos antes mesmo da leitura individual.`, highUrgency ? "warning" : "positive"),
            insight("Bugs por área viram prioridade objetiva", "Quando a categoria de bug se repete, a equipe já consegue enxergar a concentração direto no topo da tela.", "positive"),
        ],
    };
}

function buildInsightsSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.insights;
    const riskCustomers = Array.isArray(args.dashboardData?.cancellationRiskCustomers) ? args.dashboardData.cancellationRiskCustomers : [];
    const upgradeCustomers = Array.isArray(args.dashboardData?.upgradeReadyCustomers) ? args.dashboardData.upgradeReadyCustomers : [];
    const potentialCustomers = Array.isArray(args.dashboardData?.highRevenuePotentialCustomers) ? args.dashboardData.highRevenuePotentialCustomers : [];
    const underusedFeatures = Array.isArray(args.dashboardData?.underusedFeatures) ? args.dashboardData.underusedFeatures : [];
    const riskPairs = topPairs(riskCustomers, (row: Record<string, any>) => row.riskLevel || row.classification || "Risco", () => 1);
    const upgradePairs = upgradeCustomers
        .map((row: Record<string, any>) => ({ label: row.companyName, value: toNumber(row.usagePressurePercent) }))
        .sort((left: Pair, right: Pair) => right.value - left.value)
        .slice(0, 6);
    const potentialPairs = potentialCustomers
        .map((row: Record<string, any>) => ({ label: row.companyName, value: toNumber(row.potentialScore) }))
        .sort((left: Pair, right: Pair) => right.value - left.value)
        .slice(0, 6);
    const underusedPairs = underusedFeatures
        .map((row: Record<string, any>) => ({ label: featureLabel(row.featureKey), value: toNumber(row.adoptionRate) }))
        .sort((left: Pair, right: Pair) => left.value - right.value);
    const averageRiskScore = average(riskCustomers.map((row: Record<string, any>) => toNumber(row.score)));
    const averagePressure = average(upgradeCustomers.map((row: Record<string, any>) => toNumber(row.usagePressurePercent)));
    const topPotentialSoldValue = total(potentialCustomers.slice(0, 5).map((row: Record<string, any>) => toNumber(row.soldValueCents90d)));
    const overdueRisk = riskCustomers.filter((row: Record<string, any>) => Boolean(row.overdueStatus)).length;
    const weakestFeatureAdoption = underusedPairs[0]?.value ?? 100;

    return {
        ...meta,
        metrics: [
            metric("Risco alto de churn", integer(riskCustomers.length), "Contas mais próximas de cancelamento.", undefined, "rose"),
            metric("Prontas para upgrade", integer(upgradeCustomers.length), "Contas perto do limite atual do plano.", undefined, "emerald"),
            metric("Alto potencial", integer(potentialCustomers.length), "Clientes com maior chance de expandir faturamento.", undefined, "sky"),
            metric("Features subutilizadas", integer(underusedFeatures.length), "Funcionalidades com baixa adoção na base.", undefined, "amber"),
        ],
        alerts: [
            alert(
                riskCustomers.length >= 10 ? "Fila relevante de churn previsível" : "Churn previsível em controle",
                `${integer(riskCustomers.length)} contas aparecem no radar de cancelamento com base em health score e comportamento.`,
                riskCustomers.length >= 10 ? "critical" : riskCustomers.length >= 5 ? "attention" : "stable",
            ),
            alert(
                upgradeCustomers.length ? "Oportunidade clara de expansão" : "Poucas contas prontas para upgrade",
                `${integer(upgradeCustomers.length)} contas já estão próximas dos limites do plano atual.`,
                upgradeCustomers.length >= 5 ? "stable" : "attention",
            ),
            alert(
                underusedFeatures.length >= 4 || weakestFeatureAdoption < 10
                    ? "Subutilização de features já afeta expansão"
                    : underusedFeatures.length >= 2 || weakestFeatureAdoption < 20
                        ? "Subutilização de features em atenção"
                        : "Subutilização de features controlada",
                `${integer(underusedFeatures.length)} funcionalidades aparecem com baixa adoção, e a menor taxa atual está em ${percent(weakestFeatureAdoption, 2)}.`,
                underusedFeatures.length >= 4 || weakestFeatureAdoption < 10
                    ? "critical"
                    : underusedFeatures.length >= 2 || weakestFeatureAdoption < 20
                        ? "attention"
                        : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Distribuição de risco", "Como a base se reparte entre as faixas de risco.", "pie", riskPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Clientes prontos para upgrade", "Pressão de uso das contas mais próximas de expansão.", "bar", upgradePairs, {
                name: "Pressão",
                color: "#14b8a6",
                valueFormat: "percent",
                valueDecimals: 2,
            }),
            chartFromPairs("Potencial de faturamento", "Score das contas com maior chance de expandir resultado.", "bar", potentialPairs, {
                name: "Score",
                color: "#6b00e3",
            }),
            chartFromPairs("Features subutilizadas", "Adoção percentual das funcionalidades com menor uso.", "column", underusedPairs, {
                name: "Adoção",
                color: "#f59e0b",
                valueFormat: "percent",
                valueDecimals: 2,
            }),
        ],
        statCards: [
            statCard("Score médio de risco", preciseDecimal(averageRiskScore, 2), "Média dos clientes presentes no radar de churn."),
            statCard("Pressão média de upgrade", percent(averagePressure, 2), "Quanto as contas prontas já pressionam o plano atual."),
            statCard("Valor vendido das top oportunidades", currency(topPotentialSoldValue), "Soma das vendas 90d das cinco contas com maior potencial."),
        ],
        leaderboardTitle: "Clientes que merecem prioridade",
        leaderboard: formatTopRows(
            [...riskCustomers].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(left.score) - toNumber(right.score)),
            (row: Record<string, any>) => ({
                name: row.companyName,
                detail: row.planName || "Sem plano",
                value: `Score ${integer(toNumber(row.score))}`,
                badge: row.riskLevel || row.classification,
            }),
        ),
        insights: [
            insight("Churn previsível ganhou contexto", `${integer(overdueRisk)} contas de risco também estão em situação de atraso, ligando saúde e cobrança.`, overdueRisk ? "warning" : "positive"),
            insight("Upgrade vira fila comercial", "As contas com maior pressão de uso já aparecem prontas para outreach de expansão.", "positive"),
            insight("Subutilização deixa de ser invisível", "As funcionalidades menos adotadas agora aparecem com taxa percentual real para orientar onboarding e produto.", "positive"),
        ],
    };
}

export function buildSuperAdminVisualSection(args: BuildArgs): SuperAdminSection {
    switch (args.section) {
        case "financeiro":
            return buildFinanceSection(args);
        case "clientes":
            return buildCustomersSection(args);
        case "produto":
            return buildProductSection(args);
        case "marketplaces":
            return buildMarketplaceSection(args);
        case "crescimento":
            return buildGrowthSection(args);
        case "cobranca":
            return buildBillingSection(args);
        case "operacional":
            return buildOperationsSection(args);
        case "insights":
        default:
            return buildInsightsSection(args);
    }
}
