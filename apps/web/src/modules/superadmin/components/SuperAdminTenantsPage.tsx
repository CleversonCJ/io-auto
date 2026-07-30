"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ClipboardList, KeyRound, LockOpen, LogIn, PencilLine, Plus, X } from "lucide-react";
import { SuperAdminCustomPlanCheckoutModal } from "@/modules/superadmin/components/SuperAdminCustomPlanCheckoutModal";
import { SuperAdminSectionHeaderActions } from "@/modules/superadmin/components/SuperAdminSectionHeaderActions";
import { SuperAdminTenantPlanChangeModal } from "@/modules/superadmin/components/SuperAdminTenantPlanChangeModal";
import { SuperAdminTenantCreateModal } from "@/modules/superadmin/components/SuperAdminTenantCreateModal";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

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

type FilterState = {
    status: string;
    search: string;
    plan: string;
    city: string;
    origin: string;
};

type TenantActionModalState =
    | { type: "block"; tenant: TenantRow }
    | { type: "reset"; tenant: TenantRow }
    | null;

const DEFAULT_FILTERS: FilterState = {
    status: "",
    search: "",
    plan: "",
    city: "",
    origin: "",
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

function billingCycleLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (!normalized) return "-";
    if (normalized === "MONTHLY" || normalized === "MONTH") return "Mensal";
    if (normalized === "YEARLY" || normalized === "ANNUAL" || normalized === "YEAR") return "Anual";
    if (normalized === "WEEKLY" || normalized === "WEEK") return "Semanal";
    if (normalized === "BIWEEKLY") return "Quinzenal";
    if (normalized === "QUARTERLY") return "Trimestral";
    if (normalized === "SEMIANNUALLY") return "Semestral";
    return titleCase(normalized);
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
    if (normalized === "OVERDUE") return "bg-amber-100 text-amber-700";
    if (normalized === "BLOCKED") return "bg-red-100 text-red-700";
    if (normalized === "CANCELED" || normalized === "CANCELLED") return "bg-slate-200 text-slate-700";
    return "bg-black/10 text-black/60";
}

function statusLabel(status?: string | null) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (!normalized) return "-";
    if (normalized === "BLOCKED") return "Blocked";
    return titleCase(normalized);
}

function blockButtonClasses(blocked: boolean) {
    if (blocked) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
    }
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
}

