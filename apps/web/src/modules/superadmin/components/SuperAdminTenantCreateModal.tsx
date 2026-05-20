"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { SuperAdminPlanOption } from "@/modules/superadmin/partnerProgramTypes";

type Props = {
    onClose: () => void;
    onCreated: (message: string) => Promise<void> | void;
};

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

type CreateCompanyPayload = {
    companyName: string;
    companyEmail: string;
    contractEndDate: string;
    cnpj: string;
    openedAt: string;
    whatsappNumber: string;
    password: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessHoursWeekly: Record<string, { active: boolean; start: string; lunchStart: string; lunchEnd: string; end: string }>;
};

type CreateCompanyResponse = {
    companyId: string;
    ownerUserId: string;
    ownerEmail: string;
};

type TenantPlanUpdatePayload = {
    planId: string;
    planName: string;
    planKey: string;
    subscriptionAmountCents: number | null;
    billingRecurrence: string;
    subscriptionStatus: string;
};

type CreatedPlanResponse = {
    planId: string;
    planKey: string;
    planName: string;
    monthlyPriceCents?: number | null;
    annualPriceCents?: number | null;
    priceCents?: number | null;
    billingRecurrence?: string | null;
};

type ManualCheckoutLinkResponse = {
    checkoutUrl: string;
    checkoutReference?: string | null;
    expiresAt?: string | null;
};

