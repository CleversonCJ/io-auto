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

function currency(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format((cents || 0) / 100);
}

function percent(value: number, digits = 2) {
    return `${decimal(value, digits)}%`;
}

function signedPercent(value: number, digits = 1) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${decimal(value, digits)}%`;
}

function changeRate(current: number, previous: number) {
    if (!previous) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

function monthLabel(value?: string | null) {
    if (!value) return "Periodo";

    const isoMonth = /^(\d{4})-(\d{2})$/;
    const match = value.match(isoMonth);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
        return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    }

    return value;
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
    if (normalized.includes("MARKET")) return "Integracao com marketplaces";
    if (normalized.includes("SITE") || normalized.includes("WEBSITE")) return "Site proprio";
    if (normalized.includes("FINANC")) return "Financeiro";
    if (normalized.includes("REPORT")) return "Relatorios";
    if (normalized.includes("LEAD")) return "Leads";
    if (normalized.includes("STOCK") || normalized.includes("INVENT")) return "Estoque";
    return titleCase(normalized);
}

function platformLabel(value?: string | null) {
    const normalized = (value || "").trim();
    if (!normalized) return "Nao informado";
    if (normalized.toUpperCase() === "MERCADO_LIVRE") return "Mercado Livre";
    return titleCase(normalized);
}

function originLabel(value?: string | null) {
    const normalized = (value || "").trim().toLowerCase();
    if (!normalized) return "Nao informado";
    if (normalized.includes("indic")) return "Indicacao";
    if (normalized.includes("pago") || normalized.includes("ads") || normalized.includes("meta") || normalized.includes("google")) return "Trafego pago";
    if (normalized.includes("organ")) return "Organico";
    if (normalized.includes("parce")) return "Parceiros";
    if (normalized.includes("seller")) return "Link do vendedor";
    return titleCase(normalized.replace(/[-_]+/g, " "));
}

function stockBucket(count?: number | null) {
    const total = toNumber(count);
    if (total <= 20) return "Ate 20";
    if (total <= 50) return "20 a 50";
    return "50+";
}

function activeCustomerStatus(status?: string | null) {
    return ["ACTIVE", "TRIAL", "OVERDUE"].includes((status || "").toUpperCase());
}

function revenueCustomerStatus(status?: string | null) {
    return ["ACTIVE", "TRIAL", "OVERDUE", "BLOCKED"].includes((status || "").toUpperCase());
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
        valuePrefix?: string;
        valueSuffix?: string;
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
        pieColors: options?.pieColors,
        valuePrefix: options?.valuePrefix,
        valueSuffix: options?.valueSuffix,
    };
}

function toThousandsFromCents(value: number) {
    return value / 100_000;
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
    const revenueByPlan = topPairs(revenueRows, (row) => planLabel(row), (row) => toThousandsFromCents(toNumber(row.mrrCents)));
    const revenueByRegion = topPairs(revenueRows, (row) => row.region || "Nao informado", (row) => toThousandsFromCents(toNumber(row.mrrCents)));
    const revenueByStock = topPairs(revenueRows, (row) => stockBucket(row.stockCount), (row) => toThousandsFromCents(toNumber(row.mrrCents)));
    const annualCustomers = revenueRows.filter((row) => (row.billingRecurrence || "").toUpperCase() === "ANNUAL");
    const totalLostMrr = total(chartRows.map((row: Record<string, any>) => toNumber(row.lostMrrCents)));
    const averageChurn = average(chartRows.map((row: Record<string, any>) => toNumber(row.churnRate)));

    return {
        ...meta,
        metrics: [
            metric("MRR", currency(currentMrr), "Receita recorrente mensal consolidada.", signedPercent(mrrDelta), "emerald"),
            metric("ARR", currency(toNumber(cards.arrCents)), "Receita anual projetada da carteira.", undefined, "sky"),
            metric("Ticket medio", currency(toNumber(cards.averageTicketCents)), "Media mensal por cliente pagante.", undefined, "violet"),
            metric("LTV", currency(toNumber(cards.ltvCents)), "Valor de vida calculado pela permanencia media.", undefined, "amber"),
            metric("Churn financeiro", percent(toNumber(cards.financialChurnRate)), "Receita perdida por cancelamentos no periodo.", undefined, "rose"),
        ],
        alerts: [
            alert(
                mrrDelta < 0 ? "Queda de MRR detectada" : "MRR em trajetoria positiva",
                mrrDelta < 0
                    ? `O MRR atual recuou ${percent(Math.abs(mrrDelta), 1)} frente ao fechamento anterior.`
                    : `O MRR atual cresceu ${percent(mrrDelta, 1)} frente ao fechamento anterior.`,
                mrrDelta < 0 ? "critical" : mrrDelta < 5 ? "attention" : "stable",
            ),
            alert(
                overdueRatio >= 8 ? "Inadimplencia pressionando caixa" : "Inadimplencia monitorada",
                `Ha ${integer(overdueCustomers)} clientes com ${currency(overdueRevenue)} em atraso, equivalente a ${percent(overdueRatio, 1)} do MRR atual.`,
                overdueRatio >= 8 ? "critical" : overdueRatio >= 4 ? "attention" : "stable",
            ),
            alert(
                currentChurn >= 3 ? "Cancelamentos do mes acima do ideal" : "Cancelamentos dentro da faixa",
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
                    value: toThousandsFromCents(toNumber(row.totalMrrCents)),
                }))).map((row) => row.label),
                series: [
                    {
                        name: "MRR",
                        data: fallbackPairs(chartRows.map((row: Record<string, any>) => ({
                            label: monthLabel(row.month),
                            value: toThousandsFromCents(toNumber(row.totalMrrCents)),
                        }))).map((row) => Number(row.value.toFixed(2))),
                        color: "#6b00e3",
                    },
                    {
                        name: "MRR perdido",
                        data: fallbackPairs(chartRows.map((row: Record<string, any>) => ({
                            label: monthLabel(row.month),
                            value: toThousandsFromCents(toNumber(row.lostMrrCents)),
                        }))).map((row) => Number(row.value.toFixed(2))),
                        color: "#ef4444",
                    },
                ],
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            },
            chartFromPairs("Receita por plano", "MRR agrupado pela assinatura ativa.", "column", revenueByPlan, {
                name: "Receita",
                color: "#0f172a",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
            chartFromPairs("Receita por regiao", "Concentracao geografica da carteira.", "bar", revenueByRegion, {
                name: "Receita",
                color: "#14b8a6",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
            chartFromPairs("MRR por porte da revenda", "Leitura de pricing por tamanho do estoque.", "column", revenueByStock, {
                name: "MRR",
                color: "#f59e0b",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
        ],
        statCards: [
            statCard("Receita em atraso", currency(overdueRevenue), `${integer(overdueCustomers)} clientes com cobranca pendente.`),
            statCard("MRR perdido no ano", currency(totalLostMrr), `Churn medio de ${percent(averageChurn, 2)} no recorte anual.`),
            statCard("Assinaturas anuais", integer(annualCustomers.length), `${percent(revenueRows.length ? (annualCustomers.length / revenueRows.length) * 100 : 0, 1)} da carteira com recorrencia anual.`),
        ],
        leaderboardTitle: "Blocos com maior retorno",
        leaderboard: [
            ...(revenueByPlan[0] ? [{ name: revenueByPlan[0].label, detail: "Plano com maior MRR", value: `R$ ${decimal(revenueByPlan[0].value, 1)} mil`, badge: "Plano lider" }] : []),
            ...(revenueByRegion[0] ? [{ name: revenueByRegion[0].label, detail: "Regiao que mais concentra receita", value: `R$ ${decimal(revenueByRegion[0].value, 1)} mil`, badge: "Maior concentracao" }] : []),
            ...(revenueByStock[0] ? [{ name: revenueByStock[0].label, detail: "Faixa de estoque dominante", value: `R$ ${decimal(revenueByStock[0].value, 1)} mil`, badge: "Base de pricing" }] : []),
        ],
        insights: [
            insight("Pricing guiado por porte", `A faixa ${revenueByStock[0]?.label || "principal"} concentra a maior parte do MRR e deve liderar ajustes de valor e limites.`, "positive"),
            insight("Cobranca impacta visao de caixa", `A carteira em atraso ja equivale a ${percent(overdueRatio, 1)} do MRR atual.`, overdueRatio >= 4 ? "warning" : "positive"),
            insight("Churn deixou rastro mensuravel", `O painel financeiro agora mostra mes a mes quanto de receita se perde com cancelamentos, sem precisar de consolidacao manual.`, "positive"),
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
    const regionPairs = topPairs(activeRows, (row) => row.region || "Nao informado", () => 1);
    const stockPairs = topPairs(activeRows, (row) => stockBucket(row.stockCount), () => 1);
    const planPairs = topPairs(activeRows, (row) => planLabel(row), () => 1);
    const healthPairs = topPairs(args.healthRows, (row) => row.classification || "Sem classificacao", () => 1);
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
        const key = row.region || "Nao informado";
        map.set(key, [...(map.get(key) ?? []), row.score]);
        return map;
    }, new Map<string, number[]>());
    const topHealthyRegion = Array.from(healthiestRegion.entries())
        .map(([label, values]) => ({ label, value: average(values) }))
        .sort((left, right) => right.value - left.value)[0];

    return {
        ...meta,
        metrics: [
            metric("Clientes ativos", integer(toNumber(args.dashboardData?.totalActiveCustomers)), "Revendas pagantes em operacao.", `${integer(inactiveRows.length)} com baixo acesso`, "emerald"),
            metric("Novos clientes", integer(toNumber(args.dashboardData?.newCustomersInPeriod)), "Entradas registradas no periodo.", undefined, "sky"),
            metric("Cancelados", integer(toNumber(args.dashboardData?.canceledCustomersInPeriod)), "Saidas confirmadas da base.", undefined, "rose"),
            metric("Taxa de churn", percent(toNumber(args.dashboardData?.churnRate)), "Churn de clientes no recorte filtrado.", undefined, "violet"),
            metric("Permanencia media", `${decimal(toNumber(args.dashboardData?.averageLifetimeMonths), 1)} meses`, "Tempo medio de contrato ativo.", undefined, "amber"),
        ],
        alerts: [
            alert(
                "Clientes com risco de cancelamento",
                `${integer(criticalRows.length)} contas estao em faixas mais sensiveis de health score e pedem acompanhamento imediato.`,
                criticalRows.length >= 10 ? "critical" : criticalRows.length >= 4 ? "attention" : "stable",
            ),
            alert(
                "Clientes sem login recente",
                `${integer(inactiveRows.length)} contas nao acessam a plataforma ha pelo menos 7 dias.`,
                inactiveRows.length >= 15 ? "critical" : inactiveRows.length >= 6 ? "attention" : "stable",
            ),
            alert(
                "Plano com menor saude media",
                `${weakestPlan?.label || "Sem plano"} hoje carrega a menor media de health score entre os planos filtrados.`,
                weakestPlan && weakestPlan.value < 50 ? "attention" : "stable",
            ),
        ],
        charts: [
            chartFromPairs("Clientes por regiao", "Distribuicao geografica da base ativa.", "bar", regionPairs, {
                name: "Clientes",
                color: "#0f172a",
            }),
            chartFromPairs("Distribuicao por estoque", "Segmentacao por tamanho de operacao.", "column", stockPairs, {
                name: "Clientes",
                color: "#f59e0b",
            }),
            chartFromPairs("Mix por plano", "Peso de cada assinatura na base ativa.", "pie", planPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Health score por faixa", "Classificacao atual dos clientes acompanhados.", "bar", healthPairs, {
                name: "Clientes",
                color: "#14b8a6",
            }),
        ],
        statCards: [
            statCard("Sem acesso ha 7 dias", integer(inactiveRows.length), "Fila ideal para reativacao e CS preventivo."),
            statCard("Health medio", decimal(healthAverage, 1), "Media consolidada do Customer Health Score."),
            statCard("Clientes criticos", integer(criticalRows.length), "Contas nas faixas mais proximas de cancelamento."),
        ],
        leaderboardTitle: "Clientes que pedem acao",
        leaderboard: formatTopRows(riskyRows, (row) => ({
            name: row.companyName,
            detail: `${row.planName || "Sem plano"} | ${row.region || row.city || "Sem regiao"}`,
            value: `Score ${integer(row.score)}`,
            badge: row.riskLevel || row.classification,
        })),
        insights: [
            insight("Health score virou radar real", "A tela de clientes agora combina score, ultimo acesso e filtros operacionais em tempo real para retenção.", "positive"),
            insight("Reativacao pode ser direcionada", `${integer(inactiveRows.length)} contas ja aparecem destacadas pela falta de login recente.`, inactiveRows.length >= 6 ? "warning" : "positive"),
            insight("Existe benchmark interno por regiao", `${topHealthyRegion?.label || "A base"} lidera saude media hoje e pode servir de referencia para onboarding e CS.`, "positive"),
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

    return {
        ...meta,
        metrics: [
            metric("Veiculos cadastrados", integer(toNumber(args.dashboardData?.totalVehicles)), "Total de veiculos cadastrados no sistema.", undefined, "emerald"),
            metric("Media por cliente", decimal(toNumber(args.dashboardData?.averageVehiclesPerCustomer), 1), "Media de veiculos nas contas ativas.", undefined, "sky"),
            metric("Anuncios ativos", integer(toNumber(args.dashboardData?.activeMarketplaceAds)), "Anuncios ativos nas plataformas integradas.", undefined, "violet"),
            metric("Integracoes ativas", integer(toNumber(args.dashboardData?.activeIntegrations)), "Integracoes funcionando no recorte atual.", undefined, "amber"),
        ],
        alerts: [
            alert(
                "Features subutilizadas",
                `${integer(underused.length)} funcionalidades ainda operam com adocao abaixo de 25% da base acompanhada.`,
                underused.length >= 2 ? "attention" : "stable",
            ),
            alert(
                "Feature lider de valor",
                `${topFeature?.label || "Nenhuma feature"} hoje e a funcionalidade com maior numero de clientes unicos ativos.`,
                topFeature?.value ? "stable" : "attention",
            ),
            alert(
                "Leitura de uso sem dados ficticios",
                "Todos os graficos desta area passam a depender dos eventos reais de uso registrados por cliente e periodo.",
                "stable",
            ),
        ],
        charts: [
            chartFromPairs("Clientes unicos por feature", "Aderencia por funcionalidade no periodo.", "bar", uniquePairs, {
                name: "Clientes",
                color: "#6b00e3",
            }),
            chartFromPairs("Adocao por feature", "Percentual de clientes ativos que usam cada funcionalidade.", "column", adoptionPairs, {
                name: "Adocao",
                color: "#14b8a6",
                valueSuffix: "%",
            }),
            chartFromPairs("Uso total por feature", "Volume bruto de interacoes registradas.", "column", totalUsagePairs, {
                name: "Eventos",
                color: "#0f172a",
            }),
            chartFromPairs("Participacao por feature", "Share relativo das funcionalidades mais usadas.", "pie", uniquePairs.slice(0, 6), {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
        ],
        statCards: [
            statCard("Periodo analisado", `${args.dashboardData?.fromDate || "-"} ate ${args.dashboardData?.toDate || "-"}`, "Recorte usado para medir adocao e uso real."),
            statCard("Feature lider", topFeature?.label || "Sem dados", `${integer(topFeature?.value || 0)} clientes unicos no periodo.`),
            statCard("Interacoes registradas", integer(totalUsage), "Soma bruta dos eventos de uso considerados pelo painel."),
        ],
        leaderboardTitle: "Funcionalidades que puxam valor",
        leaderboard: formatTopRows(totalUsagePairs, (row) => ({
            name: row.label,
            detail: `${integer(uniquePairs.find((item) => item.label === row.label)?.value || 0)} clientes unicos`,
            value: integer(row.value),
            badge: `${percent(adoptionPairs.find((item) => item.label === row.label)?.value || 0, 1)} de adocao`,
        })),
        insights: [
            insight("Produto orientado por uso real", "O dashboard deixa claro quais features movimentam a base e quais ainda pedem educacao de produto.", "positive"),
            insight("Adocao baixa vira backlog acionavel", `${integer(underused.length)} features ja aparecem destacadas para onboarding, nudges e revisao de UX.`, underused.length ? "warning" : "positive"),
            insight("Integracoes puxam recorrencia de uso", "Quando marketplaces e site proprio aparecem no topo, a leitura de valor do produto fica muito mais objetiva.", "positive"),
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
    const soldValuePairs = performance.map((row: Record<string, any>) => ({ label: platformLabel(row.platform), value: toThousandsFromCents(toNumber(row.totalValueCents)) }));
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
            metric("Anuncios ativos", integer(totalAds), "Volume total de anuncios ativos nas plataformas.", undefined, "emerald"),
            metric("Leads nas plataformas", integer(totalLeads), "Leads atribuidos aos canais com performance.", undefined, "sky"),
            metric("Vendas por canal", integer(totalSales), "Vendas fechadas com origem de plataforma informada.", undefined, "violet"),
            metric("Conversao media", percent(weightedConversion), "Conversao ponderada entre leads e vendas.", undefined, "amber"),
            metric("Valor vendido", currency(totalValue), "Receita total vendida pelos canais listados.", undefined, "rose"),
        ],
        alerts: [
            alert(
                topAdsShare >= 60 ? "Dependencia alta de um unico canal" : "Mix de canais equilibrado",
                `${topAds?.label || "A principal plataforma"} concentra ${percent(topAdsShare, 1)} dos anuncios ativos monitorados.`,
                topAdsShare >= 60 ? "attention" : "stable",
            ),
            alert(
                weakPlatforms.length ? "Plataformas com baixa conversao" : "Conversao sem gargalos graves",
                weakPlatforms.length
                    ? `${weakPlatforms.map((row) => row.label).join(", ")} hoje operam abaixo de 5% de conversao.`
                    : "Nao ha plataformas com conversao critica entre as que possuem leads registrados.",
                weakPlatforms.length ? "attention" : "stable",
            ),
            alert(
                "Acompanhamento por plataforma consolidado",
                "A visao agora conecta anuncios ativos, leads, vendas e valor vendido na mesma leitura.",
                "stable",
            ),
        ],
        charts: [
            chartFromPairs("Anuncios por plataforma", "Base ativa de anuncios por canal.", "column", adsPairs, {
                name: "Anuncios",
                color: "#6b00e3",
            }),
            chartFromPairs("Vendas por plataforma", "Volume de negocios fechados por canal.", "column", salesPairs, {
                name: "Vendas",
                color: "#14b8a6",
            }),
            chartFromPairs("Conversao por plataforma", "Leads convertidos em venda por canal.", "bar", conversionPairs, {
                name: "Conversao",
                color: "#f59e0b",
                valueSuffix: "%",
            }),
            chartFromPairs("Valor vendido por plataforma", "Receita vendida por canal no periodo.", "bar", soldValuePairs, {
                name: "Valor vendido",
                color: "#0f172a",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
        ],
        statCards: [
            statCard("Canal com mais anuncios", topAds?.label || "Sem dados", `${integer(topAds?.value || 0)} anuncios ativos no recorte.`),
            statCard("Melhor conversao", topConversion?.label || "Sem dados", `${percent(topConversion?.value || 0, 2)} de conversao.`),
            statCard("Maior valor vendido", topValue?.label || "Sem dados", `R$ ${decimal(topValue?.value || 0, 1)} mil vendidos.`),
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
            insight("Marketplaces viraram vantagem mensuravel", "O painel diferencia claramente volume, eficiencia e valor vendido por canal.", "positive"),
            insight("Concentracao de anuncios precisa ser saudavel", `${topAds?.label || "O principal canal"} hoje lidera a distribuicao e merece monitoramento de dependencia.`, topAdsShare >= 60 ? "warning" : "positive"),
            insight("ROI por canal esta mais proximo", "Com leads, vendas e valor vendido por plataforma, a base para evoluir para ROI ja esta montada.", "positive"),
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
    const sellerLinkedLeads = args.catalogLeads.filter((lead) => Boolean(lead.sellerName)).length;
    const groupedOriginLabels = Array.from(new Set([...leadPairs, ...customerPairs].map((row) => row.label)));

    return {
        ...meta,
        metrics: [
            metric("Leads gerados", integer(leadsGenerated), "Leads vindos da pagina de catalogo.", undefined, "emerald"),
            metric("Vendas fechadas", integer(closedSales), "Vendas atribuidas ao recorte atual.", undefined, "sky"),
            metric("Taxa de conversao", percent(conversionRate), "Relacao entre leads e vendas fechadas.", undefined, "violet"),
            metric("CAC", args.dashboardData?.cac == null ? "Nao aplicado" : currency(toNumber(args.dashboardData?.cac) * 100), "Estrutura pronta para quando o modulo de custos entrar.", undefined, "amber"),
            metric("Payback", args.dashboardData?.payback == null ? "Nao aplicado" : `${decimal(toNumber(args.dashboardData?.payback), 1)} meses`, "Mantido em espera conforme a regra atual do produto.", undefined, "rose"),
        ],
        alerts: [
            alert(
                conversionRate < 8 ? "Conversao abaixo do ideal" : "Conversao em faixa saudavel",
                `A taxa atual esta em ${percent(conversionRate, 2)} para ${integer(leadsGenerated)} leads gerados no recorte.`,
                conversionRate < 8 ? "attention" : "stable",
            ),
            alert(
                topLeadOriginShare >= 60 ? "Origem dominante na aquisicao" : "Mix de origem bem distribuido",
                `${topLeadOrigin?.label || "A principal origem"} responde por ${percent(topLeadOriginShare, 1)} dos leads gerados.`,
                topLeadOriginShare >= 60 ? "attention" : "stable",
            ),
            alert(
                "Metadados de origem ativos",
                "As origens de assinatura e catalogo agora alimentam os cards e graficos sem precisar de consolidacao manual.",
                "stable",
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
            chartFromPairs("Funil resumido", "Comparativo entre captacao e fechamento.", "column", [
                { label: "Leads", value: leadsGenerated },
                { label: "Vendas", value: closedSales },
            ], {
                name: "Volume",
                color: "#14b8a6",
            }),
            {
                title: "Leads vs clientes por origem",
                subtitle: "Comparacao direta entre atracao e assinatura.",
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
            statCard("Leads em aberto", integer(openLeadBacklog), "Volume que ainda nao virou venda dentro do recorte atual."),
            statCard("Origens ativas", integer(leadPairs.length), "Quantidade de canais aparecendo na aquisicao."),
            statCard("Leads com vendedor", integer(sellerLinkedLeads), "Demandas capturadas por links de vendedor."),
        ],
        leaderboardTitle: "Origens com mais tracao",
        leaderboard: formatTopRows(leadPairs, (row) => ({
            name: row.label,
            detail: `${integer(customerPairs.find((item) => item.label === row.label)?.value || 0)} clientes originados`,
            value: integer(row.value),
            badge: percent(leadsGenerated ? (row.value / leadsGenerated) * 100 : 0, 1),
        })),
        insights: [
            insight("Aquisicao e retencao passam a conversar", "Leads, vendas e origem de cliente agora ficam no mesmo painel executivo.", "positive"),
            insight("Mix de origem influencia escala", `${topLeadOrigin?.label || "A principal origem"} lidera a captacao e pode orientar investimento e parcerias.`, topLeadOriginShare >= 60 ? "warning" : "positive"),
            insight("CAC e payback estao prontos para entrar", "Os cards seguem respeitando a regra atual do produto sem inventar valores onde o backend ainda nao mede custo.", "positive"),
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
            value: toThousandsFromCents(toNumber(row.overdueAmountCents)),
        }))
        .sort((left: Pair, right: Pair) => right.value - left.value)
        .slice(0, 6);
    const planPairs = topPairs(overdueCustomers, (row: Record<string, any>) => row.planName || "Sem plano", (row: Record<string, any>) => toThousandsFromCents(toNumber(row.overdueAmountCents)));
    const statusPairs = topPairs(overdueCustomers, (row: Record<string, any>) => titleCase(row.billingStatus) || "Nao informado", () => 1);
    const agingPairs = [
        { label: "Ate 7 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) <= 7).length },
        { label: "8 a 15 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 7 && toNumber(row.delayDays) <= 15).length },
        { label: "16 a 30 dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 15 && toNumber(row.delayDays) <= 30).length },
        { label: "30+ dias", value: overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 30).length },
    ];
    const largestDebt = [...overdueCustomers].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(right.overdueAmountCents) - toNumber(left.overdueAmountCents))[0];
    const criticalDelay = overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) > 10);
    const recoverableRevenue = total(overdueCustomers.filter((row: Record<string, any>) => toNumber(row.delayDays) <= 7).map((row: Record<string, any>) => toNumber(row.overdueAmountCents)));
    const paymentFailureRate = toNumber(cards.paymentFailureRate);
    const averageDelay = toNumber(cards.averageDelayDays);

    return {
        ...meta,
        metrics: [
            metric("Clientes inadimplentes", integer(toNumber(cards.overdueCustomers)), "Clientes com cobranca em atraso.", undefined, "emerald"),
            metric("Receita em atraso", currency(toNumber(cards.overdueRevenueCents)), "Valor total vencido no recorte filtrado.", undefined, "rose"),
            metric("Atraso medio", `${decimal(averageDelay, 1)} dias`, "Tempo medio de atraso das cobrancas vencidas.", undefined, "amber"),
            metric("Falha de pagamento", percent(paymentFailureRate), "Taxa consolidada de falha em cobranca.", undefined, "violet"),
        ],
        alerts: [
            alert(
                paymentFailureRate >= 8 ? "Cartoes recusados acima do ideal" : "Falhas de pagamento em controle",
                `A taxa atual de falha esta em ${percent(paymentFailureRate, 2)}.`,
                paymentFailureRate >= 8 ? "critical" : paymentFailureRate >= 4 ? "attention" : "stable",
            ),
            alert(
                averageDelay >= 10 ? "Boletos vencidos em excesso" : "Atraso medio sob monitoramento",
                `O atraso medio atual esta em ${decimal(averageDelay, 1)} dias na carteira filtrada.`,
                averageDelay >= 10 ? "critical" : averageDelay >= 6 ? "attention" : "stable",
            ),
            alert(
                "Visao de cobranca conectada",
                "A lista de inadimplentes agora alimenta graficos por plano, atraso e status sem depender de planilhas paralelas.",
                "stable",
            ),
        ],
        charts: [
            chartFromPairs("Aging da carteira", "Distribuicao da inadimplencia por faixa de atraso.", "column", agingPairs, {
                name: "Clientes",
                color: "#f59e0b",
            }),
            chartFromPairs("Receita em atraso por plano", "Peso da inadimplencia em cada assinatura.", "bar", planPairs, {
                name: "Receita em atraso",
                color: "#6b00e3",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
            chartFromPairs("Status de cobranca", "Carteira agrupada por billing status.", "pie", statusPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Maiores valores em atraso", "Contas que mais pressionam a carteira.", "bar", overduePairs, {
                name: "Receita em atraso",
                color: "#0f172a",
                valuePrefix: "R$ ",
                valueSuffix: " mil",
            }),
        ],
        statCards: [
            statCard("Maior conta em atraso", largestDebt?.companyName || "Sem dados", largestDebt ? currency(toNumber(largestDebt.overdueAmountCents)) : "R$ 0,00"),
            statCard("Carteira critica", integer(criticalDelay.length), "Clientes com mais de 10 dias de atraso."),
            statCard("Receita recuperavel em 7 dias", currency(recoverableRevenue), "Valor em atraso concentrado nas cobrancas mais recentes."),
        ],
        leaderboardTitle: "Contas que exigem acao",
        leaderboard: formatTopRows(
            [...overdueCustomers].sort((left: Record<string, any>, right: Record<string, any>) => toNumber(right.overdueAmountCents) - toNumber(left.overdueAmountCents)),
            (row: Record<string, any>) => ({
                name: row.companyName,
                detail: `${row.planName || "Sem plano"} | ${titleCase(row.billingStatus)}`,
                value: currency(toNumber(row.overdueAmountCents)),
                badge: `${decimal(toNumber(row.delayDays), 1)} dias`,
            }),
        ),
        insights: [
            insight("Cobranca ficou operacional", "Os alertas agora mostram atraso, falha de pagamento e concentracao da carteira usando dados reais.", "positive"),
            insight("Recuperacao pode ser priorizada", `${integer(criticalDelay.length)} contas ja entram automaticamente na faixa de maior pressao.`, criticalDelay.length ? "warning" : "positive"),
            insight("Planos mais sensiveis ficam visiveis", "O grafico por plano ajuda a entender onde a inadimplencia esta pesando mais na base.", "positive"),
        ],
    };
}

function buildOperationsSection(args: BuildArgs): SuperAdminSection {
    const meta = superAdminSections.operacional;
    const cards = args.dashboardData?.cards ?? {};
    const bugsByArea = Array.isArray(args.dashboardData?.bugsByArea) ? args.dashboardData.bugsByArea : [];
    const bugPairs = bugsByArea.map((row: Record<string, any>) => ({
        label: row.bugArea || "Nao informado",
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
            metric("Resposta media", `${decimal(responseMinutes, 1)} min`, "Tempo medio ate a primeira resposta.", undefined, "sky"),
            metric("Resolucao media", `${decimal(resolutionHours, 1)} h`, "Tempo medio ate a conclusao do ticket.", undefined, "amber"),
            metric("Bugs reportados", integer(toNumber(cards.bugsReported)), "Tickets categorizados como bug.", undefined, "rose"),
        ],
        alerts: [
            alert(
                toNumber(cards.bugsReported) >= 8 ? "Bugs reportados acima do normal" : "Fila de bugs administravel",
                `${integer(toNumber(cards.bugsReported))} bugs foram reportados no recorte atual.`,
                toNumber(cards.bugsReported) >= 8 ? "critical" : toNumber(cards.bugsReported) >= 4 ? "attention" : "stable",
            ),
            alert(
                responseMinutes > 30 ? "Tempo de primeira resposta lento" : "Primeira resposta em faixa saudavel",
                `O tempo medio atual esta em ${decimal(responseMinutes, 1)} minutos.`,
                responseMinutes > 30 ? "critical" : responseMinutes > 20 ? "attention" : "stable",
            ),
            alert(
                "Mesa de suporte conectada",
                "A visao executiva e a mesa operacional agora leem os mesmos tickets, sem divergencia entre resumo e detalhe.",
                "stable",
            ),
        ],
        charts: [
            chartFromPairs("Bugs por categoria", "Areas onde os bugs estao concentrados.", "bar", bugPairs, {
                name: "Bugs",
                color: "#ef4444",
            }),
            chartFromPairs("Tickets por status", "Distribuicao da fila operacional.", "pie", statusPairs, {
                name: "Tickets",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Urgencia dos tickets", "Peso de severidade na fila atual.", "column", urgencyPairs, {
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
            statCard("Alta urgencia", integer(highUrgency), "Chamados classificados como high ou critical."),
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
            insight("Operacao e suporte falam a mesma lingua", "Os mesmos tickets alimentam os cards executivos, os graficos e a mesa operacional detalhada.", "positive"),
            insight("Urgencia nao fica escondida", `${integer(highUrgency)} tickets de alta urgencia ja aparecem resumidos antes mesmo da leitura individual.`, highUrgency ? "warning" : "positive"),
            insight("Bugs por area viram prioridade objetiva", "Quando a categoria de bug se repete, a equipe ja consegue enxergar a concentracao direto no topo da tela.", "positive"),
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

    return {
        ...meta,
        metrics: [
            metric("Risco alto de churn", integer(riskCustomers.length), "Contas mais proximas de cancelamento.", undefined, "rose"),
            metric("Prontas para upgrade", integer(upgradeCustomers.length), "Contas perto do limite atual do plano.", undefined, "emerald"),
            metric("Alto potencial", integer(potentialCustomers.length), "Clientes com maior chance de expandir faturamento.", undefined, "sky"),
            metric("Features subutilizadas", integer(underusedFeatures.length), "Funcionalidades com baixa adocao na base.", undefined, "amber"),
        ],
        alerts: [
            alert(
                riskCustomers.length >= 10 ? "Fila relevante de churn previsivel" : "Churn previsivel em controle",
                `${integer(riskCustomers.length)} contas aparecem no radar de cancelamento com base em health score e comportamento.`,
                riskCustomers.length >= 10 ? "critical" : riskCustomers.length >= 5 ? "attention" : "stable",
            ),
            alert(
                upgradeCustomers.length ? "Oportunidade clara de expansao" : "Poucas contas prontas para upgrade",
                `${integer(upgradeCustomers.length)} contas ja estao proximas dos limites do plano atual.`,
                upgradeCustomers.length >= 5 ? "stable" : "attention",
            ),
            alert(
                "Insights deixam de ser teoricos",
                "Risco, upgrade, potencial de faturamento e subutilizacao agora nascem direto dos dados operacionais da plataforma.",
                "stable",
            ),
        ],
        charts: [
            chartFromPairs("Distribuicao de risco", "Como a base se reparte entre as faixas de risco.", "pie", riskPairs, {
                name: "Clientes",
                pieColors: PIE_COLORS,
            }),
            chartFromPairs("Clientes prontos para upgrade", "Pressao de uso das contas mais proximas de expansao.", "bar", upgradePairs, {
                name: "Pressao",
                color: "#14b8a6",
                valueSuffix: "%",
            }),
            chartFromPairs("Potencial de faturamento", "Score das contas com maior chance de expandir resultado.", "bar", potentialPairs, {
                name: "Score",
                color: "#6b00e3",
            }),
            chartFromPairs("Features subutilizadas", "Adocao percentual das funcionalidades com menor uso.", "column", underusedPairs, {
                name: "Adocao",
                color: "#f59e0b",
                valueSuffix: "%",
            }),
        ],
        statCards: [
            statCard("Score medio de risco", decimal(averageRiskScore, 1), "Media dos clientes presentes no radar de churn."),
            statCard("Pressao media de upgrade", percent(averagePressure, 1), "Quanto as contas prontas ja pressionam o plano atual."),
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
            insight("Churn previsivel ganhou contexto", `${integer(overdueRisk)} contas de risco tambem estao em situacao de atraso, ligando saude e cobranca.`, overdueRisk ? "warning" : "positive"),
            insight("Upgrade vira fila comercial", "As contas com maior pressao de uso ja aparecem prontas para outreach de expansao.", "positive"),
            insight("Subutilizacao deixa de ser invisivel", "As funcionalidades menos adotadas agora aparecem com taxa percentual real para orientar onboarding e produto.", "positive"),
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
