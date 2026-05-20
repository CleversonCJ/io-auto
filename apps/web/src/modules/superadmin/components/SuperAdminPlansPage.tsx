"use client";

import { useEffect, useState } from "react";
import { BadgeCent, PencilLine, Plus, Trash2 } from "lucide-react";

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
    monthlyPriceCents?: number | null;
    annualPriceCents?: number | null;
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
    monthlyPrice: string;
    annualPrice: string;
    customPlan: boolean;
    systemPlan: boolean;
    active: boolean;
    sortOrder: string;
    usersLimit: string;
    vehiclesLimit: string;
    activeAdsLimit: string;
    features: PlanFeatures;
};

type PlanFormErrors = Partial<Record<
    | "planName"
    | "planKey"
    | "description"
    | "monthlyPrice"
    | "annualPrice"
    | "usersLimit"
    | "vehiclesLimit"
    | "activeAdsLimit"
    | "sortOrder",
    string
>>;

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
    monthlyPrice: "",
    annualPrice: "",
    customPlan: false,
    systemPlan: false,
    active: true,
    sortOrder: "0",
    usersLimit: "",
    vehiclesLimit: "",
    activeAdsLimit: "",
    features: EMPTY_FEATURES,
};

const EMPTY_FORM_ERRORS: PlanFormErrors = {};

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

function formatCurrencyInput(raw: string) {
    if (!raw) return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(raw) / 100);
}

