"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { billingIntervalLabel, billingTypeLabel, formatDateTime, formatMoney, formatShortDate, statusLabel } from "@/modules/ioauto/formatters";
import { listEnabledFeatureLabels } from "@/modules/ioauto/planFeatures";
import type {
    BillingAccessStatusSnapshot,
    BillingPlanChangeConfirmResponse,
    BillingPlanChangePreview,
    BillingPlanOption,
    BillingRegularizationOptions,
    BillingSnapshot,
} from "@/modules/ioauto/types";

type SubscriptionCenterProps = {
    title?: string;
    description?: string;
    currentUserRoles?: string[];
    onBillingChange?: (billing: BillingSnapshot | null) => void;
};

type ApiErrorPayload = {
    code?: string;
    message?: string;
};

export function SubscriptionCenter({
    title = "Assinatura do tenant",
    description = "Cobrança recorrente pronta para operação automática via Asaas.",
    currentUserRoles,
    onBillingChange,
}: SubscriptionCenterProps) {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [accessStatus, setAccessStatus] = useState<BillingAccessStatusSnapshot | null>(null);
    const [regularization, setRegularization] = useState<BillingRegularizationOptions | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [adjustmentResult, setAdjustmentResult] = useState<BillingPlanChangeConfirmResponse["adjustment"] | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);
    const [preview, setPreview] = useState<BillingPlanChangePreview | null>(null);
    const [previewPlanKey, setPreviewPlanKey] = useState<string | null>(null);
    const [previewingPlanKey, setPreviewingPlanKey] = useState<string | null>(null);
    const [confirmingPlanKey, setConfirmingPlanKey] = useState<string | null>(null);
    const [selectedRecurrenceByPlan, setSelectedRecurrenceByPlan] = useState<Record<string, string>>({});
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

    const canManagePlan = useMemo(
        () => (currentUserRoles ?? []).some((role) => ["ADMIN", "SUPERADMIN"].includes(role.toUpperCase())),
        [currentUserRoles],
    );

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
        onBillingChange?.(billingPayload);

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

    function closePlanModal() {
        setIsPlanModalOpen(false);
        setPreview(null);
        setPreviewPlanKey(null);
    }

    async function handleOpenPortal() {
        setOpeningPortal(true);
        setFeedback(null);
        setError(null);

        const response = await fetch("/api/ioauto/billing/portal", { method: "POST" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ message: "Falha ao abrir a cobrança." }));
            setError(payload.message ?? "Falha ao abrir a cobrança.");
            setOpeningPortal(false);
            return;
        }

        const payload = (await response.json()) as { portalUrl: string };
        window.location.assign(payload.portalUrl);
    }

    async function handlePreviewPlan(plan: BillingPlanOption) {
        const targetBillingInterval = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing?.billingInterval);
        setPreviewingPlanKey(plan.planKey);
        setPreview(null);
        setPreviewPlanKey(null);
        setFeedback(null);
        setAdjustmentResult(null);
        setError(null);

        try {
            const response = await fetch("/api/ioauto/billing/plan-change/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetPlanKey: plan.planKey,
                    targetBillingInterval,
                }),
            });

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({ message: "Falha ao gerar a prévia da troca." }))) as ApiErrorPayload;
                throw new Error(payload.message ?? "Falha ao gerar a prévia da troca.");
            }

            const payload = (await response.json()) as BillingPlanChangePreview;
            setPreview(payload);
            setPreviewPlanKey(plan.planKey);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao gerar a prévia da troca.");
        } finally {
            setPreviewingPlanKey(null);
        }
    }

    async function handleConfirmPlan(plan: BillingPlanOption) {
        const targetBillingInterval = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing?.billingInterval);
        setConfirmingPlanKey(plan.planKey);
        setFeedback(null);
        setAdjustmentResult(null);
        setError(null);

        try {
            const response = await fetch("/api/ioauto/billing/plan-change/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetPlanKey: plan.planKey,
                    targetBillingInterval,
                    updatePendingPayments: preview?.willUpdatePendingPayments ?? false,
                }),
            });

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({ message: "Falha ao alterar o plano." }))) as ApiErrorPayload;
                throw new Error(payload.message ?? "Falha ao alterar o plano.");
            }

            const payload = (await response.json()) as BillingPlanChangeConfirmResponse;
            await loadBilling();
            closePlanModal();
            setAdjustmentResult(payload.adjustment ?? null);
            setFeedback(payload.message || `Plano alterado para ${plan.planName}.`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao alterar o plano.");
        } finally {
            setConfirmingPlanKey(null);
        }
    }

    const currentStatus = accessStatus?.subscriptionStatus || billing?.status;
    const currentPaymentStatus = accessStatus?.paymentStatus || billing?.status;
    const currentPeriodEnd = accessStatus?.currentPeriodEnd || billing?.currentPeriodEnd;
    const showDelinquencyCards = Boolean(accessStatus?.accessBlocked || regularization?.available);
    const regularizationSummary = regularization?.message
        || accessStatus?.blockReason
        || "A assinatura possui pendência e precisa de regularização para liberar o acesso.";
    const currentPlanFeatureLabels = useMemo(() => listEnabledFeatureLabels(billing?.features).slice(0, 8), [billing?.features]);

    if (error && !billing) {
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
            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
            {adjustmentResult?.invoiceUrl ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                    <ExternalLink className="h-4 w-4" />
                    <a href={adjustmentResult.invoiceUrl} target="_blank" rel="noreferrer" className="underline decoration-emerald-300 underline-offset-4">
                        Abrir cobrança proporcional
                    </a>
                </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Plano" value={billing?.planName ?? "Plano principal"} />
                <InfoCard label="Assinatura" value={statusLabel(currentStatus)} />
                <InfoCard label="Pagamento" value={statusLabel(currentPaymentStatus)} />
                <InfoCard label={accessStatus?.accessBlocked ? "Vencimento" : "Renovação"} value={formatDateTime(currentPeriodEnd)} />
            </div>

            {billing?.pendingProrationCreditCents ? (
                <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Crédito programado</p>
                    <p className="mt-2 text-lg font-bold">{formatMoney(billing.pendingProrationCreditCents, "BRL")}</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-800/85">
                        {billing.pendingProrationCreditNote || "Este valor será abatido automaticamente das próximas cobranças da assinatura."}
                    </p>
                    <p className="mt-2 text-xs text-emerald-800/70">
                        Atualizado em {formatDateTime(billing.pendingProrationCreditUpdatedAt)}
                    </p>
                </div>
            ) : null}

            {showDelinquencyCards ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard label="Valor em cobrança" value={formatMoney(billing?.amountCents, (billing?.currency ?? "BRL").toUpperCase())} tone="warning" />
                    <InfoCard label="Forma de pagamento" value={billingTypeLabel(accessStatus?.billingType)} tone="warning" />
                    <InfoCard label="Bloqueio" value={accessStatus?.blockedAt ? formatDateTime(accessStatus.blockedAt) : "Pendente"} tone="danger" />
                    <InfoCard label="Regularização" value={regularizationSummary} tone="warning" compact />
                </div>
            ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard label="Valor" value={formatMoney(billing?.amountCents, (billing?.currency ?? "BRL").toUpperCase())} />
                    <InfoCard label="Forma de pagamento" value={billingTypeLabel(accessStatus?.billingType)} />
                    <InfoCard label="Ciclo" value={billing?.billingInterval ? billingIntervalLabel(billing.billingInterval) : "-"} />
                    <InfoCard label="Provedor" value={billing?.provider?.toUpperCase() || "ASAAS"} />
                </div>
            )}

            {billing ? (
                <div className="mt-6">
                    <article className="rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Plano atual</p>
                                <h3 className="mt-3 text-2xl font-bold text-io-dark">{billing.planName}</h3>
                                <p className="mt-2 text-sm text-black/55">A leitura abaixo mostra o consumo real da conta frente aos limites do plano contratado.</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3">
                                {!canManagePlan ? (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                                        <ShieldAlert className="h-4 w-4" />
                                        Somente administradores podem alterar o plano
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setIsPlanModalOpen(true)}
                                    disabled={!canManagePlan}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb] disabled:cursor-not-allowed disabled:bg-[#6b00e3]/35"
                                >
                                    Trocar plano
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <UsageCard label="Usuários ativos" value={billing.usage.activeUsers} limit={billing.usersLimit} />
                            <UsageCard label="Veículos ativos" value={billing.usage.activeVehicles} limit={billing.vehiclesLimit} />
                            <UsageCard label="Anúncios ativos" value={billing.usage.activeAds} limit={billing.activeAdsLimit} />
                            <UsageCard label="Integrações conectadas" value={billing.usage.connectedIntegrations} />
                        </div>

                        <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Módulos habilitados</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {(billing.enabledModules.length ? billing.enabledModules : currentPlanFeatureLabels).map((label) => (
                                    <span key={label} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-black/65">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </article>
                </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={openingPortal || !billing?.hasSubscription}
                    className="inline-flex items-center gap-2 rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb] disabled:cursor-not-allowed disabled:bg-[#6b00e3]/35"
                >
                    {openingPortal ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Abrir cobrança no Asaas
                </button>
            </div>

            {billing && isPlanModalOpen ? (
                <div className="fixed inset-0 z-50 bg-black/55 px-4 py-6">
                    <div className="mx-auto flex h-full max-w-6xl items-start justify-center">
                        <div className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="flex items-start justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Troca de plano</p>
                                    <h3 className="mt-2 font-display text-2xl font-bold text-io-dark">Escolha um plano compatível com o uso atual</h3>
                                    <p className="mt-1 text-sm text-black/55">
                                        Compare as opções, gere a prévia e confirme a troca só quando estiver tudo validado.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closePlanModal}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                                    aria-label="Fechar troca de plano"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
                                <div className="grid gap-4">
                                    {(billing.availablePlans ?? []).map((plan) => {
                                        const selectedRecurrence = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing.billingInterval);
                                        const isCurrentRecurrence = plan.current && selectedRecurrence === billing.billingInterval;
                                        const featureLabels = listEnabledFeatureLabels(plan.features).slice(0, 6);
                                        const priceEntries = supportedIntervalEntries(plan);
                                        const isPreviewOpen = previewPlanKey === plan.planKey
                                            && preview?.targetPlan.key === plan.planKey
                                            && preview?.targetPlan.billingInterval === selectedRecurrence;

                                        return (
                                            <div key={plan.planId} className={`rounded-[24px] border p-4 ${plan.current ? "border-io-purple/35 bg-[#fcfbff]" : "border-black/10 bg-white"}`}>
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="flex-1">
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
                                                            {priceEntries.map(([interval, amount]) => (
                                                                <span key={`${plan.planId}-${interval}`}>
                                                                    {billingIntervalLabel(interval)}: {formatMoney(amount, "BRL")}
                                                                </span>
                                                            ))}
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

                                                    <div className="grid gap-3 lg:min-w-[250px]">
                                                        <label className="grid gap-2 text-sm text-black/60">
                                                            <span>Ciclo de cobrança</span>
                                                            <select
                                                                value={selectedRecurrence}
                                                                onChange={(event) => {
                                                                    const nextValue = event.target.value;
                                                                    setSelectedRecurrenceByPlan((current) => ({
                                                                        ...current,
                                                                        [plan.planId]: nextValue,
                                                                    }));
                                                                    if (previewPlanKey === plan.planKey) {
                                                                        setPreview(null);
                                                                        setPreviewPlanKey(null);
                                                                    }
                                                                }}
                                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none"
                                                            >
                                                                {plan.supportedBillingIntervals.map((interval) => (
                                                                    <option key={`${plan.planId}-${interval}`} value={interval}>
                                                                        {billingIntervalLabel(interval)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <button
                                                            type="button"
                                                            onClick={() => void handlePreviewPlan(plan)}
                                                            disabled={previewingPlanKey === plan.planKey || isCurrentRecurrence || !plan.eligible || !canManagePlan}
                                                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#6b00e3]/20 bg-white px-5 py-3 text-sm font-semibold text-[#6b00e3] transition hover:bg-[#6b00e3]/5 disabled:cursor-not-allowed disabled:opacity-45"
                                                        >
                                                            {previewingPlanKey === plan.planKey ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                                            {plan.current ? (isCurrentRecurrence ? "Plano atual" : "Ver prévia do novo ciclo") : "Ver prévia da troca"}
                                                        </button>
                                                    </div>
                                                </div>

                                                {isPreviewOpen && preview ? (
                                                    <div className="mt-4 grid gap-4 rounded-[22px] border border-io-purple/15 bg-[#f8f3ff] p-4">
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <PreviewMetric
                                                                label="Plano atual"
                                                                value={`${preview.currentPlan.name} • ${billingIntervalLabel(preview.currentPlan.billingInterval)}`}
                                                                detail={formatMoney(preview.currentPlan.amountCents, "BRL")}
                                                            />
                                                            <PreviewMetric
                                                                label="Novo plano"
                                                                value={`${preview.targetPlan.name} • ${billingIntervalLabel(preview.targetPlan.billingInterval)}`}
                                                                detail={formatMoney(preview.targetPlan.amountCents, "BRL")}
                                                            />
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <PreviewMetric label="Tipo de alteração" value={changeTypeLabel(preview.changeType)} />
                                                            <PreviewMetric label="Ciclo no Asaas" value={billingIntervalLabel(preview.asaasCycle)} />
                                                            <PreviewMetric label="Cobranças pendentes" value={preview.willUpdatePendingPayments ? "Atualiza quando aplicável" : "Mantém as já emitidas"} />
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-4">
                                                            <PreviewMetric
                                                                label="Janela atual"
                                                                value={preview.proration.periodStartDate && preview.proration.periodEndDate
                                                                    ? `${formatShortDate(preview.proration.periodStartDate)} a ${formatShortDate(preview.proration.periodEndDate)}`
                                                                    : "-"}
                                                            />
                                                            <PreviewMetric
                                                                label="Dias restantes"
                                                                value={`${preview.proration.remainingDays.toLocaleString("pt-BR")} de ${preview.proration.totalCycleDays.toLocaleString("pt-BR")}`}
                                                            />
                                                            <PreviewMetric
                                                                label="Saldo plano atual"
                                                                value={formatMoney(preview.proration.currentPlanRemainingCents, "BRL")}
                                                            />
                                                            <PreviewMetric
                                                                label="Uso proporcional novo plano"
                                                                value={formatMoney(preview.proration.targetPlanRemainingCents, "BRL")}
                                                            />
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <PreviewMetric label="Modo do ajuste" value={prorationModeLabel(preview.proration.adjustmentMode)} />
                                                            <PreviewMetric label="Cobrança imediata" value={formatMoney(preview.proration.immediateChargeCents, "BRL")} />
                                                            <PreviewMetric label="Crédito futuro" value={formatMoney(preview.proration.creditNextCycleCents, "BRL")} />
                                                        </div>

                                                        <div className="rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm leading-6 text-black/65">
                                                            <p>{preview.message}</p>
                                                            <p className="mt-2">{preview.proration.message}</p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleConfirmPlan(plan)}
                                                                disabled={confirmingPlanKey === plan.planKey || !canManagePlan}
                                                                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb] disabled:cursor-not-allowed disabled:bg-[#6b00e3]/35"
                                                            >
                                                                {confirmingPlanKey === plan.planKey ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                                                Confirmar alteração
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPreview(null);
                                                                    setPreviewPlanKey(null);
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black/70 transition hover:bg-black/[0.03]"
                                                            >
                                                                Cancelar prévia
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function supportedIntervalEntries(plan: BillingPlanOption) {
    const orderedIntervals = plan.supportedBillingIntervals.length
        ? plan.supportedBillingIntervals
        : Object.keys(plan.priceByInterval ?? {});

    return orderedIntervals
        .map((interval) => [interval, plan.priceByInterval?.[interval] ?? null] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] != null);
}

function defaultRecurrenceForPlan(plan: BillingPlanOption, currentBillingInterval?: string | null) {
    if (plan.current && currentBillingInterval) return currentBillingInterval;
    if (plan.supportedBillingIntervals.length) return plan.supportedBillingIntervals[0]!;
    if (plan.billingRecurrence) return plan.billingRecurrence;
    if (plan.monthlyPriceCents) return "MONTHLY";
    if (plan.annualPriceCents) return "ANNUAL";
    return "MONTHLY";
}

function changeTypeLabel(value: BillingPlanChangePreview["changeType"]) {
    if (value === "UPGRADE") return "Upgrade";
    if (value === "DOWNGRADE") return "Downgrade";
    if (value === "CYCLE_CHANGE") return "Troca de ciclo";
    return "Troca de plano";
}

function prorationModeLabel(value: BillingPlanChangePreview["proration"]["adjustmentMode"]) {
    if (value === "IMMEDIATE_CHARGE") return "Cobrança imediata";
    if (value === "NEXT_CYCLE_CREDIT") return "Crédito nas próximas cobranças";
    if (value === "UPCOMING_PAYMENT_UPDATE") return "Substitui cobrança pendente";
    return "Sem ajuste adicional";
}

function limitLabel(value: number | null | undefined, suffix: string) {
    if (value == null || value <= 0) return `Sem limite de ${suffix}`;
    return `Até ${value.toLocaleString("pt-BR")} ${suffix}`;
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

function PreviewMetric({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div className="rounded-[18px] border border-black/10 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className="mt-2 text-sm font-semibold text-io-dark">{value}</p>
            {detail ? <p className="mt-1 text-sm text-black/55">{detail}</p> : null}
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
