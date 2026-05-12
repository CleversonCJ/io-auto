"use client";

import { useEffect, useState } from "react";
import { superAdminSections } from "@/modules/superadmin/data";

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

type FilterState = {
    startDate: string;
    endDate: string;
    plan: string;
    city: string;
    region: string;
    recurrence: string;
    status: string;
    origin: string;
    stockSize: string;
    search: string;
};

type CustomerHealthRow = {
    tenantId: string;
    companyName: string;
    planName: string;
    city?: string | null;
    region?: string | null;
    score: number;
    classification: string;
    riskLevel: string;
    lastAccessAt?: string | null;
};

type CatalogLeadRow = {
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

type CatalogLeadsPage = {
    fromDate: string;
    toDate: string;
    leads: CatalogLeadRow[];
};

type SupportTicketSummary = {
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

type SupportTicketMessage = {
    id: string;
    ticketId: string;
    senderUserId?: string | null;
    senderType: string;
    message: string;
    createdAt: string;
};

type SupportTicketDetail = {
    ticketId: string;
    tenantId: string;
    companyName: string;
    openedByUserId?: string | null;
    openedByName?: string | null;
    title: string;
    description: string;
    category: string;
    urgency: string;
    status: string;
    bugArea?: string | null;
    createdAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    closedAt?: string | null;
    messages: SupportTicketMessage[];
};

type DashboardPayload = Record<string, any>;

const SUPPORT_STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const SUPPORT_CATEGORY_OPTIONS = ["BUG", "QUESTION", "BILLING", "INTEGRATION", "FEATURE_REQUEST", "OTHER"];

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso() {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), 1);
    return date.toISOString().slice(0, 10);
}

function defaultFilters(): FilterState {
    return {
        startDate: startOfMonthIso(),
        endDate: todayIso(),
        plan: "",
        city: "",
        region: "",
        recurrence: "",
        status: "",
        origin: "",
        stockSize: "",
        search: "",
    };
}

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

function titleCase(value?: string | null) {
    if (!value) return "-";
    return value
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((token) => token[0]?.toUpperCase() + token.slice(1))
        .join(" ");
}