function normalizeCurrencyDigits(value: string) {
    return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function buildFormFromPlan(plan: PlanRow): PlanFormState {
    return {
        planId: plan.planId,
        planName: plan.planName ?? "",
        planKey: plan.planKey ?? "",
        description: plan.description ?? "",
        monthlyPrice: plan.monthlyPriceCents ? String(plan.monthlyPriceCents) : "",
        annualPrice: plan.annualPriceCents ? String(plan.annualPriceCents) : "",
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
    const toLimitValue = (raw: string) => {
        const numeric = Number(raw);
        return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
    };

    return {
        planName: form.planName.trim(),
        planKey: form.planKey.trim() || null,
        description: form.description.trim() || null,
        billingRecurrence: null,
        priceCents: null,
        monthlyPriceCents: form.monthlyPrice ? Number(form.monthlyPrice) : null,
        annualPriceCents: form.annualPrice ? Number(form.annualPrice) : null,
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
    const [formErrors, setFormErrors] = useState<PlanFormErrors>(EMPTY_FORM_ERRORS);
    const [modalOpen, setModalOpen] = useState(false);

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

    function resetForm() {
        setForm(EMPTY_FORM);
        setFormErrors(EMPTY_FORM_ERRORS);
    }

    function openCreateModal() {
        resetForm();
        setError(null);
        setFeedback(null);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        resetForm();
    }

    function editPlan(plan: PlanRow) {
        setError(null);
        setFeedback(null);
        setForm(buildFormFromPlan(plan));
        setModalOpen(true);
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

    function validateForm(nextForm: PlanFormState) {
        const errors: PlanFormErrors = {};

        if (!nextForm.planName.trim()) errors.planName = "Informe o nome do plano.";
        if (!nextForm.planKey.trim()) errors.planKey = "Informe a chave técnica do plano.";
        if (!nextForm.description.trim()) errors.description = "Informe a descrição do plano.";
        if (!nextForm.monthlyPrice.trim()) errors.monthlyPrice = "Informe o valor mensal.";
        if (!nextForm.annualPrice.trim()) errors.annualPrice = "Informe o valor anual.";
        if (!nextForm.usersLimit.trim()) errors.usersLimit = "Informe o limite de usuários.";
        if (!nextForm.vehiclesLimit.trim()) errors.vehiclesLimit = "Informe o limite de veículos ativos.";
        if (!nextForm.activeAdsLimit.trim()) errors.activeAdsLimit = "Informe o limite de anúncios ativos.";
        if (!nextForm.sortOrder.trim()) errors.sortOrder = "Informe a ordem visual do plano.";

        return errors;
    }

    async function handleSubmit() {
        const nextErrors = validateForm(form);
        setFormErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            setError("Preencha todos os campos obrigatórios antes de salvar o plano.");
            setFeedback(null);
            return;
        }

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
            closeModal();
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
                closeModal();
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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-io-dark">Planos</h2>
                    <p className="mt-1 text-sm text-black/55">Listagem enxuta com nome, precos, limites, recursos e empresas vinculadas.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white"
                >
                    <Plus className="h-4 w-4" />
                    Novo plano
                </button>
            </div>

            {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-black/40">
                                <th className="px-3 py-2">Plano</th>
                                <th className="px-3 py-2">Precos</th>
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
                                    const keyFeatures = FEATURE_GROUPS.filter((feature) => plan.features[feature.key]).slice(0, 3);

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
                                                <p className="mt-2 max-w-[320px] text-sm text-black/55">{plan.description || "Sem descricao comercial."}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">Mensal: {toCurrency(plan.monthlyPriceCents)}</p>
                                                <p className="mt-1 text-sm font-semibold text-io-dark">Anual: {toCurrency(plan.annualPriceCents)}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top text-sm text-black/60">
                                                <p>{toLimit(plan.usersLimit, "usuarios")}</p>
                                                <p className="mt-1">{toLimit(plan.vehiclesLimit, "veiculos")}</p>
                                                <p className="mt-1">{toLimit(plan.activeAdsLimit, "anuncios")}</p>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(activeFeatureCount)} recursos ativos</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {keyFeatures.map((feature) => (
                                                        <span key={feature.key} className="rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold text-black/55">
                                                            {feature.label}
                                                        </span>
                                                    ))}
                                                    {activeFeatureCount > keyFeatures.length ? (
                                                        <span className="rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold text-black/55">+{activeFeatureCount - keyFeatures.length}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <p className="text-sm font-semibold text-io-dark">{toNumber(plan.assignedCompaniesCount)}</p>
                                                <p className="mt-1 text-xs text-black/55">empresas vinculadas</p>
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

            {modalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
                    <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-io-dark">{form.planId ? "Editar plano" : "Criar novo plano"}</p>
                                <p className="text-xs text-black/55">Defina precos, limites e recursos que serao aplicados no backend.</p>
                            </div>
                            <button type="button" onClick={closeModal} className="text-sm font-semibold text-black/55">
                                Fechar
                            </button>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <label className="grid gap-1 text-xs text-black/55">
                                Nome do plano
                                <input
                                    value={form.planName}
                                    onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.planName ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    placeholder="Ex: Pro Plus"
                                />
                                {formErrors.planName ? <span className="text-xs text-red-700">{formErrors.planName}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Chave tecnica
                                <input
                                    value={form.planKey}
                                    onChange={(event) => setForm((current) => ({ ...current, planKey: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.planKey ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    placeholder="ex: pro-plus"
                                />
                                {formErrors.planKey ? <span className="text-xs text-red-700">{formErrors.planKey}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55 md:col-span-2">
                                Descricao
                                <textarea
                                    value={form.description}
                                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    className={`min-h-[96px] rounded-xl border px-3 py-3 text-sm ${formErrors.description ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    placeholder="Resumo comercial e operacional do plano."
                                />
                                {formErrors.description ? <span className="text-xs text-red-700">{formErrors.description}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Valor mensal (BRL)
                                <MoneyField
                                    value={form.monthlyPrice}
                                    onChange={(value) => setForm((current) => ({ ...current, monthlyPrice: value }))}
                                    invalid={Boolean(formErrors.monthlyPrice)}
                                />
                                {formErrors.monthlyPrice ? <span className="text-xs text-red-700">{formErrors.monthlyPrice}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Valor anual (BRL)
                                <MoneyField
                                    value={form.annualPrice}
                                    onChange={(value) => setForm((current) => ({ ...current, annualPrice: value }))}
                                    invalid={Boolean(formErrors.annualPrice)}
                                />
                                {formErrors.annualPrice ? <span className="text-xs text-red-700">{formErrors.annualPrice}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Limite de usuarios
                                <input
                                    value={form.usersLimit}
                                    onChange={(event) => setForm((current) => ({ ...current, usersLimit: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.usersLimit ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    type="number"
                                    min="0"
                                    placeholder="3"
                                />
                                {formErrors.usersLimit ? <span className="text-xs text-red-700">{formErrors.usersLimit}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Limite de veiculos ativos
                                <input
                                    value={form.vehiclesLimit}
                                    onChange={(event) => setForm((current) => ({ ...current, vehiclesLimit: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.vehiclesLimit ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    type="number"
                                    min="0"
                                    placeholder="20"
                                />
                                {formErrors.vehiclesLimit ? <span className="text-xs text-red-700">{formErrors.vehiclesLimit}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Limite de anuncios ativos
                                <input
                                    value={form.activeAdsLimit}
                                    onChange={(event) => setForm((current) => ({ ...current, activeAdsLimit: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.activeAdsLimit ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    type="number"
                                    min="0"
                                    placeholder="20"
                                />
                                {formErrors.activeAdsLimit ? <span className="text-xs text-red-700">{formErrors.activeAdsLimit}</span> : null}
                            </label>
                            <label className="grid gap-1 text-xs text-black/55">
                                Ordem visual
                                <input
                                    value={form.sortOrder}
                                    onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                                    className={`h-11 rounded-xl border px-3 text-sm ${formErrors.sortOrder ? "border-red-300 bg-red-50" : "border-black/10"}`}
                                    type="number"
                                    min="0"
                                />
                                {formErrors.sortOrder ? <span className="text-xs text-red-700">{formErrors.sortOrder}</span> : null}
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

                        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="inline-flex h-11 items-center rounded-full border border-black/10 px-5 text-sm font-semibold text-io-dark"
                            >
                                Cancelar
                            </button>
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
                </div>
            ) : null}
        </div>
    );
}

function MoneyField({
    value,
    onChange,
    invalid = false,
}: {
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
}) {
    return (
        <input
            value={formatCurrencyInput(value)}
            onChange={(event) => onChange(normalizeCurrencyDigits(event.target.value))}
            inputMode="numeric"
            placeholder="R$ 0,00"
            className={`h-11 rounded-xl border px-3 text-sm font-semibold text-io-dark outline-none transition focus:border-black/30 ${invalid ? "border-red-300 bg-red-50" : "border-black/10"}`}
        />
    );
}
