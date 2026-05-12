"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { superAdminSections } from "@/modules/superadmin/data";

type TenantRow = {
    tenantId: string;
    companyName: string;
    companyEmail?: string | null;
    planId?: string | null;
    planName: string;
    planKey: string;
    status: string;
    subscriptionAmountCents: number;
    billingRecurrence: string;
    entryDate: string;
    lastAccessAt?: string | null;
    mrrCents: number;
    city?: string | null;
    region?: string | null;
    originSource?: string | null;
    stockCount: number;
    activeAdsCount: number;
    healthScore: number;
    healthClassification: string;
};

type TenantAdminLogRow = {
    id: string;
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    description: string;
    metadata?: string | null;
    createdAt: string;
};

type ResetPasswordResult = {
    tenantId: string;
    userId: string;
    userEmail: string;
    token: string;
    expiresAt: string;
};

type PlanOption = {
    planId: string;
    planKey: string;
    planName: string;
    billingRecurrence?: string | null;
    priceCents?: number | null;
    customPlan: boolean;
    usersLimit?: number | null;
    vehiclesLimit?: number | null;
    activeAdsLimit?: number | null;
};

type FilterState = {
    status: string;
    search: string;
    plan: string;
    city: string;
    origin: string;
};

type PlanFormState = {
    planId: string;
    amount: string;
    billingRecurrence: string;
    subscriptionStatus: string;
};

const DEFAULT_FILTERS: FilterState = {
    status: "",
    search: "",
    plan: "",
    city: "",
    origin: "",
};

const EMPTY_PLAN_FORM: PlanFormState = {
    planId: "",
    amount: "",
    billingRecurrence: "MONTHLY",
    subscriptionStatus: "ACTIVE",
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

function buildQuery(filters: FilterState) {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.plan.trim()) query.set("plan", filters.plan.trim());
    if (filters.city.trim()) query.set("city", filters.city.trim());
    if (filters.origin.trim()) query.set("origin", filters.origin.trim());
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

function isRecentAccess(value?: string | null) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() <= 1000 * 60 * 60 * 72;
}

function statusClasses(status: string) {
    const normalized = status.toUpperCase();
    if (normalized === "ACTIVE") return "bg-emerald-100 text-emerald-700";
    if (normalized === "TRIAL") return "bg-sky-100 text-sky-700";
    if (normalized === "OVERDUE") return "bg-amber-100 text-amber-700";
    if (normalized === "BLOCKED") return "bg-red-100 text-red-700";
    if (normalized === "CANCELED" || normalized === "CANCELLED") return "bg-slate-200 text-slate-700";
    return "bg-black/10 text-black/60";
}