export function SuperAdminTenantsPage() {
    const router = useRouter();
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [rows, setRows] = useState<TenantRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [planTenant, setPlanTenant] = useState<TenantRow | null>(null);
    const [createTenantOpen, setCreateTenantOpen] = useState(false);
    const [createCustomPlanOpen, setCreateCustomPlanOpen] = useState(false);
    const [logsTenant, setLogsTenant] = useState<TenantRow | null>(null);
    const [logsRows, setLogsRows] = useState<TenantAdminLogRow[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
    const [actionModal, setActionModal] = useState<TenantActionModalState>(null);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const summary = useMemo(() => {
        const mappedMrrCents = rows.reduce((total, row) => total + (row.mrrCents ?? 0), 0);
        const recentAccessCount = rows.filter((row) => isRecentAccess(row.lastAccessAt)).length;
        const blockedCount = rows.filter((row) => row.status?.toUpperCase() === "BLOCKED").length;
        const canceledCount = rows.filter((row) => ["CANCELED", "CANCELLED"].includes(row.status?.toUpperCase())).length;
        return {
            total: rows.length,
            mappedMrrCents,
            recentAccessRate: rows.length ? (recentAccessCount * 100) / rows.length : 0,
            blockedCount,
            canceledCount,
        };
    }, [rows]);

    function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
        setFilters((current) => ({ ...current, [key]: value }));
    }

    function openPlanEditor(tenant: TenantRow) {
        setLogsTenant(null);
        setResetResult(null);
        setActionModal(null);
        setPlanTenant(tenant);
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
                "Falha ao iniciar a impersonação.",
            );
            setFeedback(`Sessão trocada para ${tenant.companyName}. Redirecionando para a conta...`);
            router.push("/protected");
            router.refresh();
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao iniciar a impersonação.");
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
            setActionModal(null);
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
            setActionModal(null);
            setResetResult(payload);
            setFeedback(`Reset de senha gerado para ${tenant.companyName}.`);
        } catch (requestError) {
            setFeedback(requestError instanceof Error ? requestError.message : "Falha ao resetar a senha.");
        } finally {
            setBusyAction(null);
        }
    }

    async function handleOpenLogs(tenant: TenantRow) {
        setPlanTenant(null);
        setResetResult(null);
        setActionModal(null);
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

    function closeAllOverlays() {
        setCreateTenantOpen(false);
        setCreateCustomPlanOpen(false);
        setPlanTenant(null);
        setLogsTenant(null);
        setResetResult(null);
        setActionModal(null);
    }

    if (loading && rows.length === 0) {
        return <SystemPageLoader label="Carregando empresas" description="Preparando tenants, planos e acessos..." />;
    }

    return (
        <div className="grid gap-6">
            <SuperAdminSectionHeaderActions>
                <button
                    type="button"
                    onClick={() => setCreateTenantOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-io-dark transition hover:border-black/20"
                >
                    <Plus className="h-4 w-4" />
                    Novo tenant
                </button>
                <button
                    type="button"
                    onClick={() => setCreateCustomPlanOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-io-dark transition hover:border-black/20"
                >
                    <Plus className="h-4 w-4" />
                    Plano personalizado
                </button>
            </SuperAdminSectionHeaderActions>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    <p className="mt-1 text-xs text-black/55">Logins em até 72 horas</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">Bloqueadas / canceladas</p>
                    <p className="mt-2 text-2xl font-bold text-io-dark">{toNumber(summary.blockedCount + summary.canceledCount)}</p>
                    <p className="mt-1 text-xs text-black/55">Contas que pedem ação operacional</p>
                </article>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-1 text-xs text-black/55">
                        Status
                        <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} className="h-10 rounded-lg border border-black/12 px-3 text-sm">
                            <option value="">Todos</option>
                            <option value="ACTIVE">Ativo</option>
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
                        <input value={filters.origin} onChange={(event) => setFilter("origin", event.target.value)} placeholder="utm, parceria, indicação..." className="h-10 rounded-lg border border-black/12 px-3 text-sm" />
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

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-black/40">
                                <th className="px-3 py-2">Empresa</th>
                                <th className="px-3 py-2">Plano</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Entrada</th>
                                <th className="px-3 py-2">último acesso</th>
                                <th className="px-3 py-2">MRR</th>
                                <th className="px-3 py-2">Saúde</th>
                                <th className="px-3 py-2">Ações</th>
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
                                                <p className="mt-1 text-xs text-black/55">Ciclo: {billingCycleLabel(row.billingRecurrence)}</p>
                                                <p className="mt-1 text-xs text-black/55">Contrato: {toCurrency(row.subscriptionAmountCents)}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${statusClasses(row.status || "")}`}>
                                                    {statusLabel(row.status)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">{toBrDate(row.entryDate)}</td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">{toBrDateTime(row.lastAccessAt)}</td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-bold text-io-dark">{toCurrency(row.mrrCents)}</p>
                                                <p className="mt-1 text-xs text-black/45">{toNumber(row.stockCount)} veículos | {toNumber(row.activeAdsCount)} anúncios</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(row.healthScore)}/100</p>
                                                <p className="mt-1 text-xs text-black/55">{titleCase(row.healthClassification)}</p>
                                            </td>
                                            <td className="rounded-r-[22px] px-3 py-4 align-top">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        title="Entrar como admin"
                                                        aria-label="Entrar como admin"
                                                        onClick={() => void handleImpersonate(row)}
                                                        disabled={busyAction === `impersonate:${row.tenantId}`}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-io-dark transition hover:border-black/20 disabled:opacity-60"
                                                    >
                                                        <LogIn className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Alterar plano"
                                                        aria-label="Alterar plano"
                                                        onClick={() => openPlanEditor(row)}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-io-dark transition hover:border-black/20"
                                                    >
                                                        <PencilLine className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title={blocked ? "Desbloquear tenant" : "Bloquear tenant"}
                                                        aria-label={blocked ? "Desbloquear tenant" : "Bloquear tenant"}
                                                        onClick={() => setActionModal({ type: "block", tenant: row })}
                                                        disabled={busyAction === `${blocked ? "unblock" : "block"}:${row.tenantId}`}
                                                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:opacity-60 ${blockButtonClasses(blocked)}`}
                                                    >
                                                        {blocked ? <LockOpen className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Resetar senha"
                                                        aria-label="Resetar senha"
                                                        onClick={() => setActionModal({ type: "reset", tenant: row })}
                                                        disabled={busyAction === `reset:${row.tenantId}`}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-io-dark transition hover:border-black/20 disabled:opacity-60"
                                                    >
                                                        <KeyRound className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Ver logs"
                                                        aria-label="Ver logs"
                                                        onClick={() => void handleOpenLogs(row)}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-io-dark transition hover:border-black/20"
                                                    >
                                                        <ClipboardList className="h-4 w-4" />
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

            {planTenant ? (
                <SuperAdminTenantPlanChangeModal
                    tenant={{ tenantId: planTenant.tenantId, companyName: planTenant.companyName }}
                    onClose={() => setPlanTenant(null)}
                    onConfirmed={async (message) => {
                        setFeedback(message);
                        await loadTenants();
                    }}
                />
            ) : null}

            {createTenantOpen ? (
                <SuperAdminTenantCreateModal
                    onClose={() => setCreateTenantOpen(false)}
                    onCreated={async (message) => {
                        setFeedback(message);
                        await loadTenants();
                    }}
                />
            ) : null}

            {createCustomPlanOpen ? (
                <SuperAdminCustomPlanCheckoutModal
                    onClose={() => setCreateCustomPlanOpen(false)}
                    onCreated={async (message) => {
                        setFeedback(message);
                    }}
                />
            ) : null}

            {logsTenant ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onClick={closeAllOverlays}>
                    <section
                        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-io-dark">Logs de {logsTenant.companyName}</p>
                                <p className="text-xs text-black/55">Histórico operacional real do tenant.</p>
                            </div>
                            <button type="button" onClick={closeAllOverlays} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/55">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {logsLoading ? <p className="mt-4 text-sm text-black/55">Carregando logs...</p> : null}
                        {logsError ? <p className="mt-4 text-sm text-red-700">{logsError}</p> : null}
                        {!logsLoading ? (
                            <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="text-left text-black/55">
                                        <tr>
                                            <th className="py-2">Quando</th>
                                            <th>Ação</th>
                                            <th>Descrição</th>
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
                </div>
            ) : null}

            {resetResult ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onClick={closeAllOverlays}>
                    <section
                        className="w-full max-w-2xl rounded-[32px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">Reset de senha gerado</p>
                            <button type="button" onClick={closeAllOverlays} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 text-amber-950">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-4">Usuário: {resetResult.userEmail || resetResult.userId}</p>
                        <p className="mt-2">O e-mail de redefinição de senha foi enfileirado para envio automático.</p>
                        <p className="mt-2">Expira em: {toBrDateTime(resetResult.expiresAt)}</p>
                        <p className="mt-2 text-xs text-amber-900/80">Token técnico gerado: {resetResult.token}</p>
                    </section>
                </div>
            ) : null}

            {actionModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onClick={closeAllOverlays}>
                    <section
                        className="w-full max-w-xl rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-io-dark">
                                    {actionModal.type === "block"
                                        ? `${actionModal.tenant.status?.toUpperCase() === "BLOCKED" ? "Desbloquear" : "Bloquear"} tenant`
                                        : "Resetar senha"}
                                </p>
                                <p className="text-xs text-black/55">{actionModal.tenant.companyName}</p>
                            </div>
                            <button type="button" onClick={closeAllOverlays} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/55">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-4 text-sm text-black/65">
                            {actionModal.type === "block"
                                ? `Tem certeza que deseja ${actionModal.tenant.status?.toUpperCase() === "BLOCKED" ? "desbloquear" : "bloquear"} esse tenant?`
                                : "Tem certeza que deseja gerar um reset de senha para esse tenant?"}
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            {actionModal.type === "block" ? (
                                <div className="mr-auto inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
                                    {actionModal.tenant.status?.toUpperCase() === "BLOCKED" ? "Ação: desbloquear" : "Ação: bloquear"}
                                </div>
                            ) : null}
                            <button type="button" onClick={closeAllOverlays} className="h-10 rounded-full border border-black/10 px-4 text-sm font-semibold text-io-dark">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void (actionModal.type === "block" ? handleBlockToggle(actionModal.tenant) : handleResetPassword(actionModal.tenant))}
                                disabled={
                                    actionModal.type === "block"
                                        ? busyAction === `${actionModal.tenant.status?.toUpperCase() === "BLOCKED" ? "unblock" : "block"}:${actionModal.tenant.tenantId}`
                                        : busyAction === `reset:${actionModal.tenant.tenantId}`
                                }
                                className={`h-10 rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60 ${
                                    actionModal.type === "block"
                                        ? actionModal.tenant.status?.toUpperCase() === "BLOCKED"
                                            ? "bg-emerald-600"
                                            : "bg-red-600"
                                        : "bg-io-dark"
                                }`}
                            >
                                {actionModal.type === "block"
                                    ? busyAction === `${actionModal.tenant.status?.toUpperCase() === "BLOCKED" ? "unblock" : "block"}:${actionModal.tenant.tenantId}`
                                        ? "Salvando..."
                                        : actionModal.tenant.status?.toUpperCase() === "BLOCKED"
                                            ? "Desbloquear"
                                            : "Bloquear"
                                    : busyAction === `reset:${actionModal.tenant.tenantId}`
                                        ? "Gerando..."
                                        : "Gerar reset"}
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
