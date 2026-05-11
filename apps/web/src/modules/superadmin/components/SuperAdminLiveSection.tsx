"use client";

import { useEffect, useMemo, useState } from "react";

export type SuperAdminLiveSectionKey =
    | "financeiro"
    | "clientes"
    | "produto"
    | "marketplaces"
    | "crescimento"
    | "cobranca"
    | "operacional"
    | "insights";

type Props = {
    section: SuperAdminLiveSectionKey;
};

function toBrDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR");
}

function toBrDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR");
}

function toCurrency(cents?: number | null) {
    const value = (cents ?? 0) / 100;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function toPercent(value?: number | null) {
    return `${(value ?? 0).toFixed(2)}%`;
}

function toNumber(value?: number | null) {
    return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().slice(0, 10);
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
    return (
        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-black/45">{title}</p>
            <p className="mt-2 text-2xl font-bold text-io-dark">{value}</p>
            {subtitle ? <p className="mt-1 text-xs text-black/55">{subtitle}</p> : null}
        </article>
    );
}

function BarRows({ rows }: { rows: Array<{ label: string; value: number; detail?: string }> }) {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return (
        <div className="grid gap-2">
            {rows.map((row) => (
                <div key={row.label} className="rounded-xl border border-black/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-io-dark">{row.label}</p>
                        <p className="text-sm font-bold text-io-dark">{toNumber(row.value)}</p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-black/10">
                        <div className="h-2 rounded-full bg-io-dark" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
                    </div>
                    {row.detail ? <p className="mt-2 text-xs text-black/55">{row.detail}</p> : null}
                </div>
            ))}
        </div>
    );
}

export function SuperAdminLiveSection({ section }: Props) {
    const [startDate, setStartDate] = useState(startOfMonthIso());
    const [endDate, setEndDate] = useState(todayIso());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);

    const endpoint = useMemo(() => {
        if (section === "financeiro") return "/api/superadmin/dashboard/financial";
        if (section === "clientes") return "/api/superadmin/dashboard/customers";
        if (section === "produto") return "/api/superadmin/dashboard/product-usage";
        if (section === "marketplaces") return "/api/superadmin/dashboard/marketplaces";
        if (section === "crescimento") return "/api/superadmin/dashboard/growth";
        if (section === "cobranca") return "/api/superadmin/dashboard/billing";
        if (section === "operacional") return "/api/superadmin/dashboard/operations";
        return "/api/superadmin/dashboard/insights";
    }, [section]);

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const query = new URLSearchParams();
            if (startDate) query.set("startDate", startDate);
            if (endDate) query.set("endDate", endDate);
            if (section === "produto") query.set("periodPreset", "LAST_30_DAYS");

            const response = await fetch(`${endpoint}?${query.toString()}`, { cache: "no-store" });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.message ?? "Falha ao carregar dashboard.");
            }

            if (section === "clientes") {
                const healthResponse = await fetch(`/api/superadmin/customers/health-score?${query.toString()}`, { cache: "no-store" });
                const healthPayload = await healthResponse.json().catch(() => []);
                setData({ ...(payload ?? {}), health: Array.isArray(healthPayload) ? healthPayload : [] });
                return;
            }

            setData(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section]);

    function renderFinanceiro() {
        const cards = data?.cards;
        const chart = Array.isArray(data?.chart) ? data.chart : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="MRR" value={toCurrency(cards?.mrrCents)} />
                    <MetricCard title="ARR" value={toCurrency(cards?.arrCents)} />
                    <MetricCard title="Ticket Medio" value={toCurrency(cards?.averageTicketCents)} />
                    <MetricCard title="LTV" value={toCurrency(cards?.ltvCents)} />
                    <MetricCard title="Churn Financeiro" value={toPercent(cards?.financialChurnRate)} />
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Churn financeiro por mes</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr><th className="py-2">Mes</th><th>Total MRR</th><th>MRR perdido</th><th>Churn</th></tr>
                            </thead>
                            <tbody>
                                {chart.map((row: any) => (
                                    <tr key={row.month} className="border-t border-black/8">
                                        <td className="py-2">{row.month}</td>
                                        <td>{toCurrency(row.totalMrrCents)}</td>
                                        <td>{toCurrency(row.lostMrrCents)}</td>
                                        <td>{toPercent(row.churnRate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    function renderClientes() {
        const health = Array.isArray(data?.health) ? data.health : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="Clientes Ativos" value={toNumber(data?.totalActiveCustomers)} />
                    <MetricCard title="Novos no periodo" value={toNumber(data?.newCustomersInPeriod)} />
                    <MetricCard title="Cancelados no periodo" value={toNumber(data?.canceledCustomersInPeriod)} />
                    <MetricCard title="Churn" value={toPercent(data?.churnRate)} />
                    <MetricCard title="Permanencia media" value={`${(data?.averageLifetimeMonths ?? 0).toFixed(2)} meses`} />
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Health Score por cliente</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Empresa</th><th>Plano</th><th>Cidade</th><th>Score</th><th>Classificacao</th><th>Risco</th><th>Ultimo acesso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {health.slice(0, 100).map((row: any) => (
                                    <tr key={row.tenantId} className="border-t border-black/8">
                                        <td className="py-2">{row.companyName}</td>
                                        <td>{row.planName}</td>
                                        <td>{[row.city, row.region].filter(Boolean).join("/") || "-"}</td>
                                        <td>{row.score}</td>
                                        <td>{row.classification}</td>
                                        <td>{row.riskLevel}</td>
                                        <td>{toBrDateTime(row.lastAccessAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    function renderProduto() {
        const usage = Array.isArray(data?.featureUsage) ? data.featureUsage : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Veiculos cadastrados" value={toNumber(data?.totalVehicles)} />
                    <MetricCard title="Media de veiculos/cliente" value={(data?.averageVehiclesPerCustomer ?? 0).toFixed(2)} />
                    <MetricCard title="Anuncios ativos" value={toNumber(data?.activeMarketplaceAds)} />
                    <MetricCard title="Integracoes ativas" value={toNumber(data?.activeIntegrations)} />
                </div>
                <BarRows rows={usage.map((item: any) => ({
                    label: item.featureKey,
                    value: item.uniqueCustomersCount,
                    detail: `Uso: ${toNumber(item.usageCount)} | Adocao: ${toPercent(item.adoptionRate)}`,
                }))} />
            </div>
        );
    }

    function renderMarketplaces() {
        const adsByPlatform = Array.isArray(data?.adsByPlatform) ? data.adsByPlatform : [];
        const salesByPlatform = Array.isArray(data?.salesByPlatform) ? data.salesByPlatform : [];
        const performance = Array.isArray(data?.platformPerformance) ? data.platformPerformance : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Anuncios por plataforma</p>
                        <div className="mt-3"><BarRows rows={adsByPlatform.map((row: any) => ({ label: row.platform, value: row.count }))} /></div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Vendas por plataforma</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55"><tr><th className="py-2">Plataforma</th><th>Vendas</th><th>Valor vendido</th></tr></thead>
                                <tbody>
                                    {salesByPlatform.map((row: any) => (
                                        <tr key={row.platform} className="border-t border-black/8"><td className="py-2">{row.platform}</td><td>{toNumber(row.salesCount)}</td><td>{toCurrency(row.totalValueCents)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Performance por plataforma</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55"><tr><th className="py-2">Plataforma</th><th>Leads</th><th>Vendas</th><th>Conversao</th><th>Valor vendido</th></tr></thead>
                            <tbody>
                                {performance.map((row: any) => (
                                    <tr key={row.platform} className="border-t border-black/8">
                                        <td className="py-2">{row.platform}</td><td>{toNumber(row.leadsCount)}</td><td>{toNumber(row.salesCount)}</td><td>{toPercent(row.conversionRate)}</td><td>{toCurrency(row.totalValueCents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    function renderCrescimento() {
        const leadsByOrigin = Array.isArray(data?.leadsByOrigin) ? data.leadsByOrigin : [];
        const customerOrigins = Array.isArray(data?.customerOrigins) ? data.customerOrigins : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="Leads gerados" value={toNumber(data?.leadsGenerated)} />
                    <MetricCard title="Vendas fechadas" value={toNumber(data?.closedSales)} />
                    <MetricCard title="Taxa de conversao" value={toPercent(data?.conversionRate)} />
                    <MetricCard title="CAC" value="Nao aplicado" subtitle="Estrutura preparada" />
                    <MetricCard title="Payback" value="Nao aplicado" subtitle="Estrutura preparada" />
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Leads por origem</p>
                        <div className="mt-3"><BarRows rows={leadsByOrigin.map((row: any) => ({ label: row.origin, value: row.total }))} /></div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Origem de clientes</p>
                        <div className="mt-3"><BarRows rows={customerOrigins.map((row: any) => ({ label: row.origin, value: row.total }))} /></div>
                    </div>
                </div>
            </div>
        );
    }

    function renderCobranca() {
        const cards = data?.cards;
        const overdueCustomers = Array.isArray(data?.overdueCustomers) ? data.overdueCustomers : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Clientes inadimplentes" value={toNumber(cards?.overdueCustomers)} />
                    <MetricCard title="Receita em atraso" value={toCurrency(cards?.overdueRevenueCents)} />
                    <MetricCard title="Atraso medio (dias)" value={(cards?.averageDelayDays ?? 0).toFixed(2)} />
                    <MetricCard title="Falha de pagamento" value={toPercent(cards?.paymentFailureRate)} />
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Clientes em atraso</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55"><tr><th className="py-2">Empresa</th><th>Plano</th><th>Status</th><th>Atraso (dias)</th><th>Valor em atraso</th><th>Periodo atual</th></tr></thead>
                            <tbody>
                                {overdueCustomers.map((row: any) => (
                                    <tr key={row.tenantId} className="border-t border-black/8">
                                        <td className="py-2">{row.companyName}</td>
                                        <td>{row.planName}</td>
                                        <td>{row.billingStatus}</td>
                                        <td>{(row.delayDays ?? 0).toFixed(2)}</td>
                                        <td>{toCurrency(row.overdueAmountCents)}</td>
                                        <td>{toBrDate(row.currentPeriodEnd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    function renderOperacional() {
        const cards = data?.cards;
        const bugsByArea = Array.isArray(data?.bugsByArea) ? data.bugsByArea : [];
        const latestTickets = Array.isArray(data?.latestTickets) ? data.latestTickets : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Tickets abertos" value={toNumber(cards?.openTickets)} />
                    <MetricCard title="Primeira resposta (min)" value={(cards?.averageFirstResponseMinutes ?? 0).toFixed(2)} />
                    <MetricCard title="Resolucao (h)" value={(cards?.averageResolutionHours ?? 0).toFixed(2)} />
                    <MetricCard title="Bugs reportados" value={toNumber(cards?.bugsReported)} />
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Bugs por area</p>
                        <div className="mt-3"><BarRows rows={bugsByArea.map((row: any) => ({ label: row.bugArea, value: row.total }))} /></div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Ultimos tickets</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55"><tr><th className="py-2">Empresa</th><th>Titulo</th><th>Categoria</th><th>Status</th><th>Criado em</th></tr></thead>
                                <tbody>
                                    {latestTickets.slice(0, 50).map((row: any) => (
                                        <tr key={row.ticketId} className="border-t border-black/8"><td className="py-2">{row.companyName}</td><td>{row.title}</td><td>{row.category}</td><td>{row.status}</td><td>{toBrDateTime(row.createdAt)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    function renderInsights() {
        const cancellationRiskCustomers = Array.isArray(data?.cancellationRiskCustomers) ? data.cancellationRiskCustomers : [];
        const upgradeReadyCustomers = Array.isArray(data?.upgradeReadyCustomers) ? data.upgradeReadyCustomers : [];
        const highRevenuePotentialCustomers = Array.isArray(data?.highRevenuePotentialCustomers) ? data.highRevenuePotentialCustomers : [];
        const underusedFeatures = Array.isArray(data?.underusedFeatures) ? data.underusedFeatures : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Maior risco de cancelamento</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm"><thead className="text-left text-black/55"><tr><th className="py-2">Empresa</th><th>Score</th><th>Classificacao</th><th>Risco</th></tr></thead><tbody>
                                {cancellationRiskCustomers.slice(0, 40).map((row: any) => <tr key={row.tenantId} className="border-t border-black/8"><td className="py-2">{row.companyName}</td><td>{row.score}</td><td>{row.classification}</td><td>{row.riskLevel}</td></tr>)}
                            </tbody></table>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Clientes prontos para upgrade</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm"><thead className="text-left text-black/55"><tr><th className="py-2">Empresa</th><th>Plano</th><th>Pressao</th><th>Leads 30d</th></tr></thead><tbody>
                                {upgradeReadyCustomers.slice(0, 40).map((row: any) => <tr key={row.tenantId} className="border-t border-black/8"><td className="py-2">{row.companyName}</td><td>{row.planName}</td><td>{toPercent(row.usagePressurePercent)}</td><td>{toNumber(row.leads30d)}</td></tr>)}
                            </tbody></table>
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Maior potencial de faturamento</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm"><thead className="text-left text-black/55"><tr><th className="py-2">Empresa</th><th>Score</th><th>Leads 90d</th><th>Vendas 90d</th></tr></thead><tbody>
                                {highRevenuePotentialCustomers.slice(0, 40).map((row: any) => <tr key={row.tenantId} className="border-t border-black/8"><td className="py-2">{row.companyName}</td><td>{row.potentialScore.toFixed(2)}</td><td>{toNumber(row.leads90d)}</td><td>{toNumber(row.sales90d)}</td></tr>)}
                            </tbody></table>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Funcionalidades subutilizadas</p>
                        <div className="mt-3"><BarRows rows={underusedFeatures.map((row: any) => ({ label: row.featureKey, value: row.uniqueCustomersCount, detail: `Adocao: ${toPercent(row.adoptionRate)}` }))} /></div>
                    </div>
                </div>
            </div>
        );
    }

    const content = section === "financeiro"
        ? renderFinanceiro()
        : section === "clientes"
            ? renderClientes()
            : section === "produto"
                ? renderProduto()
                : section === "marketplaces"
                    ? renderMarketplaces()
                    : section === "crescimento"
                        ? renderCrescimento()
                        : section === "cobranca"
                            ? renderCobranca()
                            : section === "operacional"
                                ? renderOperacional()
                                : renderInsights();

    return (
        <div className="grid gap-5">
            <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-xs text-black/55">
                        Data inicial
                        <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Data final
                        <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <button type="button" onClick={load} disabled={loading} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {loading ? "Carregando..." : "Aplicar filtros"}
                    </button>
                </div>
                {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            </section>

            {loading && !data ? <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-black/55">Carregando dados...</div> : null}
            {!loading && !error && !data ? <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-black/55">Sem dados para o periodo selecionado.</div> : null}
            {!error && data ? content : null}
        </div>
    );
}