export function SuperAdminTenantsPage() {
    const router = useRouter();
    const meta = superAdminSections.tenants;
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [rows, setRows] = useState<TenantRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [planTenant, setPlanTenant] = useState<TenantRow | null>(null);
    const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
    const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
    const [planSaving, setPlanSaving] = useState(false);
    const [logsTenant, setLogsTenant] = useState<TenantRow | null>(null);
    const [logsRows, setLogsRows] = useState<TenantAdminLogRow[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);

    async function loadTenants(nextFilters = filters) {
        setLoading(true);
        setError(null);

        try {
            const query = buildQuery(nextFilters);
            const payload = await fetchJson<TenantRow[]>(
                `/api/superadmin/tenants${query ? `?${query}` : ""}`,
                undefined,
                "Falha ao carregar os tenants do superadmin.",
            );
            setRows(Array.isArray(payload) ? payload : []);
        } catch (requestError) {
            setRows([]);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar os tenants.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadTenants(DEFAULT_FILTERS);
        void fetchJson<PlanOption[]>("/api/superadmin/plans/options", undefined, "Falha ao carregar os planos disponiveis.")
            .then((payload) => setPlanOptions(Array.isArray(payload) ? payload : []))
            .catch(() => setPlanOptions([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const summary = useMemo(() => {
        const mappedMrrCents = rows.reduce((total, row) => total + (row.mrrCents ?? 0), 0);
        const recentAccessCount = rows.filter((row) => isRecentAccess(row.lastAccessAt)).length;
        const blockedCount = rows.filter((row) => row.status?.toUpperCase() === "BLOCKED").length;
        const trialCount = rows.filter((row) => row.status?.toUpperCase() === "TRIAL").length;
        const canceledCount = rows.filter((row) => ["CANCELED", "CANCELLED"].includes(row.status?.toUpperCase())).length;
        return {
            total: rows.length,
            mappedMrrCents,
            recentAccessRate: rows.length ? (recentAccessCount * 100) / rows.length : 0,
            blockedCount,
            trialCount,
            canceledCount,
        };
    }, [rows]);

    function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
        setFilters((current) => ({ ...current, [key]: value }));
    }

    function openPlanEditor(tenant: TenantRow) {
        setPlanTenant(tenant);
        setPlanForm({
            planId: tenant.planId ?? "",
            amount: ((tenant.subscriptionAmountCents ?? 0) / 100).toFixed(2),
            billingRecurrence: tenant.billingRecurrence || "MONTHLY",
            subscriptionStatus: tenant.status || "ACTIVE",
        });
    }

    async function handleImpersonate(tenant: TenantRow) {
        setBusyAction(`impersonate:${tenant.tenantId}`);
        setFeedback(null);

        try {
            await fetchJson(
                "/api/auth/impersonation/start",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tenantId: tenant.tenantId }),
                },
                "Falha ao iniciar a impersonacao.",
            );
            setFeedback(`Sessao trocada para ${tenant.companyName}. Redirecionando para a conta...`);
            router.push("/protected");
            router.refresh();
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao iniciar a impersonacao.");
        } finally {
            setBusyAction(null);
        }
    }

    async function handleBlockToggle(tenant: TenantRow) {
        const isBlocked = tenant.status?.toUpperCase() === "BLOCKED";
        setBusyAction(`${isBlocked ? "unblock" : "block"}:${tenant.tenantId}`);
        setFeedback(null);

        try {
            await fetchJson(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/${isBlocked ? "unblock" : "block"}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason: isBlocked ? "Reativado pelo superadmin" : "Bloqueado pelo superadmin" }),
                },
                `Falha ao ${isBlocked ? "desbloquear" : "bloquear"} a conta.`,
            );
            setFeedback(`${tenant.companyName} foi ${isBlocked ? "desbloqueada" : "bloqueada"} com sucesso.`);
            await loadTenants();
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao atualizar o bloqueio da conta.");
        } finally {
            setBusyAction(null);
        }
    }

    async function handleResetPassword(tenant: TenantRow) {
        setBusyAction(`reset:${tenant.tenantId}`);
        setFeedback(null);

        try {
            const payload = await fetchJson<ResetPasswordResult>(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/reset-password`,
                { method: "POST" },
                "Falha ao gerar o reset de senha.",
            );
            setResetResult(payload);
            setFeedback(`Reset de senha gerado para ${tenant.companyName}.`);
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao resetar a senha.");
        } finally {
            setBusyAction(null);
        }
    }

    async function handleOpenLogs(tenant: TenantRow) {
        setLogsTenant(tenant);
        setLogsLoading(true);
        setLogsError(null);

        try {
            const payload = await fetchJson<TenantAdminLogRow[]>(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/logs`,
                undefined,
                "Falha ao carregar os logs da conta.",
            );
            setLogsRows(Array.isArray(payload) ? payload : []);
        } catch (requestError) {
            setLogsRows([]);
            setLogsError(requestError instanceof Error ? requestError.message : "Falha ao carregar os logs.");
        } finally {
            setLogsLoading(false);
        }
    }

    async function handlePlanSubmit() {
        if (!planTenant) return;

        setPlanSaving(true);
        setFeedback(null);

        try {
            const amountNumber = Number(planForm.amount);
            const subscriptionAmountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : 0;

            await fetchJson(
                `/api/superadmin/tenants/${encodeURIComponent(planTenant.tenantId)}/plan`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        planId: planForm.planId || null,
                        subscriptionAmountCents,
                        billingRecurrence: planForm.billingRecurrence,
                        subscriptionStatus: planForm.subscriptionStatus,
                    }),
                },
                "Falha ao atualizar o plano da conta.",
            );

            setFeedback(`Plano de ${planTenant.companyName} atualizado.`);
            setPlanTenant(null);
            setPlanForm(EMPTY_PLAN_FORM);
            await loadTenants();
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao salvar o plano.");
        } finally {
            setPlanSaving(false);
        }
    }

    return (
        <div className="grid gap-6">
            <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <p className="text-xs uppercase tracking-[0.24em] text-black/40">{meta.label}</p>
                <h1 className="mt-2 font-display text-3xl font-bold text-io-dark">{meta.title}</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-black/60">{meta.description}</p>
                <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-black/60">{meta.spotlight}</p>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">Empresas</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{toNumber(summary.total)}</p>
                    <p className="mt-1 text-xs text-black/55">Tenants carregados do sistema</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">MRR mapeado</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{toCurrency(summary.mappedMrrCents)}</p>
                    <p className="mt-1 text-xs text-black/55">Receita mensal equivalente por tenant</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">Acesso recente</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{summary.recentAccessRate.toFixed(2)}%</p>
                    <p className="mt-1 text-xs text-black/55">Logins em ate 72 horas</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">Trials</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{toNumber(summary.trialCount)}</p>
                    <p className="mt-1 text-xs text-black/55">Contas em periodo de teste</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">Bloqueadas / canceladas</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{toNumber(summary.blockedCount + summary.canceledCount)}</p>
                    <p className="mt-1 text-xs text-black/55">Contas que pedem acao operacional</p>
                </article>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-1 text-xs text-black/55">
                        Status
                        <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                            <option value="">Todos</option>
                            <option value="ACTIVE">Ativo</option>
                            <option value="TRIAL">Trial</option>
                            <option value="OVERDUE">Em atraso</option>
                            <option value="BLOCKED">Bloqueado</option>
                            <option value="CANCELED">Cancelado</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Busca
                        <input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Empresa ou email" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Plano
                        <input value={filters.plan} onChange={(event) => setFilter("plan", event.target.value)} placeholder="Start, Pro, Scale..." className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Cidade
                        <input value={filters.city} onChange={(event) => setFilter("city", event.target.value)} placeholder="Cidade" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                    <label className="grid gap-1 text-xs text-black/55">
                        Origem
                        <input value={filters.origin} onChange={(event) => setFilter("origin", event.target.value)} placeholder="utm, parceria, indicacao..." className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => void loadTenants()} disabled={loading} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {loading ? "Carregando..." : "Aplicar filtros"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setFilters(DEFAULT_FILTERS);
                            void loadTenants(DEFAULT_FILTERS);
                        }}
                        className="h-10 rounded-full border border-black/10 px-4 text-sm font-semibold text-io-dark"
                    >
                        Limpar filtros
                    </button>
                </div>

                {feedback ? <p className="mt-4 text-sm text-black/65">{feedback}</p> : null}
                {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
            </section>

            {planTenant ? (
                <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-io-dark">Editar plano de {planTenant.companyName}</p>
                            <p className="text-xs text-black/55">Atualiza plano, recorrencia, valor contratado e status da assinatura.</p>
                        </div>
                        <button type="button" onClick={() => setPlanTenant(null)} className="text-sm font-semibold text-black/55">Fechar</button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <label className="grid gap-1 text-xs text-black/55">
                            Plano
                            <select value={planForm.planId} onChange={(event) => setPlanForm((current) => ({ ...current, planId: event.target.value }))} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                <option value="">Selecione</option>
                                {planOptions.map((plan) => (
                                    <option key={plan.planId} value={plan.planId}>
                                        {plan.planName}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Valor contratado (BRL)
                            <input value={planForm.amount} onChange={(event) => setPlanForm((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" step="0.01" className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Recorrencia
                            <select value={planForm.billingRecurrence} onChange={(event) => setPlanForm((current) => ({ ...current, billingRecurrence: event.target.value }))} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                <option value="MONTHLY">Mensal</option>
                                <option value="ANNUAL">Anual</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Status da assinatura
                            <select value={planForm.subscriptionStatus} onChange={(event) => setPlanForm((current) => ({ ...current, subscriptionStatus: event.target.value }))} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                                <option value="ACTIVE">Ativo</option>
                                <option value="TRIAL">Trial</option>
                                <option value="OVERDUE">Em atraso</option>
                                <option value="BLOCKED">Bloqueado</option>
                                <option value="CANCELED">Cancelado</option>
                            </select>
                        </label>
                        <div className="rounded-lg border border-dashed border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/55">
                            {planForm.planId
                                ? (() => {
                                      const plan = planOptions.find((item) => item.planId === planForm.planId);
                                      if (!plan) return "Plano selecionado sem detalhes disponiveis.";
                                      return `${plan.planName} | ${plan.usersLimit ?? "ilimitado"} usuarios | ${plan.vehiclesLimit ?? "ilimitado"} veiculos`;
                                  })()
                                : "Selecione um plano do catalogo para aplicar a conta."}
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button type="button" onClick={() => void handlePlanSubmit()} disabled={planSaving} className="h-10 rounded-full bg-io-dark px-4 text-sm font-semibold text-white disabled:opacity-60">
                            {planSaving ? "Salvando..." : "Salvar plano"}
                        </button>
                    </div>
                </section>
            ) : null}

            {resetResult ? (
                <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Reset de senha gerado</p>
                        <button type="button" onClick={() => setResetResult(null)} className="font-semibold">Fechar</button>
                    </div>
                    <p className="mt-3">Usuario: {resetResult.userEmail || resetResult.userId}</p>
                    <p className="mt-1">Token: {resetResult.token}</p>
                    <p className="mt-1">Expira em: {toBrDateTime(resetResult.expiresAt)}</p>
                </section>
            ) : null}

            {logsTenant ? (
                <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-io-dark">Logs de {logsTenant.companyName}</p>
                            <p className="text-xs text-black/55">Historico operacional real do tenant.</p>
                        </div>
                        <button type="button" onClick={() => setLogsTenant(null)} className="text-sm font-semibold text-black/55">Fechar</button>
                    </div>
                    {logsLoading ? <p className="mt-4 text-sm text-black/55">Carregando logs...</p> : null}
                    {logsError ? <p className="mt-4 text-sm text-red-700">{logsError}</p> : null}
                    {!logsLoading ? (
                        <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-black/55">
                                    <tr>
                                        <th className="py-2">Quando</th>
                                        <th>Acao</th>
                                        <th>Descricao</th>
                                        <th>Metadata</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logsRows.map((log) => (
                                        <tr key={log.id} className="border-t border-black/8">
                                            <td className="py-2">{toBrDateTime(log.createdAt)}</td>
                                            <td>{titleCase(log.action)}</td>
                                            <td>{log.description}</td>
                                            <td className="max-w-[320px] whitespace-pre-wrap break-words text-xs text-black/60">{log.metadata || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </section>
            ) : null}

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-black/40">
                                <th className="px-3 py-2">Empresa</th>
                                <th className="px-3 py-2">Plano</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Entrada</th>
                                <th className="px-3 py-2">Ultimo acesso</th>
                                <th className="px-3 py-2">MRR</th>
                                <th className="px-3 py-2">Saude</th>
                                <th className="px-3 py-2">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-black/45">
                                        Carregando tenants...
                                    </td>
                                </tr>
                            ) : rows.length ? (
                                rows.map((row) => {
                                    const blocked = row.status?.toUpperCase() === "BLOCKED";
                                    return (
                                        <tr key={row.tenantId} className="rounded-[24px] bg-black/[0.02]">
                                            <td className="rounded-l-[22px] px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{row.companyName}</p>
                                                <p className="mt-1 text-sm text-black/54">{row.companyEmail || "-"}</p>
                                                <p className="mt-2 text-xs text-black/45">
                                                    {[row.city, row.region].filter(Boolean).join("/") || "-"} | Origem: {row.originSource || "-"}
                                                </p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-medium text-io-dark">{row.planName || "-"}</p>
                                                <p className="mt-1 text-xs text-black/55">{titleCase(row.billingRecurrence)}</p>
                                                <p className="mt-1 text-xs text-black/55">Contrato: {toCurrency(row.subscriptionAmountCents)}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusClasses(row.status || "")}`}>
                                                    {titleCase(row.status)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">{toBrDate(row.entryDate)}</td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">{toBrDateTime(row.lastAccessAt)}</td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-bold text-io-dark">{toCurrency(row.mrrCents)}</p>
                                                <p className="mt-1 text-xs text-black/45">{toNumber(row.stockCount)} veiculos | {toNumber(row.activeAdsCount)} anuncios</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(row.healthScore)}/100</p>
                                                <p className="mt-1 text-xs text-black/55">{titleCase(row.healthClassification)}</p>
                                            </td>
                                            <td className="rounded-r-[22px] px-3 py-4 align-top">
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => void handleImpersonate(row)} disabled={busyAction === `impersonate:${row.tenantId}`} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20 disabled:opacity-60">
                                                        {busyAction === `impersonate:${row.tenantId}` ? "Entrando..." : "Entrar como admin"}
                                                    </button>
                                                    <button type="button" onClick={() => openPlanEditor(row)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20">
                                                        Alterar plano
                                                    </button>
                                                    <button type="button" onClick={() => void handleBlockToggle(row)} disabled={busyAction === `${blocked ? "unblock" : "block"}:${row.tenantId}`} className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60">
                                                        {busyAction === `${blocked ? "unblock" : "block"}:${row.tenantId}` ? "Salvando..." : blocked ? "Desbloquear" : "Bloquear"}
                                                    </button>
                                                    <button type="button" onClick={() => void handleResetPassword(row)} disabled={busyAction === `reset:${row.tenantId}`} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20 disabled:opacity-60">
                                                        {busyAction === `reset:${row.tenantId}` ? "Gerando..." : "Resetar senha"}
                                                    </button>
                                                    <button type="button" onClick={() => void handleOpenLogs(row)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20">
                                                        Ver logs
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-black/45">
                                        Nenhum tenant encontrado para este filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
