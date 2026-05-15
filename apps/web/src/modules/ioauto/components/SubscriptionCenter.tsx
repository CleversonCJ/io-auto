"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, LoaderCircle } from "lucide-react";
import { billingTypeLabel, formatDateTime, formatMoney, statusLabel } from "@/modules/ioauto/formatters";
import { listEnabledFeatureLabels } from "@/modules/ioauto/planFeatures";
import type { BillingAccessStatusSnapshot, BillingPlanOption, BillingRegularizationOptions, BillingSnapshot } from "@/modules/ioauto/types";

type SubscriptionCenterProps = {
    title?: string;
    description?: string;
};

export function SubscriptionCenter({
    title = "Assinatura do tenant",
    description = "Cobranca recorrente pronta para operacao automatica via Asaas.",
}: SubscriptionCenterProps) {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [accessStatus, setAccessStatus] = useState<BillingAccessStatusSnapshot | null>(null);
    const [regularization, setRegularization] = useState<BillingRegularizationOptions | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);
    const [changingPlanId, setChangingPlanId] = useState<string | null>(null);
    const [selectedRecurrenceByPlan, setSelectedRecurrenceByPlan] = useState<Record<string, string>>({});

    async function loadBilling() {
        const [billingResponse, accessStatusResponse] = await Promise.all([
            fetch("/api/ioauto/billing", { cache: "no-store" }),
            fetch("/api/ioauto/billing/access-status", { cache: "no-store" }),
        ]);

        if (!billingResponse.ok) {
            const payload = await billingResponse.json().catch(() => ({ message: "Falha ao carregar a assinatura." }));
            throw new Error(payload.message ?? "Falha ao carregar a assinatura.");
        }

        const billingPayload = (await billingResponse.json()) as BillingSnapshot;
        setBilling(billingPayload);

        setSelectedRecurrenceByPlan((current) => {
            const next = { ...current };
            for (const plan of billingPayload.availablePlans ?? []) {
                if (!next[plan.planId]) {
                    next[plan.planId] = defaultRecurrenceForPlan(plan, billingPayload.billingInterval);
                }
            }
            return next;
        });

        if (!accessStatusResponse.ok) {
            setAccessStatus(null);
            setRegularization(null);
            return;
        }

        const accessPayload = (await accessStatusResponse.json()) as BillingAccessStatusSnapshot;
        setAccessStatus(accessPayload);

        if (!accessPayload.accessBlocked) {
            setRegularization(null);
            return;
        }

        const regularizationResponse = await fetch("/api/ioauto/billing/regularization-options", { cache: "no-store" });
        if (!regularizationResponse.ok) {
            setRegularization(null);
            return;
        }

        setRegularization((await regularizationResponse.json()) as BillingRegularizationOptions);
    }

    useEffect(() => {
        loadBilling().catch((cause: Error) => setError(cause.message));
    }, []);

    async function handleOpenPortal() {
        setOpeningPortal(true);
        setFeedback(null);
        const response = await fetch("/api/ioauto/billing/portal", { method: "POST" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ message: "Falha ao abrir a cobranca." }));
            setError(payload.message ?? "Falha ao abrir a cobranca.");
            setOpeningPortal(false);
            return;
        }
        const payload = (await response.json()) as { portalUrl: string };
        window.location.assign(payload.portalUrl);
    }

    async function handleChangePlan(plan: BillingPlanOption) {
        const billingRecurrence = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing?.billingInterval);
        setChangingPlanId(plan.planId);
        setError(null);
        setFeedback(null);

        try {
            const response = await fetch("/api/ioauto/billing/plan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan.planId,
                    billingRecurrence,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao trocar o plano." }));
                throw new Error(payload.message ?? "Falha ao trocar o plano.");
            }

            await loadBilling();
            setFeedback(plan.current ? "Ciclo do plano atualizado com sucesso." : `Plano alterado para ${plan.planName}.`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao trocar o plano.");
        } finally {
            setChangingPlanId(null);
        }
    }

    const currentStatus = accessStatus?.subscriptionStatus || billing?.status;
    const currentPaymentStatus = accessStatus?.paymentStatus || billing?.status;
    const currentPeriodEnd = accessStatus?.currentPeriodEnd || billing?.currentPeriodEnd;
    const regularizationUrl = regularization?.regularizationUrl || accessStatus?.regularizationUrl;
    const showDelinquencyCards = Boolean(accessStatus?.accessBlocked || regularization?.available);
    const regularizationSummary = regularization?.message
        || accessStatus?.blockReason
        || "A assinatura possui pendencia e precisa de regularizacao para liberar o acesso.";
    const currentPlanFeatureLabels = useMemo(() => listEnabledFeatureLabels(billing?.features).slice(0, 8), [billing?.features]);

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <section className="w-full rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-io-purple text-white">
                    <CreditCard className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="font-display text-3xl font-bold text-io-dark">{title}</h2>
                    <p className="mt-1 text-sm text-black/55">{description}</p>
                </div>
            </div>

            {feedback ? <p className="mt-4 text-sm text-emerald-700">{feedback}</p> : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Plano" value={billing?.planName ?? "Plano principal"} />
                <InfoCard label="Assinatura" value={statusLabel(currentStatus)} />
                <InfoCard label="Pagamento" value={statusLabel(currentPaymentStatus)} />
                <InfoCard label={accessStatus?.accessBlocked ? "Vencimento" : "Renovacao"} value={formatDateTime(currentPeriodEnd)} />
            </div>

            {showDelinquencyCards ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard label="Valor em cobranca" value={formatMoney(billing?.amountCents, (billing?.currency ?? "BRL").toUpperCase())} tone="warning" />
                    <InfoCard label="Forma de pagamento" value={billingTypeLabel(accessStatus?.billingType)} tone="warning" />
                    <InfoCard label="Bloqueio" value={accessStatus?.blockedAt ? formatDateTime(accessStatus.blockedAt) : "Pendente"} tone="danger" />
                    <InfoCard label="Regularizacao" value={regularizationSummary} tone="warning" compact />
                </div>
            ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard label="Valor" value={formatMoney(billing?.amountCents, (billing?.currency ?? "BRL").toUpperCase())} />
                    <InfoCard label="Forma de pagamento" value={billingTypeLabel(accessStatus?.billingType)} />
                    <InfoCard label="Ciclo" value={billing?.billingInterval ? billingTypeBillingIntervalLabel(billing.billingInterval) : "-"} />
                    <InfoCard label="Provedor" value={billing?.provider?.toUpperCase() || "ASAAS"} />
                </div>
            )}

            {billing ? (
                <>
                    <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <article className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Plano atual</p>
                            <h3 className="mt-3 text-2xl font-bold text-io-dark">{billing.planName}</h3>
                            <p className="mt-2 text-sm text-black/55">A leitura abaixo mostra o consumo real da conta frente aos limites do plano contratado.</p>

                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                <UsageCard
                                    label="Usuarios ativos"
                                    value={billing.usage.activeUsers}
                                    limit={billing.usersLimit}
                                />
                                <UsageCard
                                    label="Veiculos ativos"
                                    value={billing.usage.activeVehicles}
                                    limit={billing.vehiclesLimit}
                                />
                                <UsageCard
                                    label="Anuncios ativos"
                                    value={billing.usage.activeAds}
                                    limit={billing.activeAdsLimit}
                                />
                                <UsageCard
                                    label="Integracoes conectadas"
                                    value={billing.usage.connectedIntegrations}
                                />
                            </div>

                            <div className="mt-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Modulos habilitados</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(billing.enabledModules.length ? billing.enabledModules : currentPlanFeatureLabels).map((label) => (
                                        <span key={label} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-black/65">
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </article>

                        <article className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Trocar plano</p>
                            <h3 className="mt-3 text-2xl font-bold text-io-dark">Escolha um plano compativel com o uso atual</h3>
                            <p className="mt-2 text-sm text-black/55">
                                Downgrades ficam bloqueados quando a conta ja excede limites ou depende de modulos indisponiveis no plano alvo.
                            </p>

                            <div className="mt-5 grid gap-4">
                                {(billing.availablePlans ?? []).map((plan) => {
                                    const selectedRecurrence = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing.billingInterval);
                                    const isCurrentRecurrence = plan.current && selectedRecurrence === billing.billingInterval;
                                    const featureLabels = listEnabledFeatureLabels(plan.features).slice(0, 6);

                                    return (
                                        <div key={plan.planId} className={`rounded-[24px] border p-4 ${plan.current ? "border-io-purple/35 bg-white" : "border-black/10 bg-white"}`}>
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-lg font-bold text-io-dark">{plan.planName}</p>
                                                        {plan.current ? (
                                                            <span className="rounded-full bg-io-purple/10 px-3 py-1 text-xs font-semibold text-io-purple">
                                                                Plano atual
                                                            </span>
                                                        ) : null}
                                                        {!plan.eligible ? (
                                                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                                                Downgrade bloqueado
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-black/60">
                                                        <span>Mensal: {formatMoney(plan.monthlyPriceCents, "BRL")}</span>
                                                        <span>Anual: {formatMoney(plan.annualPriceCents, "BRL")}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/65">
                                                            {limitLabel(plan.usersLimit, "usuarios")}
                                                        </span>
                                                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/65">
                                                            {limitLabel(plan.vehiclesLimit, "veiculos")}
                                                        </span>
                                                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/65">
                                                            {limitLabel(plan.activeAdsLimit, "anuncios")}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {featureLabels.map((label) => (
                                                            <span key={label} className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/60">
                                                                {label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {!plan.eligible && plan.blockingReasons.length ? (
                                                        <div className="mt-4 grid gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3">
                                                            {plan.blockingReasons.map((reason) => (
                                                                <p key={reason} className="text-sm leading-6 text-red-700">
                                                                    {reason}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="grid gap-3 lg:min-w-[220px]">
                                                    <label className="grid gap-2 text-sm text-black/60">
                                                        <span>Ciclo de cobranca</span>
                                                        <select
                                                            value={selectedRecurrence}
                                                            onChange={(event) => setSelectedRecurrenceByPlan((current) => ({
                                                                ...current,
                                                                [plan.planId]: event.target.value,
                                                            }))}
                                                            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none"
                                                        >
                                                            {plan.monthlyPriceCents ? <option value="MONTHLY">Mensal</option> : null}
                                                            {plan.annualPriceCents ? <option value="ANNUAL">Anual</option> : null}
                                                        </select>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleChangePlan(plan)}
                                                        disabled={changingPlanId === plan.planId || isCurrentRecurrence || !plan.eligible}
                                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb] disabled:cursor-not-allowed disabled:bg-[#6b00e3]/35"
                                                    >
                                                        {changingPlanId === plan.planId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                                        {plan.current ? (isCurrentRecurrence ? "Plano atual" : "Atualizar ciclo") : "Trocar para este plano"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    </div>
                </>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
                {regularizationUrl ? (
                    <a
                        href={regularizationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Regularizar pagamento
                    </a>
                ) : null}
                <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={openingPortal || !billing?.hasSubscription}
                    className="inline-flex items-center gap-2 rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb] disabled:cursor-not-allowed disabled:bg-[#6b00e3]/35"
                >
                    {openingPortal ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Abrir cobranca no Asaas
                </button>
            </div>
        </section>
    );
}

function defaultRecurrenceForPlan(plan: BillingPlanOption, currentBillingInterval?: string | null) {
    if (plan.current && currentBillingInterval) return currentBillingInterval;
    if (plan.billingRecurrence) return plan.billingRecurrence;
    if (plan.monthlyPriceCents) return "MONTHLY";
    if (plan.annualPriceCents) return "ANNUAL";
    return "MONTHLY";
}

function billingTypeBillingIntervalLabel(value: string) {
    const normalized = String(value).trim().toUpperCase();
    if (normalized === "MONTHLY") return "Mensal";
    if (normalized === "ANNUAL" || normalized === "YEARLY") return "Anual";
    return normalized ? normalized.replaceAll("_", " ") : "-";
}

function limitLabel(value: number | null | undefined, suffix: string) {
    if (value == null || value <= 0) return `Sem limite de ${suffix}`;
    return `Ate ${value.toLocaleString("pt-BR")} ${suffix}`;
}

function UsageCard({
    label,
    value,
    limit,
}: {
    label: string;
    value: number;
    limit?: number | null;
}) {
    const overLimit = limit != null && limit > 0 && value > limit;
    const nearLimit = limit != null && limit > 0 && value <= limit && value / limit >= 0.8;
    const toneClasses = overLimit
        ? "border-red-200 bg-red-50"
        : nearLimit
            ? "border-amber-200 bg-amber-50"
            : "border-black/10 bg-white";

    return (
        <div className={`rounded-[20px] border px-4 py-4 ${toneClasses}`}>
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className="mt-3 text-2xl font-bold text-io-dark">{value.toLocaleString("pt-BR")}</p>
            <p className="mt-2 text-sm text-black/55">{limit == null ? "Sem limite contratado" : `Limite do plano: ${limit.toLocaleString("pt-BR")}`}</p>
        </div>
    );
}

function InfoCard({
    label,
    value,
    tone = "default",
    compact = false,
}: {
    label: string;
    value: string;
    tone?: "default" | "warning" | "danger";
    compact?: boolean;
}) {
    const toneClasses = tone === "danger"
        ? "border-red-200 bg-red-50"
        : tone === "warning"
            ? "border-amber-200 bg-amber-50"
            : "border-black/10 bg-black/[0.02]";

    return (
        <div className={`rounded-[24px] border px-4 py-4 ${toneClasses}`}>
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className={`mt-3 font-semibold text-io-dark ${compact ? "text-sm leading-6" : "text-lg"}`}>{value}</p>
        </div>
    );
}
