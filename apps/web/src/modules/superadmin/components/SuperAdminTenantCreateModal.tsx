"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { SuperAdminPlanOption } from "@/modules/superadmin/partnerProgramTypes";

type Props = {
    onClose: () => void;
    onCreated: (message: string) => Promise<void> | void;
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
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type ApiErrorPayload = {
    message?: string;
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

function billingRecurrenceLabel(value: string) {
    const normalized = value.trim().toUpperCase();
    if (normalized === "MONTHLY") return "Mensal";
    if (normalized === "ANNUAL" || normalized === "YEARLY" || normalized === "YEAR") return "Anual";
    if (normalized === "QUARTERLY") return "Trimestral";
    if (normalized === "SEMIANNUALLY") return "Semestral";
    return normalized || "Mensal";
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

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error((payload as ApiErrorPayload | null)?.message ?? fallbackMessage);
    }
    return payload as T;
}

function validateForm(form: FormState) {
    const errors: FieldErrors = {};

    if (!form.companyName.trim()) errors.companyName = "Informe o nome da empresa.";
    if (!form.companyEmail.trim()) errors.companyEmail = "Informe o e-mail da empresa.";
    if (normalizeDigits(form.cnpj).length !== 14) errors.cnpj = "Informe um CNPJ válido.";
    const phoneDigits = normalizeDigits(form.whatsappNumber);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.whatsappNumber = "Informe um telefone com DDD válido.";
    if (!form.openedAt) errors.openedAt = "Informe a data de abertura.";
    if (!form.contractEndDate) errors.contractEndDate = "Informe a data final do contrato.";
    if (!form.password.trim()) {
        errors.password = "Informe a senha inicial da conta.";
    } else if (form.password.length < 8) {
        errors.password = "A senha inicial deve conter no minimo 8 caracteres.";
    }
    if (!form.businessHoursStart) errors.businessHoursStart = "Informe o horário inicial.";
    if (!form.businessHoursEnd) errors.businessHoursEnd = "Informe o horário final.";
    if (form.businessHoursStart && form.businessHoursEnd && form.businessHoursStart >= form.businessHoursEnd) {
        errors.businessHoursEnd = "O horário final precisa ser maior que o inicial.";
    }
    if (!form.planId) errors.planId = "Selecione um plano.";
    if (!form.billingRecurrence) errors.billingRecurrence = "Selecione o ciclo de cobrança.";

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

    const recurrenceOptions = useMemo(
        () => resolveRecurrenceOptions(selectedPlan),
        [selectedPlan],
    );

    useEffect(() => {
        if (!recurrenceOptions.some((item) => item.value === form.billingRecurrence)) {
            setForm((current) => ({ ...current, billingRecurrence: recurrenceOptions[0]!.value }));
        }
    }, [recurrenceOptions, form.billingRecurrence]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        const validationErrors = validateForm(form);
        if (hasErrors(validationErrors)) {
            setFieldErrors(validationErrors);
            setError("Preencha todos os campos obrigatórios para criar a empresa.");
            return;
        }

        if (!selectedPlan) {
            setError("Selecione um plano válido para continuar.");
            return;
        }

        setSaving(true);
        setFieldErrors({});

        try {
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

            const planPayload: TenantPlanUpdatePayload = {
                planId: selectedPlan.planId,
                planName: selectedPlan.planName,
                planKey: selectedPlan.planKey,
                subscriptionAmountCents: resolvePlanAmountByRecurrence(selectedPlan, form.billingRecurrence),
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

            const message = `Empresa ${form.companyName.trim()} criada com sucesso no plano ${selectedPlan.planName}.`;
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
                                Este fluxo cria a empresa diretamente no sistema e aplica um plano já cadastrado.
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
                                    </select>
                                    {fieldErrors.planId ? <span className="text-xs text-red-700">{fieldErrors.planId}</span> : null}
                                </label>
                                <label className="grid gap-2 text-sm text-black/65">
                                    <span>Ciclo *</span>
                                    <select value={form.billingRecurrence} onChange={(event) => handleFieldChange("billingRecurrence", event.target.value)} disabled={loadingPlans || !selectedPlan} className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple disabled:opacity-60" required>
                                        {recurrenceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    {fieldErrors.billingRecurrence ? <span className="text-xs text-red-700">{fieldErrors.billingRecurrence}</span> : null}
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm text-black/65">
                                <span>Senha inicial do usuário proprietário *</span>
                                <input type="password" value={form.password} onChange={(event) => handleFieldChange("password", event.target.value)} placeholder="Defina uma senha temporária" className="h-11 rounded-xl border border-black/12 px-3 text-sm outline-none transition focus:border-io-purple" minLength={8} required />
                                {fieldErrors.password ? <span className="text-xs text-red-700">{fieldErrors.password}</span> : null}
                            </label>

                            {error ? <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                            {success ? <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

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
