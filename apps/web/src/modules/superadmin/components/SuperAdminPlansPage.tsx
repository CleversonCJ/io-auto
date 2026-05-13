"use client";

import { useEffect, useMemo, useState } from "react";
import {
    BadgeCent,
    CarFront,
    Layers3,
    PencilLine,
    Plus,
    ShieldCheck,
    Sparkles,
    Trash2,
    Users2,
} from "lucide-react";

type PlanFeatures = {
    catalogBioLink: boolean;
    whatsappSharing: boolean;
    storefrontPage: boolean;
    webmotors: boolean;
    olx: boolean;
    icarros: boolean;
    crmKanban: boolean;
    leadManagement: boolean;
    finance: boolean;
    reports: boolean;
    trackableLinks: boolean;
    multiunits: boolean;
    advancedMultiuser: boolean;
    executiveDashboard: boolean;
    integrationsApi: boolean;
    assistedOnboarding: boolean;
    prioritySupport: boolean;
    customizations: boolean;
};

type PlanRow = {
    planId: string;
    planKey: string;
    planName: string;
    description?: string | null;
    billingRecurrence?: string | null;
    priceCents?: number | null;
    customPlan: boolean;
    systemPlan: boolean;
    active: boolean;
    sortOrder: number;
    usersLimit?: number | null;
    vehiclesLimit?: number | null;
    activeAdsLimit?: number | null;
    features: PlanFeatures;
    assignedCompaniesCount: number;
    createdAt: string;
    updatedAt: string;
};

type PlanFormState = {
    planId: string | null;
    planName: string;
    planKey: string;
    description: string;
    billingRecurrence: string;
    price: string;
    customPlan: boolean;
    systemPlan: boolean;
    active: boolean;
    sortOrder: string;
    usersLimit: string;
    vehiclesLimit: string;
    activeAdsLimit: string;
    features: PlanFeatures;
};

const FEATURE_GROUPS: Array<{
    key: keyof PlanFeatures;
    label: string;
    description: string;
}> = [
    { key: "catalogBioLink", label: "Catalogo com link na bio", description: "Permite usar o catalogo publico da loja." },
    { key: "whatsappSharing", label: "Compartilhar no WhatsApp", description: "Libera o compartilhamento do estoque por WhatsApp." },
    { key: "storefrontPage", label: "Pagina da loja", description: "Libera a pagina personalizada da revenda." },
    { key: "webmotors", label: "Integracao Webmotors", description: "Permite configurar e publicar na Webmotors." },
    { key: "olx", label: "Integracao OLX", description: "Permite configurar e publicar na OLX." },
    { key: "icarros", label: "Integracao iCarros", description: "Permite configurar publicacoes do iCarros." },
    { key: "crmKanban", label: "CRM Kanban", description: "Libera a estrutura completa do CRM." },
    { key: "leadManagement", label: "Gestao de leads", description: "Libera listagem e operacao dos leads do catalogo." },
    { key: "finance", label: "Financeiro", description: "Libera contas, DRE e operacao financeira." },
    { key: "reports", label: "Relatorios", description: "Libera os relatorios operacionais." },
    { key: "trackableLinks", label: "Links rastreaveis", description: "Libera links de influencer e rastreamento." },
    { key: "multiunits", label: "Multiunidades", description: "Marca o plano como apto para multiunidades." },
    { key: "advancedMultiuser", label: "Multiusuario avancado", description: "Habilita configuracoes avancadas de usuarios." },
    { key: "executiveDashboard", label: "Dashboard executivo", description: "Libera os paines executivos da conta." },
    { key: "integrationsApi", label: "API de integracoes", description: "Libera integrações por API." },
    { key: "assistedOnboarding", label: "Implantacao assistida", description: "Marca o plano com onboarding assistido." },
    { key: "prioritySupport", label: "Suporte prioritario", description: "Marca o plano com suporte prioritario." },
    { key: "customizations", label: "Personalizacoes", description: "Marca o plano como apto a customizacoes." },
];