type FormState = {
    companyName: string;
    companyEmail: string;
    cnpj: string;
    whatsappNumber: string;
    openedAt: string;
    contractEndDate: string;
    password: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    planId: string;
    billingRecurrence: string;
    customPlanName: string;
    customPlanKey: string;
    customPlanDescription: string;
    customPlanSortOrder: string;
    customMonthlyPrice: string;
    customAnnualPrice: string;
    customUsersLimit: string;
    customVehiclesLimit: string;
    customActiveAdsLimit: string;
    customOrigin: string;
    customExpiresInMinutes: string;
    customFeatures: PlanFeatures;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type ApiErrorPayload = {
    message?: string;
};

const CUSTOM_PLAN_OPTION = "__CUSTOM_PLAN__";

const FEATURE_GROUPS: Array<{ key: keyof PlanFeatures; label: string; description: string }> = [
    { key: "catalogBioLink", label: "Catálogo com link na bio", description: "Permite usar o catálogo público da loja." },
    { key: "whatsappSharing", label: "Compartilhar no WhatsApp", description: "Libera o compartilhamento do estoque por WhatsApp." },
    { key: "storefrontPage", label: "Página da loja", description: "Libera a página personalizada da revenda." },
    { key: "webmotors", label: "Integração Webmotors", description: "Permite configurar e publicar na Webmotors." },
    { key: "olx", label: "Integração OLX", description: "Permite configurar e publicar na OLX." },
    { key: "icarros", label: "Integração iCarros", description: "Permite configurar publicações do iCarros." },
    { key: "crmKanban", label: "CRM Kanban", description: "Libera a estrutura completa do CRM." },
    { key: "leadManagement", label: "Gestão de leads", description: "Libera listagem e operação dos leads do catálogo." },
    { key: "finance", label: "Financeiro", description: "Libera contas, DRE e operação financeira." },
    { key: "reports", label: "Relatórios", description: "Libera os relatórios operacionais." },
    { key: "trackableLinks", label: "Links rastreáveis", description: "Libera links de influencer e rastreamento." },
    { key: "multiunits", label: "Multiunidades", description: "Marca o plano como apto para multiunidades." },
    { key: "advancedMultiuser", label: "Multiusuário avançado", description: "Habilita configurações avançadas de usuários." },
    { key: "executiveDashboard", label: "Dashboard executivo", description: "Libera os painéis executivos da conta." },
    { key: "integrationsApi", label: "API de integrações", description: "Libera integrações por API." },
    { key: "assistedOnboarding", label: "Implantação assistida", description: "Marca o plano com onboarding assistido." },
    { key: "prioritySupport", label: "Suporte prioritário", description: "Marca o plano com suporte prioritário." },
    { key: "customizations", label: "Personalizações", description: "Marca o plano como apto a customizações." },
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

const INITIAL_FORM: FormState = {
    companyName: "",
    companyEmail: "",
    cnpj: "",
    whatsappNumber: "",
    openedAt: "",
    contractEndDate: "",
    password: "",
    businessHoursStart: "08:00",
    businessHoursEnd: "18:00",
    planId: "",
    billingRecurrence: "MONTHLY",
    customPlanName: "",
    customPlanKey: "",
    customPlanDescription: "",
    customPlanSortOrder: "0",
    customMonthlyPrice: "",
    customAnnualPrice: "",
    customUsersLimit: "",
    customVehiclesLimit: "",
    customActiveAdsLimit: "",
    customOrigin: "",
    customExpiresInMinutes: "1440",
    customFeatures: EMPTY_FEATURES,
};

function normalizeDigits(value: string) {
    return value.replace(/\D/g, "");
}

function formatPhoneInput(value: string) {
    const digits = normalizeDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpj(value: string) {
    const digits = normalizeDigits(value).slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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

function billingRecurrenceLabel(value: string) {
    const normalized = value.trim().toUpperCase();
    if (normalized === "MONTHLY") return "Mensal";
    if (normalized === "ANNUAL" || normalized === "YEARLY" || normalized === "YEAR") return "Anual";
    if (normalized === "QUARTERLY") return "Trimestral";
    if (normalized === "SEMIANNUALLY") return "Semestral";
    return normalized || "Mensal";
}

function toCheckoutBillingPeriod(recurrence: string) {
    const normalized = recurrence.trim().toUpperCase();
    if (normalized === "ANNUAL" || normalized === "YEARLY" || normalized === "YEAR") return "annual";
    if (normalized === "QUARTERLY") return "quarterly";
    if (normalized === "SEMIANNUALLY") return "semiannually";
    return "monthly";
}

function defaultBusinessHoursWeekly(start: string, end: string) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
    const weekly = {} as Record<(typeof days)[number], { active: boolean; start: string; lunchStart: string; lunchEnd: string; end: string }>;

    for (const day of days) {
        weekly[day] = {
            active: day !== "sunday" && day !== "saturday",
            start,
            lunchStart: "12:00",
            lunchEnd: "13:00",
            end,
        };
    }

    return weekly;
}

function resolveRecurrenceOptions(plan: SuperAdminPlanOption | null | undefined) {
    if (!plan) return [{ value: "MONTHLY", label: "Mensal" }];
    const options: Array<{ value: string; label: string }> = [];

    if (plan.monthlyPriceCents != null) options.push({ value: "MONTHLY", label: "Mensal" });
    if (plan.annualPriceCents != null) options.push({ value: "ANNUAL", label: "Anual" });

    if (!options.length && plan.billingRecurrence) {
        const normalized = plan.billingRecurrence.trim().toUpperCase();
        options.push({ value: normalized, label: billingRecurrenceLabel(normalized) });
    }

    if (!options.length) options.push({ value: "MONTHLY", label: "Mensal" });
    return options;
}

function resolvePlanAmountByRecurrence(plan: SuperAdminPlanOption, recurrence: string) {
    const normalized = recurrence.trim().toUpperCase();
    if (normalized === "ANNUAL" || normalized === "YEARLY" || normalized === "YEAR") {
        if (plan.annualPriceCents != null) return plan.annualPriceCents;
        if ((plan.billingRecurrence || "").trim().toUpperCase() === "ANNUAL") return plan.priceCents ?? null;
        return plan.priceCents ?? plan.monthlyPriceCents ?? null;
    }
    if (normalized === "MONTHLY") {
        if (plan.monthlyPriceCents != null) return plan.monthlyPriceCents;
        if ((plan.billingRecurrence || "").trim().toUpperCase() === "MONTHLY") return plan.priceCents ?? null;
        return plan.priceCents ?? plan.annualPriceCents ?? null;
    }
    return plan.priceCents ?? plan.monthlyPriceCents ?? plan.annualPriceCents ?? null;
}

function slugifyPlanKey(raw: string) {
    const normalized = raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized.slice(0, 48);
}

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error((payload as ApiErrorPayload | null)?.message ?? fallbackMessage);
    }
    return payload as T;
}

function validateForm(form: FormState, isCustomPlan: boolean) {
    const errors: FieldErrors = {};

    if (!form.companyName.trim()) errors.companyName = "Informe o nome da empresa.";
    if (!form.companyEmail.trim()) errors.companyEmail = "Informe o e-mail da empresa.";
    if (normalizeDigits(form.cnpj).length !== 14) errors.cnpj = "Informe um CNPJ válido.";
    const phoneDigits = normalizeDigits(form.whatsappNumber);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.whatsappNumber = "Informe um telefone com DDD válido.";
    if (!form.openedAt) errors.openedAt = "Informe a data de abertura.";
    if (!form.contractEndDate) errors.contractEndDate = "Informe a data final do contrato.";
    if (!form.password.trim()) errors.password = "Informe a senha inicial da conta.";
    if (!form.businessHoursStart) errors.businessHoursStart = "Informe o horário inicial.";
    if (!form.businessHoursEnd) errors.businessHoursEnd = "Informe o horário final.";
    if (form.businessHoursStart && form.businessHoursEnd && form.businessHoursStart >= form.businessHoursEnd) {
        errors.businessHoursEnd = "O horário final precisa ser maior que o inicial.";
    }
    if (!form.planId) errors.planId = "Selecione um plano.";
    if (!form.billingRecurrence) errors.billingRecurrence = "Selecione o ciclo de cobrança.";

    if (isCustomPlan) {
        if (!form.customPlanName.trim()) errors.customPlanName = "Informe o nome do plano personalizado.";
        if (!form.customPlanDescription.trim()) errors.customPlanDescription = "Informe a descrição do plano personalizado.";
        if (!form.customMonthlyPrice.trim()) errors.customMonthlyPrice = "Informe o valor mensal do plano.";
        if (!form.customAnnualPrice.trim()) errors.customAnnualPrice = "Informe o valor anual do plano.";
        if (!form.customUsersLimit.trim()) errors.customUsersLimit = "Informe o limite de usuários.";
        if (!form.customVehiclesLimit.trim()) errors.customVehiclesLimit = "Informe o limite de veículos.";
        if (!form.customActiveAdsLimit.trim()) errors.customActiveAdsLimit = "Informe o limite de anúncios ativos.";
        if (!form.customExpiresInMinutes.trim()) errors.customExpiresInMinutes = "Informe o tempo de expiração do checkout.";
    }

    return errors;
}

function hasErrors(errors: FieldErrors) {
    return Object.values(errors).some(Boolean);
}

export function SuperAdminTenantCreateModal({ onClose, onCreated }: Props) {
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [plans, setPlans] = useState<SuperAdminPlanOption[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [checkoutInfo, setCheckoutInfo] = useState<ManualCheckoutLinkResponse | null>(null);

    const isCustomPlan = form.planId === CUSTOM_PLAN_OPTION;

    useEffect(() => {
        let mounted = true;

        async function loadPlans() {
            setLoadingPlans(true);
            setError(null);
            try {
                const payload = await fetchJson<SuperAdminPlanOption[]>(
                    "/api/superadmin/plans/options",
                    undefined,
                    "Falha ao carregar os planos disponíveis.",
                );
                if (!mounted) return;
                const sorted = (Array.isArray(payload) ? payload : []).sort((left, right) => left.planName.localeCompare(right.planName, "pt-BR"));
                setPlans(sorted);
                if (sorted.length) {
                    const defaultPlan = sorted[0]!;
                    const recurrenceOptions = resolveRecurrenceOptions(defaultPlan);
                    setForm((current) => ({
                        ...current,
                        planId: current.planId || defaultPlan.planId,
                        billingRecurrence: current.billingRecurrence || recurrenceOptions[0]!.value,
                    }));
                }
            } catch (requestError) {
                if (!mounted) return;
                setPlans([]);
                setError(requestError instanceof Error ? requestError.message : "Falha ao carregar os planos disponíveis.");
            } finally {
                if (mounted) setLoadingPlans(false);
            }
        }

        void loadPlans();
        return () => {
            mounted = false;
        };
    }, []);

    const selectedPlan = useMemo(
        () => plans.find((plan) => plan.planId === form.planId) ?? null,
        [plans, form.planId],
    );

    const recurrenceOptions = useMemo(() => {
        if (isCustomPlan) {
            return [
                { value: "MONTHLY", label: "Mensal" },
                { value: "ANNUAL", label: "Anual" },
            ];
        }
        return resolveRecurrenceOptions(selectedPlan);
    }, [isCustomPlan, selectedPlan]);

    useEffect(() => {
        if (!recurrenceOptions.some((item) => item.value === form.billingRecurrence)) {
            setForm((current) => ({ ...current, billingRecurrence: recurrenceOptions[0]!.value }));
        }
    }, [recurrenceOptions, form.billingRecurrence]);

    function toggleCustomFeature(key: keyof PlanFeatures) {
        setForm((current) => ({
            ...current,
            customFeatures: {
                ...current.customFeatures,
                [key]: !current.customFeatures[key],
            },
        }));
    }

    function toLimitValue(raw: string) {
        const numeric = Number(raw);
        return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
    }

    async function createCustomPlan() {
        const keyBase = form.customPlanKey.trim() || slugifyPlanKey(form.customPlanName);
        const generatedKey = keyBase ? `${keyBase}-${Date.now().toString().slice(-6)}` : `plano-personalizado-${Date.now().toString().slice(-6)}`;

        const payload = {
            planName: form.customPlanName.trim(),
            planKey: generatedKey,
            description: form.customPlanDescription.trim(),
            billingRecurrence: null,
            priceCents: null,
            monthlyPriceCents: Number(form.customMonthlyPrice),
            annualPriceCents: Number(form.customAnnualPrice),
            customPlan: true,
            systemPlan: false,
            active: true,
            sortOrder: Number(form.customPlanSortOrder) || 0,
            usersLimit: toLimitValue(form.customUsersLimit),
            vehiclesLimit: toLimitValue(form.customVehiclesLimit),
            activeAdsLimit: toLimitValue(form.customActiveAdsLimit),
            featureCatalogBioLink: form.customFeatures.catalogBioLink,
            featureWhatsappSharing: form.customFeatures.whatsappSharing,
            featureStorefrontPage: form.customFeatures.storefrontPage,
            featureWebmotors: form.customFeatures.webmotors,
            featureOlx: form.customFeatures.olx,
            featureIcarros: form.customFeatures.icarros,
            featureCrmKanban: form.customFeatures.crmKanban,
            featureLeadManagement: form.customFeatures.leadManagement,
            featureFinance: form.customFeatures.finance,
            featureReports: form.customFeatures.reports,
            featureTrackableLinks: form.customFeatures.trackableLinks,
            featureMultiunits: form.customFeatures.multiunits,
            featureAdvancedMultiuser: form.customFeatures.advancedMultiuser,
            featureExecutiveDashboard: form.customFeatures.executiveDashboard,
            featureIntegrationsApi: form.customFeatures.integrationsApi,
            featureAssistedOnboarding: form.customFeatures.assistedOnboarding,
            featurePrioritySupport: form.customFeatures.prioritySupport,
            featureCustomizations: form.customFeatures.customizations,
        };

        return fetchJson<CreatedPlanResponse>(
            "/api/superadmin/plans",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            },
            "Falha ao criar o plano personalizado.",
        );
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setCheckoutInfo(null);

        const validationErrors = validateForm(form, isCustomPlan);
        if (hasErrors(validationErrors)) {
            setFieldErrors(validationErrors);
            setError("Preencha todos os campos obrigatórios para criar a empresa.");
            return;
        }

        if (!isCustomPlan && !selectedPlan) {
            setError("Selecione um plano válido para continuar.");
            return;
        }

        setSaving(true);
        setFieldErrors({});

        try {
            let planForTenant: SuperAdminPlanOption;

            if (isCustomPlan) {
                const customPlan = await createCustomPlan();
                planForTenant = {
                    planId: customPlan.planId,
                    planKey: customPlan.planKey,
                    planName: customPlan.planName,
                    billingRecurrence: customPlan.billingRecurrence ?? "MONTHLY",
                    priceCents: customPlan.priceCents ?? null,
                    monthlyPriceCents: customPlan.monthlyPriceCents ?? null,
                    annualPriceCents: customPlan.annualPriceCents ?? null,
                    customPlan: true,
                    usersLimit: Number(form.customUsersLimit),
                    vehiclesLimit: Number(form.customVehiclesLimit),
                    activeAdsLimit: Number(form.customActiveAdsLimit),
                };
            } else {
                planForTenant = selectedPlan!;
            }

            const createPayload: CreateCompanyPayload = {
                companyName: form.companyName.trim(),
                companyEmail: form.companyEmail.trim().toLowerCase(),
                contractEndDate: form.contractEndDate,
                cnpj: normalizeDigits(form.cnpj),
                openedAt: form.openedAt,
                whatsappNumber: normalizeDigits(form.whatsappNumber),
                password: form.password,
                businessHoursStart: form.businessHoursStart,
                businessHoursEnd: form.businessHoursEnd,
                businessHoursWeekly: defaultBusinessHoursWeekly(form.businessHoursStart, form.businessHoursEnd),
            };

            const createResult = await fetchJson<CreateCompanyResponse>(
                "/api/auth/companies",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(createPayload),
                },
                "Falha ao criar a empresa manualmente.",
            );

            const planAmountCents = isCustomPlan
                ? form.billingRecurrence === "ANNUAL"
                    ? Number(form.customAnnualPrice)
                    : Number(form.customMonthlyPrice)
                : resolvePlanAmountByRecurrence(planForTenant, form.billingRecurrence);

            const planPayload: TenantPlanUpdatePayload = {
                planId: planForTenant.planId,
                planName: planForTenant.planName,
                planKey: planForTenant.planKey,
                subscriptionAmountCents: planAmountCents,
                billingRecurrence: form.billingRecurrence,
                subscriptionStatus: "ACTIVE",
            };

            await fetchJson(
                `/api/superadmin/tenants/${encodeURIComponent(createResult.companyId)}/plan`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(planPayload),
                },
                "Empresa criada, mas houve falha ao aplicar o plano selecionado.",
            );

            let message = `Empresa ${form.companyName.trim()} criada com sucesso no plano ${planForTenant.planName}.`;

            if (isCustomPlan) {
                const checkoutValue = Number((Number(form.billingRecurrence === "ANNUAL" ? form.customAnnualPrice : form.customMonthlyPrice) / 100).toFixed(2));
                const checkoutPayload = {
                    value: checkoutValue,
                    planName: planForTenant.planName,
                    billingPeriod: toCheckoutBillingPeriod(form.billingRecurrence),
                    origem: form.customOrigin.trim() || `superadmin-manual:${createResult.companyId}`,
                    expiresInMinutes: Number(form.customExpiresInMinutes || "1440"),
                };

                const checkout = await fetchJson<ManualCheckoutLinkResponse>(
                    `/api/superadmin/tenants/${encodeURIComponent(createResult.companyId)}/manual-checkout-link`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(checkoutPayload),
                    },
                    "Plano personalizado criado, mas não foi possível gerar o link de pagamento da landing.",
                );
                setCheckoutInfo(checkout);
                message = `${message} Link de pagamento do plano personalizado gerado com sucesso.`;
            }

            setSuccess(message);
            await onCreated(message);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir o cadastro manual da empresa.");
        } finally {
            setSaving(false);
        }
    }

    function handleFieldChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
        setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-6" onClick={onClose}>
            <div className="mx-auto flex h-full max-w-5xl items-start justify-center">
                <section
                    className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Novo tenant</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-io-dark">Cadastrar empresa manualmente</h3>
                            <p className="mt-1 text-sm text-black/55">
                                Para plano personalizado, preencha os recursos do plano e o sistema gera o link de pagamento da landing automaticamente.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                            aria-label="Fechar cadastro manual"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
                        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Nome da empresa *</span>
                                    <input value={form.companyName} onChange={(event) => handleFieldChange("companyName", event.target.value)} placeholder="Ex: Loja Exemplo" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.companyName ? <span className="text-xs text-red-700">{fieldErrors.companyName}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>E-mail da empresa *</span>
                                    <input type="email" value={form.companyEmail} onChange={(event) => handleFieldChange("companyEmail", event.target.value)} placeholder="contato@empresa.com.br" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.companyEmail ? <span className="text-xs text-red-700">{fieldErrors.companyEmail}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>WhatsApp da empresa *</span>
                                    <input value={form.whatsappNumber} onChange={(event) => handleFieldChange("whatsappNumber", formatPhoneInput(event.target.value))} inputMode="tel" maxLength={15} placeholder="(11) 99999-9999" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.whatsappNumber ? <span className="text-xs text-red-700">{fieldErrors.whatsappNumber}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>CNPJ *</span>
                                    <input value={form.cnpj} onChange={(event) => handleFieldChange("cnpj", formatCnpj(event.target.value))} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.cnpj ? <span className="text-xs text-red-700">{fieldErrors.cnpj}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Data de abertura *</span>
                                    <input type="date" value={form.openedAt} onChange={(event) => handleFieldChange("openedAt", event.target.value)} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.openedAt ? <span className="text-xs text-red-700">{fieldErrors.openedAt}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Fim do contrato *</span>
                                    <input type="date" value={form.contractEndDate} onChange={(event) => handleFieldChange("contractEndDate", event.target.value)} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.contractEndDate ? <span className="text-xs text-red-700">{fieldErrors.contractEndDate}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Horário inicial *</span>
                                    <input type="time" value={form.businessHoursStart} onChange={(event) => handleFieldChange("businessHoursStart", event.target.value)} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.businessHoursStart ? <span className="text-xs text-red-700">{fieldErrors.businessHoursStart}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Horário final *</span>
                                    <input type="time" value={form.businessHoursEnd} onChange={(event) => handleFieldChange("businessHoursEnd", event.target.value)} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                    {fieldErrors.businessHoursEnd ? <span className="text-xs text-red-700">{fieldErrors.businessHoursEnd}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Plano *</span>
                                    <select value={form.planId} onChange={(event) => handleFieldChange("planId", event.target.value)} disabled={loadingPlans} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple disabled:opacity-60" required>
                                        <option value="">Selecione</option>
                                        {plans.map((plan) => (
                                            <option key={plan.planId} value={plan.planId}>{plan.planName}</option>
                                        ))}
                                        <option value={CUSTOM_PLAN_OPTION}>Plano personalizado</option>
                                    </select>
                                    {fieldErrors.planId ? <span className="text-xs text-red-700">{fieldErrors.planId}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Ciclo *</span>
                                    <select value={form.billingRecurrence} onChange={(event) => handleFieldChange("billingRecurrence", event.target.value)} disabled={loadingPlans || (!selectedPlan && !isCustomPlan)} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple disabled:opacity-60" required>
                                        {recurrenceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    {fieldErrors.billingRecurrence ? <span className="text-xs text-red-700">{fieldErrors.billingRecurrence}</span> : null}
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm text-black/65">
                                <span>Senha inicial do usuário proprietário *</span>
                                <input type="password" value={form.password} onChange={(event) => handleFieldChange("password", event.target.value)} placeholder="Defina uma senha temporária" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" required />
                                {fieldErrors.password ? <span className="text-xs text-red-700">{fieldErrors.password}</span> : null}
                            </label>

                            {isCustomPlan ? (
                                <section className="grid gap-4 rounded-[22px] border border-black/10 bg-black/[0.02] p-4">
                                    <p className="text-sm font-semibold text-io-dark">Configuração do plano personalizado</p>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Nome do plano *</span>
                                            <input value={form.customPlanName} onChange={(event) => handleFieldChange("customPlanName", event.target.value)} placeholder="Ex: Plano Personalizado Premium" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customPlanName ? <span className="text-xs text-red-700">{fieldErrors.customPlanName}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Chave técnica (opcional)</span>
                                            <input value={form.customPlanKey} onChange={(event) => handleFieldChange("customPlanKey", event.target.value)} placeholder="plano-personalizado-premium" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65 md:col-span-2">
                                            <span>Descrição do plano *</span>
                                            <input value={form.customPlanDescription} onChange={(event) => handleFieldChange("customPlanDescription", event.target.value)} placeholder="Detalhes do plano personalizado" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customPlanDescription ? <span className="text-xs text-red-700">{fieldErrors.customPlanDescription}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Valor mensal *</span>
                                            <input value={formatCurrencyInput(form.customMonthlyPrice)} onChange={(event) => handleFieldChange("customMonthlyPrice", normalizeCurrencyDigits(event.target.value))} placeholder="R$ 0,00" inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customMonthlyPrice ? <span className="text-xs text-red-700">{fieldErrors.customMonthlyPrice}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Valor anual *</span>
                                            <input value={formatCurrencyInput(form.customAnnualPrice)} onChange={(event) => handleFieldChange("customAnnualPrice", normalizeCurrencyDigits(event.target.value))} placeholder="R$ 0,00" inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customAnnualPrice ? <span className="text-xs text-red-700">{fieldErrors.customAnnualPrice}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Limite de usuários *</span>
                                            <input value={form.customUsersLimit} onChange={(event) => handleFieldChange("customUsersLimit", event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customUsersLimit ? <span className="text-xs text-red-700">{fieldErrors.customUsersLimit}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Limite de veículos *</span>
                                            <input value={form.customVehiclesLimit} onChange={(event) => handleFieldChange("customVehiclesLimit", event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customVehiclesLimit ? <span className="text-xs text-red-700">{fieldErrors.customVehiclesLimit}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Limite de anúncios ativos *</span>
                                            <input value={form.customActiveAdsLimit} onChange={(event) => handleFieldChange("customActiveAdsLimit", event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customActiveAdsLimit ? <span className="text-xs text-red-700">{fieldErrors.customActiveAdsLimit}</span> : null}
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Ordem visual do plano</span>
                                            <input value={form.customPlanSortOrder} onChange={(event) => handleFieldChange("customPlanSortOrder", event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Origem do checkout</span>
                                            <input value={form.customOrigin} onChange={(event) => handleFieldChange("customOrigin", event.target.value)} placeholder="crm-consultor-1" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/65">
                                            <span>Expiração do link (minutos) *</span>
                                            <input value={form.customExpiresInMinutes} onChange={(event) => handleFieldChange("customExpiresInMinutes", event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-xl border border-black/12 bg-white px-3 text-sm" required />
                                            {fieldErrors.customExpiresInMinutes ? <span className="text-xs text-red-700">{fieldErrors.customExpiresInMinutes}</span> : null}
                                        </label>
                                    </div>

                                    <div className="grid gap-2">
                                        <p className="text-sm font-semibold text-io-dark">Funcionalidades desbloqueadas</p>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {FEATURE_GROUPS.map((feature) => (
                                                <button
                                                    key={feature.key}
                                                    type="button"
                                                    onClick={() => toggleCustomFeature(feature.key)}
                                                    className={`rounded-xl border px-3 py-3 text-left transition ${
                                                        form.customFeatures[feature.key]
                                                            ? "border-emerald-300 bg-emerald-50"
                                                            : "border-black/10 bg-white"
                                                    }`}
                                                >
                                                    <p className="text-sm font-semibold text-io-dark">{feature.label}</p>
                                                    <p className="mt-1 text-xs text-black/60">{feature.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            ) : null}

                            {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                            {success ? (
                                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    <p>{success}</p>
                                    {checkoutInfo?.checkoutUrl ? (
                                        <p className="mt-2">
                                            Link de pagamento:{" "}
                                            <a href={checkoutInfo.checkoutUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                                                abrir checkout
                                            </a>
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="flex flex-wrap justify-end gap-2">
                                <button type="button" onClick={onClose} className="h-11 rounded-full border border-black/12 px-5 text-sm font-semibold text-io-dark">
                                    {success ? "Fechar" : "Cancelar"}
                                </button>
                                {!success ? (
                                    <button type="submit" disabled={saving || loadingPlans} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-semibold text-white disabled:opacity-60">
                                        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                        {saving ? "Salvando..." : "Criar tenant"}
                                    </button>
                                ) : null}
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}