function buildQuery(filters: FilterState, extras?: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    if (filters.startDate) query.set("startDate", filters.startDate);
    if (filters.endDate) query.set("endDate", filters.endDate);
    if (filters.plan.trim()) query.set("plan", filters.plan.trim());
    if (filters.city.trim()) query.set("city", filters.city.trim());
    if (filters.region.trim()) query.set("region", filters.region.trim());
    if (filters.recurrence) query.set("recurrence", filters.recurrence);
    if (filters.status) query.set("status", filters.status);
    if (filters.origin.trim()) query.set("origin", filters.origin.trim());
    if (filters.stockSize) query.set("stockSize", filters.stockSize);
    if (filters.search.trim()) query.set("search", filters.search.trim());
    Object.entries(extras ?? {}).forEach(([key, value]) => {
        if (value && value.trim()) query.set(key, value.trim());
    });
    return query.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message ?? fallbackMessage);
    }
    return payload as T;
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
    if (!rows.length) {
        return <div className="rounded-xl border border-dashed border-black/12 bg-white p-4 text-sm text-black/55">Sem dados para este recorte.</div>;
    }

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
    const meta = superAdminSections[section];
    const [filters, setFilters] = useState<FilterState>(defaultFilters());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
    const [healthRows, setHealthRows] = useState<CustomerHealthRow[]>([]);
    const [catalogLeads, setCatalogLeads] = useState<CatalogLeadRow[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicketSummary[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(null);
    const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
    const [ticketDetailError, setTicketDetailError] = useState<string | null>(null);
    const [ticketReply, setTicketReply] = useState("");
    const [ticketStatusDraft, setTicketStatusDraft] = useState("OPEN");
    const [ticketStatusFilter, setTicketStatusFilter] = useState("");
    const [ticketCategoryFilter, setTicketCategoryFilter] = useState("");
    const [ticketActionLoading, setTicketActionLoading] = useState(false);
    const [ticketActionFeedback, setTicketActionFeedback] = useState<string | null>(null);

    const endpoint = section === "financeiro"
        ? "/api/superadmin/dashboard/financial"
        : section === "clientes"
            ? "/api/superadmin/dashboard/customers"
            : section === "produto"
                ? "/api/superadmin/dashboard/product-usage"
                : section === "marketplaces"
                    ? "/api/superadmin/dashboard/marketplaces"
                    : section === "crescimento"
                        ? "/api/superadmin/dashboard/growth"
                        : section === "cobranca"
                            ? "/api/superadmin/dashboard/billing"
                            : section === "operacional"
                                ? "/api/superadmin/dashboard/operations"
                                : "/api/superadmin/dashboard/insights";

    function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
        setFilters((current) => ({ ...current, [key]: value }));
    }

    async function loadTicketDetail(ticketId: string) {
        setTicketDetailLoading(true);
        setTicketDetailError(null);

        try {
            const payload = await fetchJson<SupportTicketDetail>(
                `/api/superadmin/support/tickets/${encodeURIComponent(ticketId)}`,
                undefined,
                "Falha ao carregar o ticket selecionado.",
            );
            setTicketDetail(payload);
            setTicketStatusDraft(payload.status ?? "OPEN");
        } catch (requestError) {
            setTicketDetail(null);
            setTicketDetailError(requestError instanceof Error ? requestError.message : "Falha ao carregar o ticket selecionado.");
        } finally {
            setTicketDetailLoading(false);
        }
    }

    async function load(
        nextFilters = filters,
        nextTicketStatusFilter = ticketStatusFilter,
        nextTicketCategoryFilter = ticketCategoryFilter,
    ) {
        setLoading(true);
        setError(null);
        setTicketActionFeedback(null);

        try {
            const baseQuery = buildQuery(nextFilters, section === "produto" ? { periodPreset: "LAST_30_DAYS" } : undefined);
            const sharedQuery = buildQuery(nextFilters);
            const supportQuery = buildQuery(nextFilters, {
                ticketStatus: nextTicketStatusFilter,
                ticketCategory: nextTicketCategoryFilter,
            });

            const [dashboardPayload, healthPayload, leadsPayload, supportPayload] = await Promise.all([
                fetchJson<DashboardPayload>(`${endpoint}?${baseQuery}`, undefined, "Falha ao carregar o dashboard."),
                section === "clientes"
                    ? fetchJson<CustomerHealthRow[]>(`/api/superadmin/customers/health-score?${sharedQuery}`, undefined, "Falha ao carregar o health score.")
                    : Promise.resolve<CustomerHealthRow[] | null>(null),
                section === "crescimento"
                    ? fetchJson<CatalogLeadsPage>(`/api/superadmin/catalog-leads?${sharedQuery}`, undefined, "Falha ao carregar os leads do catalogo.")
                    : Promise.resolve<CatalogLeadsPage | null>(null),
                section === "operacional"
                    ? fetchJson<SupportTicketSummary[]>(`/api/superadmin/support/tickets?${supportQuery}`, undefined, "Falha ao carregar os tickets de suporte.")
                    : Promise.resolve<SupportTicketSummary[] | null>(null),
            ]);

            setDashboardData(dashboardPayload);
            setHealthRows(Array.isArray(healthPayload) ? healthPayload : []);
            setCatalogLeads(Array.isArray(leadsPayload?.leads) ? leadsPayload.leads : []);

            if (section === "operacional") {
                const nextTickets = Array.isArray(supportPayload) ? supportPayload : [];
                setSupportTickets(nextTickets);

                const resolvedTicketId = selectedTicketId && nextTickets.some((ticket) => ticket.ticketId === selectedTicketId)
                    ? selectedTicketId
                    : nextTickets[0]?.ticketId ?? null;

                setSelectedTicketId(resolvedTicketId);
                if (resolvedTicketId) {
                    void loadTicketDetail(resolvedTicketId);
                } else {
                    setTicketDetail(null);
                    setTicketDetailError(null);
                }
            } else {
                setSupportTickets([]);
                setSelectedTicketId(null);
                setTicketDetail(null);
                setTicketDetailError(null);
            }
        } catch (requestError) {
            setDashboardData(null);
            setHealthRows([]);
            setCatalogLeads([]);
            setSupportTickets([]);
            setTicketDetail(null);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar os dados.");
        } finally {
            setLoading(false);
        }
    }

    async function handleTicketStatusUpdate() {
        if (!ticketDetail) return;

        setTicketActionLoading(true);
        setTicketActionFeedback(null);
        try {
            await fetchJson(
                `/api/superadmin/support/tickets/${encodeURIComponent(ticketDetail.ticketId)}/status`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: ticketStatusDraft }),
                },
                "Falha ao atualizar o status do ticket.",
            );
            setTicketActionFeedback("Status do ticket atualizado.");
            await load();
        } catch (requestError) {
            setTicketActionFeedback(requestError instanceof Error ? requestError.message : "Falha ao atualizar o ticket.");
        } finally {
            setTicketActionLoading(false);
        }
    }

    async function handleTicketReplySubmit() {
        if (!ticketDetail || !ticketReply.trim()) return;

        setTicketActionLoading(true);
        setTicketActionFeedback(null);
        try {
            await fetchJson(
                `/api/superadmin/support/tickets/${encodeURIComponent(ticketDetail.ticketId)}/messages`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: ticketReply.trim() }),
                },
                "Falha ao enviar a resposta do suporte.",
            );
            setTicketReply("");
            setTicketActionFeedback("Resposta enviada para o ticket.");
            await load();
        } catch (requestError) {
            setTicketActionFeedback(requestError instanceof Error ? requestError.message : "Falha ao enviar a resposta.");
        } finally {
            setTicketActionLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section]);

    function renderFinanceiro() {
        const cards = dashboardData?.cards ?? {};
        const chart = Array.isArray(dashboardData?.chart) ? dashboardData.chart : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="MRR" value={toCurrency(cards.mrrCents)} />
                    <MetricCard title="ARR" value={toCurrency(cards.arrCents)} />
                    <MetricCard title="Ticket medio" value={toCurrency(cards.averageTicketCents)} />
                    <MetricCard title="LTV" value={toCurrency(cards.ltvCents)} />
                    <MetricCard title="Churn financeiro" value={toPercent(cards.financialChurnRate)} />
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Churn financeiro por mes</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Mes</th>
                                    <th>Total MRR</th>
                                    <th>MRR perdido</th>
                                    <th>Churn</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chart.map((row: Record<string, any>) => (
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
                </section>
            </div>
        );
    }

    function renderClientes() {
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="Clientes ativos" value={toNumber(dashboardData?.totalActiveCustomers)} />
                    <MetricCard title="Novos no periodo" value={toNumber(dashboardData?.newCustomersInPeriod)} />
                    <MetricCard title="Cancelados no periodo" value={toNumber(dashboardData?.canceledCustomersInPeriod)} />
                    <MetricCard title="Churn" value={toPercent(dashboardData?.churnRate)} />
                    <MetricCard title="Permanencia media" value={`${(dashboardData?.averageLifetimeMonths ?? 0).toFixed(2)} meses`} />
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Health score por cliente</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Empresa</th>
                                    <th>Plano</th>
                                    <th>Cidade</th>
                                    <th>Score</th>
                                    <th>Classificacao</th>
                                    <th>Risco</th>
                                    <th>Ultimo acesso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {healthRows.slice(0, 100).map((row) => (
                                    <tr key={row.tenantId} className="border-t border-black/8">
                                        <td className="py-2">{row.companyName}</td>
                                        <td>{row.planName || "-"}</td>
                                        <td>{[row.city, row.region].filter(Boolean).join("/") || "-"}</td>
                                        <td>{toNumber(row.score)}</td>
                                        <td>{row.classification}</td>
                                        <td>{row.riskLevel}</td>
                                        <td>{toBrDateTime(row.lastAccessAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    function renderProduto() {
        const usage = Array.isArray(dashboardData?.featureUsage) ? dashboardData.featureUsage : [];
        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Veiculos cadastrados" value={toNumber(dashboardData?.totalVehicles)} />
                    <MetricCard title="Media de veiculos por cliente" value={(dashboardData?.averageVehiclesPerCustomer ?? 0).toFixed(2)} />
                    <MetricCard title="Anuncios ativos" value={toNumber(dashboardData?.activeMarketplaceAds)} />
                    <MetricCard title="Integracoes ativas" value={toNumber(dashboardData?.activeIntegrations)} subtitle="Periodo fixado em ultimos 30 dias" />
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Uso por feature</p>
                    <div className="mt-3">
                        <BarRows rows={usage.map((item: Record<string, any>) => ({
                            label: titleCase(item.featureKey),
                            value: item.uniqueCustomersCount ?? 0,
                            detail: `Uso total: ${toNumber(item.usageCount)} | Adocao: ${toPercent(item.adoptionRate)}`,
                        }))} />
                    </div>
                </section>
            </div>
        );
    }

    function renderMarketplaces() {
        const adsByPlatform = Array.isArray(dashboardData?.adsByPlatform) ? dashboardData.adsByPlatform : [];
        const salesByPlatform = Array.isArray(dashboardData?.salesByPlatform) ? dashboardData.salesByPlatform : [];
        const performance = Array.isArray(dashboardData?.platformPerformance) ? dashboardData.platformPerformance : [];

        return (
            <div className="grid gap-5">
                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Anuncios por plataforma</p>
                        <div className="mt-3">
                            <BarRows rows={adsByPlatform.map((row: Record<string, any>) => ({
                                label: row.platform,
                                value: row.count ?? 0,
                            }))} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Vendas por plataforma</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55">
                                    <tr>
                                        <th className="py-2">Plataforma</th>
                                        <th>Vendas</th>
                                        <th>Valor vendido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesByPlatform.map((row: Record<string, any>) => (
                                        <tr key={row.platform} className="border-t border-black/8">
                                            <td className="py-2">{row.platform}</td>
                                            <td>{toNumber(row.salesCount)}</td>
                                            <td>{toCurrency(row.totalValueCents)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Performance por plataforma</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Plataforma</th>
                                    <th>Leads</th>
                                    <th>Vendas</th>
                                    <th>Conversao</th>
                                    <th>Valor vendido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {performance.map((row: Record<string, any>) => (
                                    <tr key={row.platform} className="border-t border-black/8">
                                        <td className="py-2">{row.platform}</td>
                                        <td>{toNumber(row.leadsCount)}</td>
                                        <td>{toNumber(row.salesCount)}</td>
                                        <td>{toPercent(row.conversionRate)}</td>
                                        <td>{toCurrency(row.totalValueCents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    function renderCrescimento() {
        const leadsByOrigin = Array.isArray(dashboardData?.leadsByOrigin) ? dashboardData.leadsByOrigin : [];
        const customerOrigins = Array.isArray(dashboardData?.customerOrigins) ? dashboardData.customerOrigins : [];

        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="Leads gerados" value={toNumber(dashboardData?.leadsGenerated)} />
                    <MetricCard title="Vendas fechadas" value={toNumber(dashboardData?.closedSales)} />
                    <MetricCard title="Taxa de conversao" value={toPercent(dashboardData?.conversionRate)} />
                    <MetricCard title="CAC" value="Nao aplicado" subtitle="Desconsiderado por enquanto" />
                    <MetricCard title="Payback" value="Nao aplicado" subtitle="Desconsiderado por enquanto" />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Leads por origem</p>
                        <div className="mt-3">
                            <BarRows rows={leadsByOrigin.map((row: Record<string, any>) => ({
                                label: row.origin,
                                value: row.total ?? 0,
                            }))} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Origem dos clientes</p>
                        <div className="mt-3">
                            <BarRows rows={customerOrigins.map((row: Record<string, any>) => ({
                                label: row.origin,
                                value: row.total ?? 0,
                            }))} />
                        </div>
                    </section>
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-io-dark">Leads do catalogo</p>
                            <p className="text-xs text-black/55">Nome, WhatsApp, veiculo, vendedor e origem em tempo real.</p>
                        </div>
                        <p className="text-xs text-black/55">{toNumber(catalogLeads.length)} leads listados</p>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Empresa</th>
                                    <th>Lead</th>
                                    <th>WhatsApp</th>
                                    <th>Veiculo</th>
                                    <th>Vendedor</th>
                                    <th>Origem</th>
                                    <th>Criado em</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalogLeads.map((lead) => (
                                    <tr key={lead.id} className="border-t border-black/8">
                                        <td className="py-2">{lead.companyName}</td>
                                        <td>{lead.fullName}</td>
                                        <td>{lead.whatsapp || "-"}</td>
                                        <td>{lead.vehicleInterestName || "-"}</td>
                                        <td>{lead.sellerName || "-"}</td>
                                        <td>{lead.originSource || "-"}</td>
                                        <td>{toBrDateTime(lead.createdAt)}</td>
                                        <td>{lead.convertedToSale ? "Convertido" : "Aberto"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    function renderCobranca() {
        const cards = dashboardData?.cards ?? {};
        const overdueCustomers = Array.isArray(dashboardData?.overdueCustomers) ? dashboardData.overdueCustomers : [];

        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Clientes inadimplentes" value={toNumber(cards.overdueCustomers)} />
                    <MetricCard title="Receita em atraso" value={toCurrency(cards.overdueRevenueCents)} />
                    <MetricCard title="Atraso medio em dias" value={(cards.averageDelayDays ?? 0).toFixed(2)} />
                    <MetricCard title="Falha de pagamento" value={toPercent(cards.paymentFailureRate)} />
                </div>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                    <p className="text-sm font-semibold text-io-dark">Clientes em atraso</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-black/55">
                                <tr>
                                    <th className="py-2">Empresa</th>
                                    <th>Plano</th>
                                    <th>Status</th>
                                    <th>Atraso</th>
                                    <th>Valor em atraso</th>
                                    <th>Periodo atual</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overdueCustomers.map((row: Record<string, any>) => (
                                    <tr key={row.tenantId} className="border-t border-black/8">
                                        <td className="py-2">{row.companyName}</td>
                                        <td>{row.planName}</td>
                                        <td>{row.billingStatus}</td>
                                        <td>{(row.delayDays ?? 0).toFixed(2)} dias</td>
                                        <td>{toCurrency(row.overdueAmountCents)}</td>
                                        <td>{toBrDate(row.currentPeriodEnd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    function renderOperacional() {
        const cards = dashboardData?.cards ?? {};
        const bugsByArea = Array.isArray(dashboardData?.bugsByArea) ? dashboardData.bugsByArea : [];

        return (
            <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Tickets abertos" value={toNumber(cards.openTickets)} />
                    <MetricCard title="Primeira resposta em min" value={(cards.averageFirstResponseMinutes ?? 0).toFixed(2)} />
                    <MetricCard title="Resolucao em horas" value={(cards.averageResolutionHours ?? 0).toFixed(2)} />
                    <MetricCard title="Bugs reportados" value={toNumber(cards.bugsReported)} />
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Bugs por categoria</p>
                        <div className="mt-3">
                            <BarRows rows={bugsByArea.map((row: Record<string, any>) => ({
                                label: row.bugArea,
                                value: row.total ?? 0,
                            }))} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-io-dark">Mesa de suporte</p>
                                <p className="text-xs text-black/55">Tickets reais, com resposta e troca de status pelo superadmin.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <select value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                    <option value="">Todos os status</option>
                                    {SUPPORT_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                                </select>
                                <select value={ticketCategoryFilter} onChange={(event) => setTicketCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                    <option value="">Todas as categorias</option>
                                    {SUPPORT_CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                            <div className="overflow-x-auto rounded-xl border border-black/8">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-black/[0.03] text-left text-black/55">
                                        <tr>
                                            <th className="px-3 py-3">Empresa</th>
                                            <th className="px-3 py-3">Ticket</th>
                                            <th className="px-3 py-3">Status</th>
                                            <th className="px-3 py-3">Urgencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supportTickets.map((ticket) => (
                                            <tr
                                                key={ticket.ticketId}
                                                className={`cursor-pointer border-t border-black/8 ${selectedTicketId === ticket.ticketId ? "bg-black/[0.04]" : "bg-white"}`}
                                                onClick={() => {
                                                    setSelectedTicketId(ticket.ticketId);
                                                    void loadTicketDetail(ticket.ticketId);
                                                }}
                                            >
                                                <td className="px-3 py-3">{ticket.companyName}</td>
                                                <td className="px-3 py-3">{ticket.title}</td>
                                                <td className="px-3 py-3">{titleCase(ticket.status)}</td>
                                                <td className="px-3 py-3">{titleCase(ticket.urgency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="rounded-xl border border-black/8 bg-black/[0.02] p-4">
                                {ticketDetailLoading ? <p className="text-sm text-black/55">Carregando ticket...</p> : null}
                                {ticketDetailError ? <p className="text-sm text-red-700">{ticketDetailError}</p> : null}
                                {!ticketDetailLoading && !ticketDetail && !ticketDetailError ? <p className="text-sm text-black/55">Selecione um ticket para ver os detalhes.</p> : null}

                                {ticketDetail ? (
                                    <div className="grid gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-black/40">{ticketDetail.companyName}</p>
                                            <h3 className="mt-2 text-xl font-bold text-io-dark">{ticketDetail.title}</h3>
                                            <p className="mt-2 text-sm leading-6 text-black/65">{ticketDetail.description}</p>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="rounded-xl bg-white p-3 text-sm text-black/65">
                                                <p><span className="font-semibold text-io-dark">Categoria:</span> {titleCase(ticketDetail.category)}</p>
                                                <p className="mt-1"><span className="font-semibold text-io-dark">Urgencia:</span> {titleCase(ticketDetail.urgency)}</p>
                                                <p className="mt-1"><span className="font-semibold text-io-dark">Aberto por:</span> {ticketDetail.openedByName || "-"}</p>
                                            </div>
                                            <div className="rounded-xl bg-white p-3 text-sm text-black/65">
                                                <p><span className="font-semibold text-io-dark">Criado em:</span> {toBrDateTime(ticketDetail.createdAt)}</p>
                                                <p className="mt-1"><span className="font-semibold text-io-dark">Primeira resposta:</span> {toBrDateTime(ticketDetail.firstResponseAt)}</p>
                                                <p className="mt-1"><span className="font-semibold text-io-dark">Resolvido em:</span> {toBrDateTime(ticketDetail.resolvedAt)}</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                            <select value={ticketStatusDraft} onChange={(event) => setTicketStatusDraft(event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                                {SUPPORT_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                                            </select>
                                            <button type="button" onClick={() => void handleTicketStatusUpdate()} disabled={ticketActionLoading} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                                                {ticketActionLoading ? "Salvando..." : "Atualizar status"}
                                            </button>
                                        </div>

                                        <div className="rounded-xl border border-black/8 bg-white p-3">
                                            <p className="text-sm font-semibold text-io-dark">Historico de mensagens</p>
                                            <div className="mt-3 grid gap-3">
                                                {ticketDetail.messages.map((message) => (
                                                    <div key={message.id} className="rounded-lg bg-black/[0.03] p-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">{titleCase(message.senderType)}</p>
                                                            <p className="text-xs text-black/45">{toBrDateTime(message.createdAt)}</p>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-black/70">{message.message}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <textarea
                                                value={ticketReply}
                                                onChange={(event) => setTicketReply(event.target.value)}
                                                rows={4}
                                                placeholder="Responder ticket"
                                                className="rounded-xl border border-black/12 px-3 py-3 text-sm outline-none transition focus:border-black/25"
                                            />
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                {ticketActionFeedback ? <p className="text-sm text-black/60">{ticketActionFeedback}</p> : <span />}
                                                <button type="button" onClick={() => void handleTicketReplySubmit()} disabled={ticketActionLoading || !ticketReply.trim()} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                                                    {ticketActionLoading ? "Enviando..." : "Enviar resposta"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    function renderInsights() {
        const cancellationRiskCustomers = Array.isArray(dashboardData?.cancellationRiskCustomers) ? dashboardData.cancellationRiskCustomers : [];
        const upgradeReadyCustomers = Array.isArray(dashboardData?.upgradeReadyCustomers) ? dashboardData.upgradeReadyCustomers : [];
        const highRevenuePotentialCustomers = Array.isArray(dashboardData?.highRevenuePotentialCustomers) ? dashboardData.highRevenuePotentialCustomers : [];
        const underusedFeatures = Array.isArray(dashboardData?.underusedFeatures) ? dashboardData.underusedFeatures : [];

        return (
            <div className="grid gap-5">
                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Maior risco de cancelamento</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55">
                                    <tr>
                                        <th className="py-2">Empresa</th>
                                        <th>Score</th>
                                        <th>Classificacao</th>
                                        <th>Risco</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cancellationRiskCustomers.slice(0, 40).map((row: Record<string, any>) => (
                                        <tr key={row.tenantId} className="border-t border-black/8">
                                            <td className="py-2">{row.companyName}</td>
                                            <td>{toNumber(row.score)}</td>
                                            <td>{row.classification}</td>
                                            <td>{row.riskLevel}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Clientes prontos para upgrade</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55">
                                    <tr>
                                        <th className="py-2">Empresa</th>
                                        <th>Plano</th>
                                        <th>Pressao</th>
                                        <th>Leads 30d</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upgradeReadyCustomers.slice(0, 40).map((row: Record<string, any>) => (
                                        <tr key={row.tenantId} className="border-t border-black/8">
                                            <td className="py-2">{row.companyName}</td>
                                            <td>{row.planName}</td>
                                            <td>{toPercent(row.usagePressurePercent)}</td>
                                            <td>{toNumber(row.leads30d)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Maior potencial de faturamento</p>
                        <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55">
                                    <tr>
                                        <th className="py-2">Empresa</th>
                                        <th>Score</th>
                                        <th>Leads 90d</th>
                                        <th>Vendas 90d</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {highRevenuePotentialCustomers.slice(0, 40).map((row: Record<string, any>) => (
                                        <tr key={row.tenantId} className="border-t border-black/8">
                                            <td className="py-2">{row.companyName}</td>
                                            <td>{(row.potentialScore ?? 0).toFixed(2)}</td>
                                            <td>{toNumber(row.leads90d)}</td>
                                            <td>{toNumber(row.sales90d)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <p className="text-sm font-semibold text-io-dark">Funcionalidades subutilizadas</p>
                        <div className="mt-3">
                            <BarRows rows={underusedFeatures.map((row: Record<string, any>) => ({
                                label: titleCase(row.featureKey),
                                value: row.uniqueCustomersCount ?? 0,
                                detail: `Adocao: ${toPercent(row.adoptionRate)}`,
                            }))} />
                        </div>
                    </section>
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
            <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <p className="text-xs uppercase tracking-[0.24em] text-black/40">{meta.label}</p>
                <h1 className="mt-2 font-display text-3xl font-bold text-io-dark">{meta.title}</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-black/60">{meta.description}</p>
                <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-black/60">{meta.spotlight}</p>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-1 text-xs text-black/55">
                        Data inicial
                        <input value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} type="date" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Data final
                        <input value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} type="date" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Plano
                        <input value={filters.plan} onChange={(event) => updateFilter("plan", event.target.value)} placeholder="Start, Pro, Scale..." className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Cidade
                        <input value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="Cidade" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Regiao
                        <input value={filters.region} onChange={(event) => updateFilter("region", event.target.value)} placeholder="UF ou regiao" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-1 text-xs text-black/55">
                        Recorrencia
                        <select value={filters.recurrence} onChange={(event) => updateFilter("recurrence", event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                            <option value="">Todas</option>
                            <option value="MONTHLY">Mensal</option>
                            <option value="ANNUAL">Anual</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Status
                        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                            <option value="">Todos</option>
                            <option value="ACTIVE">Ativo</option>
                            <option value="TRIAL">Trial</option>
                            <option value="OVERDUE">Em atraso</option>
                            <option value="CANCELED">Cancelado</option>
                            <option value="BLOCKED">Bloqueado</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Origem
                        <input value={filters.origin} onChange={(event) => updateFilter("origin", event.target.value)} placeholder="utm, parceria, indicacao..." className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Tamanho do estoque
                        <select value={filters.stockSize} onChange={(event) => updateFilter("stockSize", event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                            <option value="">Todos</option>
                            <option value="UP_TO_20">Ate 20</option>
                            <option value="FROM_20_TO_50">20 a 50</option>
                            <option value="OVER_50">50+</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Busca geral
                        <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Empresa ou email" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => void load()} disabled={loading} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {loading ? "Carregando..." : "Aplicar filtros"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const resetFilters = defaultFilters();
                            setFilters(resetFilters);
                            setTicketStatusFilter("");
                            setTicketCategoryFilter("");
                            void load(resetFilters, "", "");
                        }}
                        className="h-10 rounded-full border border-black/10 px-4 text-sm font-semibold text-io-dark"
                    >
                        Limpar filtros
                    </button>
                    {section === "operacional" ? <p className="text-sm text-black/55">Os filtros de tickets ficam dentro da mesa operacional.</p> : null}
                </div>

                {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            </section>

            {loading && !dashboardData ? <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-black/55">Carregando dados...</div> : null}
            {!loading && !error && !dashboardData ? <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-black/55">Sem dados para o periodo selecionado.</div> : null}
            {!error && dashboardData ? content : null}
        </div>
    );
}