const EMPTY_FEATURES: PlanFeatures = {
    catalogBioLink: false,
    whatsappSharing: false,
    storefrontPage: false,
    webmotors: false,
    olx: false,
    icarros: false,
    crmKanban: false,
    leadManagement: false,
    finance: false,
    reports: false,
    trackableLinks: false,
    multiunits: false,
    advancedMultiuser: false,
    executiveDashboard: false,
    integrationsApi: false,
    assistedOnboarding: false,
    prioritySupport: false,
    customizations: false,
};

const EMPTY_FORM: PlanFormState = {
    planId: null,
    planName: "",
    planKey: "",
    description: "",
    billingRecurrence: "MONTHLY",
    price: "",
    customPlan: false,
    systemPlan: false,
    active: true,
    sortOrder: "0",
    usersLimit: "",
    vehiclesLimit: "",
    activeAdsLimit: "",
    features: EMPTY_FEATURES,
};

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message ?? fallbackMessage);
    }
    return payload as T;
}

function toCurrency(cents?: number | null) {
    if (cents == null || cents <= 0) return "Sob consulta";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function toNumber(value?: number | null) {
    return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function toLimit(value: number | null | undefined, suffix: string) {
    if (value == null || value <= 0) return `Sem limite de ${suffix}`;
    return `Ate ${toNumber(value)} ${suffix}`;
}

function toRecurrence(value?: string | null) {
    if (!value) return "Sob consulta";
    return value === "ANNUAL" ? "Cobranca anual" : "Cobranca mensal";
}

function buildFormFromPlan(plan: PlanRow): PlanFormState {
    return {
        planId: plan.planId,
        planName: plan.planName ?? "",
        planKey: plan.planKey ?? "",
        description: plan.description ?? "",
        billingRecurrence: plan.billingRecurrence ?? "",
        price: plan.priceCents ? String(plan.priceCents / 100) : "",
        customPlan: Boolean(plan.customPlan),
        systemPlan: Boolean(plan.systemPlan),
        active: Boolean(plan.active),
        sortOrder: String(plan.sortOrder ?? 0),
        usersLimit: plan.usersLimit ? String(plan.usersLimit) : "",
        vehiclesLimit: plan.vehiclesLimit ? String(plan.vehiclesLimit) : "",
        activeAdsLimit: plan.activeAdsLimit ? String(plan.activeAdsLimit) : "",
        features: { ...plan.features },
    };
}

function buildPayload(form: PlanFormState) {
    const priceNumber = Number(form.price);
    const toLimitValue = (raw: string) => {
        const numeric = Number(raw);
        return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
    };

    return {
        planName: form.planName.trim(),
        planKey: form.planKey.trim() || null,
        description: form.description.trim() || null,
        billingRecurrence: form.billingRecurrence || null,
        priceCents: Number.isFinite(priceNumber) && priceNumber > 0 ? Math.round(priceNumber * 100) : null,
        customPlan: form.customPlan,
        systemPlan: form.systemPlan,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
        usersLimit: toLimitValue(form.usersLimit),
        vehiclesLimit: toLimitValue(form.vehiclesLimit),
        activeAdsLimit: toLimitValue(form.activeAdsLimit),
        featureCatalogBioLink: form.features.catalogBioLink,
        featureWhatsappSharing: form.features.whatsappSharing,
        featureStorefrontPage: form.features.storefrontPage,
        featureWebmotors: form.features.webmotors,
        featureOlx: form.features.olx,
        featureIcarros: form.features.icarros,
        featureCrmKanban: form.features.crmKanban,
        featureLeadManagement: form.features.leadManagement,
        featureFinance: form.features.finance,
        featureReports: form.features.reports,
        featureTrackableLinks: form.features.trackableLinks,
        featureMultiunits: form.features.multiunits,
        featureAdvancedMultiuser: form.features.advancedMultiuser,
        featureExecutiveDashboard: form.features.executiveDashboard,
        featureIntegrationsApi: form.features.integrationsApi,
        featureAssistedOnboarding: form.features.assistedOnboarding,
        featurePrioritySupport: form.features.prioritySupport,
        featureCustomizations: form.features.customizations,
    };
}

export function SuperAdminPlansPage() {
    const [rows, setRows] = useState<PlanRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);

    async function loadPlans() {
        setLoading(true);
        setError(null);
        try {
            const payload = await fetchJson<PlanRow[]>("/api/superadmin/plans", undefined, "Falha ao carregar os planos.");
            setRows(Array.isArray(payload) ? payload : []);
        } catch (requestError) {
            setRows([]);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar os planos.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadPlans();
    }, []);

    const summary = useMemo(() => {
        const totalAssigned = rows.reduce((acc, row) => acc + (row.assignedCompaniesCount ?? 0), 0);
        return {
            totalPlans: rows.length,
            activePlans: rows.filter((row) => row.active).length,
            customPlans: rows.filter((row) => row.customPlan).length,
            totalAssigned,
        };
    }, [rows]);

    const featuredPlans = useMemo(() => rows.slice().sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 3), [rows]);

    function resetForm() {
        setForm(EMPTY_FORM);
    }

    function editPlan(plan: PlanRow) {
        setFeedback(null);
        setForm(buildFormFromPlan(plan));
    }

    function toggleFeature(key: keyof PlanFeatures) {
        setForm((current) => ({
            ...current,
            features: {
                ...current.features,
                [key]: !current.features[key],
            },
        }));
    }

    async function handleSubmit() {
        setSaving(true);
        setError(null);
        setFeedback(null);

        try {
            const payload = buildPayload(form);
            const url = form.planId ? `/api/superadmin/plans/${encodeURIComponent(form.planId)}` : "/api/superadmin/plans";
            const method = form.planId ? "PUT" : "POST";
            await fetchJson<PlanRow>(
                url,
                {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
                "Falha ao salvar o plano.",
            );
            setFeedback(form.planId ? "Plano atualizado com sucesso." : "Plano criado com sucesso.");
            resetForm();
            await loadPlans();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao salvar o plano.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(plan: PlanRow) {
        if (!window.confirm(`Excluir o plano ${plan.planName}?`)) return;
        setDeletingId(plan.planId);
        setError(null);
        setFeedback(null);

        try {
            await fetchJson(
                `/api/superadmin/plans/${encodeURIComponent(plan.planId)}`,
                { method: "DELETE" },
                "Falha ao excluir o plano.",
            );
            setFeedback(`Plano ${plan.planName} removido com sucesso.`);
            if (form.planId === plan.planId) {
                resetForm();
            }
            await loadPlans();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao excluir o plano.");
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="grid gap-6">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white"
                >
                    <Plus className="h-4 w-4" />
                    Novo plano
                </button>
            </div>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efe4ff] text-[#6b00e3]">
                            <Layers3 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-black/45">Planos</p>
                            <p className="mt-1 text-2xl font-bold text-io-dark">{toNumber(summary.totalPlans)}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black/55">Catalogo total configurado no sistema.</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-black/45">Ativos</p>
                            <p className="mt-1 text-2xl font-bold text-io-dark">{toNumber(summary.activePlans)}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black/55">Planos habilitados para uso e atribuicao.</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-black/45">Personalizados</p>
                            <p className="mt-1 text-2xl font-bold text-io-dark">{toNumber(summary.customPlans)}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black/55">Planos criados para operacoes especificas.</p>
                </article>
                <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                            <Users2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-black/45">Empresas vinculadas</p>
                            <p className="mt-1 text-2xl font-bold text-io-dark">{toNumber(summary.totalAssigned)}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black/55">Contas protegidas pelos limites atuais.</p>
                </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-io-dark">{form.planId ? "Editar plano" : "Criar novo plano"}</p>
                            <p className="text-xs text-black/55">Defina limites e recursos que serao aplicados de forma obrigatoria no backend.</p>
                        </div>
                        {form.planId ? (
                            <button type="button" onClick={resetForm} className="text-sm font-semibold text-black/55">
                                Limpar edicao
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs text-black/55">
                            Nome do plano
                            <input
                                value={form.planName}
                                onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                placeholder="Ex: Pro Plus"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Chave tecnica
                            <input
                                value={form.planKey}
                                onChange={(event) => setForm((current) => ({ ...current, planKey: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                placeholder="ex: pro-plus"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55 md:col-span-2">
                            Descricao
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                className="min-h-[96px] rounded-xl border border-black/10 px-3 py-3 text-sm"
                                placeholder="Resumo comercial e operacional do plano."
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Valor mensal (BRL)
                            <input
                                value={form.price}
                                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="197.00"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Recorrencia
                            <select
                                value={form.billingRecurrence}
                                onChange={(event) => setForm((current) => ({ ...current, billingRecurrence: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                            >
                                <option value="MONTHLY">Mensal</option>
                                <option value="ANNUAL">Anual</option>
                                <option value="">Sob consulta</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Limite de usuarios
                            <input
                                value={form.usersLimit}
                                onChange={(event) => setForm((current) => ({ ...current, usersLimit: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                type="number"
                                min="0"
                                placeholder="3"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Limite de veiculos ativos
                            <input
                                value={form.vehiclesLimit}
                                onChange={(event) => setForm((current) => ({ ...current, vehiclesLimit: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                type="number"
                                min="0"
                                placeholder="20"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Limite de anuncios ativos
                            <input
                                value={form.activeAdsLimit}
                                onChange={(event) => setForm((current) => ({ ...current, activeAdsLimit: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                type="number"
                                min="0"
                                placeholder="20"
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-black/55">
                            Ordem visual
                            <input
                                value={form.sortOrder}
                                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                                className="h-11 rounded-xl border border-black/10 px-3 text-sm"
                                type="number"
                                min="0"
                            />
                        </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-5">
                        <label className="inline-flex items-center gap-2 text-sm text-black/65">
                            <input type="checkbox" checked={form.active} onChange={() => setForm((current) => ({ ...current, active: !current.active }))} />
                            Plano ativo
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-black/65">
                            <input type="checkbox" checked={form.customPlan} onChange={() => setForm((current) => ({ ...current, customPlan: !current.customPlan }))} />
                            Plano personalizado
                        </label>
                        {form.systemPlan ? <span className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-semibold text-black/60">Plano principal protegido</span> : null}
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                        {FEATURE_GROUPS.map((feature) => (
                            <button
                                key={feature.key}
                                type="button"
                                onClick={() => toggleFeature(feature.key)}
                                className={`rounded-2xl border p-4 text-left transition ${
                                    form.features[feature.key]
                                        ? "border-[#6b00e3]/25 bg-[#f7f1ff] shadow-sm"
                                        : "border-black/10 bg-white hover:border-black/20"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-io-dark">{feature.label}</p>
                                        <p className="mt-1 text-xs leading-5 text-black/55">{feature.description}</p>
                                    </div>
                                    <span
                                        className={`mt-1 inline-flex h-6 min-w-[48px] items-center justify-center rounded-full text-[11px] font-semibold ${
                                            form.features[feature.key] ? "bg-[#6b00e3] text-white" : "bg-black/5 text-black/45"
                                        }`}
                                    >
                                        {form.features[feature.key] ? "Ativo" : "Off"}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {feedback ? <p className="mt-4 text-sm text-emerald-700">{feedback}</p> : null}
                    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

                    <div className="mt-5 flex justify-end">
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={saving}
                            className="inline-flex h-11 items-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            <BadgeCent className="h-4 w-4" />
                            {saving ? "Salvando..." : form.planId ? "Atualizar plano" : "Salvar plano"}
                        </button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {featuredPlans.map((plan, index) => (
                        <article
                            key={plan.planId}
                            className={`rounded-[28px] border p-5 shadow-sm ${
                                index === 1 ? "border-[#6b00e3]/20 bg-[#f8f3ff]" : "border-black/10 bg-white"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.16em] text-black/45">
                                        {plan.customPlan ? "Personalizado" : plan.systemPlan ? "Plano principal" : "Plano"}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-io-dark">{plan.planName}</h2>
                                    <p className="mt-2 text-sm text-black/60">{plan.description || "Sem descricao comercial cadastrada."}</p>
                                </div>
                                <button type="button" onClick={() => editPlan(plan)} className="rounded-full border border-black/10 p-2 text-black/60 transition hover:border-black/20 hover:text-io-dark">
                                    <PencilLine className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-white/75 p-4">
                                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Preco</p>
                                    <p className="mt-2 text-lg font-bold text-io-dark">{toCurrency(plan.priceCents)}</p>
                                    <p className="mt-1 text-xs text-black/55">{toRecurrence(plan.billingRecurrence)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/75 p-4">
                                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Empresas</p>
                                    <p className="mt-2 text-lg font-bold text-io-dark">{toNumber(plan.assignedCompaniesCount)}</p>
                                    <p className="mt-1 text-xs text-black/55">{plan.active ? "Disponivel para atribuicao" : "Plano pausado"}</p>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                                    <div className="flex items-center gap-2 text-black/55">
                                        <Users2 className="h-4 w-4" />
                                        <span className="text-xs uppercase tracking-[0.14em]">Usuarios</span>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-io-dark">{toLimit(plan.usersLimit, "usuarios")}</p>
                                </div>
                                <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                                    <div className="flex items-center gap-2 text-black/55">
                                        <CarFront className="h-4 w-4" />
                                        <span className="text-xs uppercase tracking-[0.14em]">Veiculos</span>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-io-dark">{toLimit(plan.vehiclesLimit, "veiculos")}</p>
                                </div>
                                <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                                    <div className="flex items-center gap-2 text-black/55">
                                        <Layers3 className="h-4 w-4" />
                                        <span className="text-xs uppercase tracking-[0.14em]">Anuncios</span>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-io-dark">{toLimit(plan.activeAdsLimit, "anuncios")}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-black/40">
                                <th className="px-3 py-2">Plano</th>
                                <th className="px-3 py-2">Preco</th>
                                <th className="px-3 py-2">Limites</th>
                                <th className="px-3 py-2">Recursos</th>
                                <th className="px-3 py-2">Empresas</th>
                                <th className="px-3 py-2">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-black/45">
                                        Carregando planos...
                                    </td>
                                </tr>
                            ) : rows.length ? (
                                rows.map((plan) => {
                                    const activeFeatureCount = Object.values(plan.features).filter(Boolean).length;
                                    return (
                                        <tr key={plan.planId} className="rounded-[24px] bg-black/[0.02]">
                                            <td className="rounded-l-[22px] px-3 py-4 align-top">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-io-dark">{plan.planName}</p>
                                                    {plan.systemPlan ? <span className="rounded-full bg-black/10 px-2 py-1 text-[11px] font-semibold text-black/60">Sistema</span> : null}
                                                    {plan.customPlan ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Custom</span> : null}
                                                    {!plan.active ? <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">Inativo</span> : null}
                                                </div>
                                                <p className="mt-1 text-xs text-black/45">Chave: {plan.planKey}</p>
                                                <p className="mt-2 max-w-[280px] text-sm text-black/55">{plan.description || "Sem descricao."}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toCurrency(plan.priceCents)}</p>
                                                <p className="mt-1 text-xs text-black/55">{toRecurrence(plan.billingRecurrence)}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">
                                                <p>{toLimit(plan.usersLimit, "usuarios")}</p>
                                                <p className="mt-1">{toLimit(plan.vehiclesLimit, "veiculos")}</p>
                                                <p className="mt-1">{toLimit(plan.activeAdsLimit, "anuncios")}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(activeFeatureCount)} recursos ativos</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {FEATURE_GROUPS.filter((feature) => plan.features[feature.key]).slice(0, 4).map((feature) => (
                                                        <span key={feature.key} className="rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold text-black/55">
                                                            {feature.label}
                                                        </span>
                                                    ))}
                                                    {activeFeatureCount > 4 ? (
                                                        <span className="rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold text-black/55">+{activeFeatureCount - 4}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(plan.assignedCompaniesCount)}</p>
                                                <p className="mt-1 text-xs text-black/55">empresas protegidas</p>
                                            </td>
                                            <td className="rounded-r-[22px] px-3 py-4 align-top">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => editPlan(plan)}
                                                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20"
                                                    >
                                                        <PencilLine className="h-3.5 w-3.5" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDelete(plan)}
                                                        disabled={plan.systemPlan || deletingId === plan.planId}
                                                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        {deletingId === plan.planId ? "Excluindo..." : "Excluir"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-black/45">
                                        Nenhum plano cadastrado.
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
