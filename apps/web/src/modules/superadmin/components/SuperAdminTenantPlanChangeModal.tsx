"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { billingIntervalLabel, formatMoney, formatShortDate } from "@/modules/ioauto/formatters";
import { listEnabledFeatureLabels } from "@/modules/ioauto/planFeatures";
import type { BillingPlanChangeConfirmResponse, BillingPlanChangePreview, BillingPlanOption, BillingSnapshot } from "@/modules/ioauto/types";

type TenantSummary = {
    tenantId: string;
    companyName: string;
};

type Props = {
    tenant: TenantSummary;
    onClose: () => void;
    onConfirmed: (message: string) => Promise<void> | void;
};

type ApiErrorPayload = {
    message?: string;
};

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

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error((payload as ApiErrorPayload | null)?.message ?? fallbackMessage);
    }
    return payload as T;
}

export function SuperAdminTenantPlanChangeModal({ tenant, onClose, onConfirmed }: Props) {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [preview, setPreview] = useState<BillingPlanChangePreview | null>(null);
    const [previewPlanKey, setPreviewPlanKey] = useState<string | null>(null);
    const [previewingPlanKey, setPreviewingPlanKey] = useState<string | null>(null);
    const [confirmingPlanKey, setConfirmingPlanKey] = useState<string | null>(null);
    const [selectedRecurrenceByPlan, setSelectedRecurrenceByPlan] = useState<Record<string, string>>({});

    async function loadBilling() {
        setLoading(true);
        setError(null);

        try {
            const payload = await fetchJson<BillingSnapshot>(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/billing`,
                undefined,
                "Falha ao carregar a assinatura do tenant.",
            );
            setBilling(payload);
            setSelectedRecurrenceByPlan((current) => {
                const next = { ...current };
                for (const plan of payload.availablePlans ?? []) {
                    if (!next[plan.planId]) {
                        next[plan.planId] = defaultRecurrenceForPlan(plan, payload.billingInterval);
                    }
                }
                return next;
            });
        } catch (requestError) {
            setBilling(null);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar a assinatura do tenant.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadBilling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant.tenantId]);

    const currentPlanFeatureLabels = useMemo(
        () => listEnabledFeatureLabels(billing?.features).slice(0, 8),
        [billing?.features],
    );

    async function handlePreviewPlan(plan: BillingPlanOption) {
        const targetBillingInterval = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing?.billingInterval);
        setPreviewingPlanKey(plan.planKey);
        setPreview(null);
        setPreviewPlanKey(null);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload = await fetchJson<BillingPlanChangePreview>(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/billing/plan-change/preview`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        targetPlanKey: plan.planKey,
                        targetBillingInterval,
                    }),
                },
                "Falha ao gerar a prévia da troca.",
            );
            setPreview(payload);
            setPreviewPlanKey(plan.planKey);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao gerar a prévia da troca.");
        } finally {
            setPreviewingPlanKey(null);
        }
    }

    async function handleConfirmPlan(plan: BillingPlanOption) {
        const targetBillingInterval = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing?.billingInterval);
        setConfirmingPlanKey(plan.planKey);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload = await fetchJson<BillingPlanChangeConfirmResponse>(
                `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/billing/plan-change/confirm`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        targetPlanKey: plan.planKey,
                        targetBillingInterval,
                        updatePendingPayments: preview?.willUpdatePendingPayments ?? false,
                    }),
                },
                "Falha ao confirmar a troca de plano.",
            );
            const message = payload.message || `Plano de ${tenant.companyName} atualizado com sucesso.`;
            setSuccessMessage(message);
            setPreview(null);
            setPreviewPlanKey(null);
            await loadBilling();
            await onConfirmed(message);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao confirmar a troca de plano.");
        } finally {
            setConfirmingPlanKey(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-6" onClick={onClose}>
            <div className="mx-auto flex h-full max-w-6xl items-start justify-center">
                <section
                    className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Troca de plano</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-io-dark">Alterar plano de {tenant.companyName}</h3>
                            <p className="mt-1 text-sm text-black/55">
                                Gere a prévia antes de confirmar. No próximo login da empresa, o sistema exibirá um aviso com os recursos liberados e um atalho para as faturas.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                            aria-label="Fechar troca de plano"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
                        {loading ? <p className="text-sm text-black/55">Carregando assinatura do tenant...</p> : null}
                        {!loading && error && !billing ? <p className="text-sm text-red-700">{error}</p> : null}

                        {!loading && billing ? (
                            <div className="grid gap-4">
                                {successMessage ? (
                                    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                                        <p className="font-semibold">Plano alterado com sucesso.</p>
                                        <p className="mt-1">{successMessage}</p>
                                    </div>
                                ) : null}

                                {error ? (
                                    <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                        <p className="font-semibold">Não foi possível concluir a alteração.</p>
                                        <p className="mt-1">{error}</p>
                                    </div>
                                ) : null}

                                <article className="rounded-[24px] border border-black/10 bg-black/[0.02] p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Plano atual</p>
                                            <h4 className="mt-3 text-2xl font-bold text-io-dark">{billing.planName}</h4>
                                            <p className="mt-2 text-sm text-black/55">Use a mesma lógica de troca disponível no perfil da conta, agora dentro do painel do superadmin.</p>
                                        </div>
                                        <div className="rounded-[20px] border border-black/10 bg-white px-4 py-4">
                                            <p className="text-xs uppercase tracking-[0.24em] text-black/40">Módulos habilitados hoje</p>
                                            <div className="mt-3 flex max-w-[420px] flex-wrap gap-2">
                                                {(billing.enabledModules.length ? billing.enabledModules : currentPlanFeatureLabels).map((label) => (
                                                    <span key={label} className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/65">
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </article>

                                {(billing.availablePlans ?? []).map((plan) => {
                                    const selectedRecurrence = selectedRecurrenceByPlan[plan.planId] ?? defaultRecurrenceForPlan(plan, billing.billingInterval);
                                    const isCurrentRecurrence = plan.current && selectedRecurrence === billing.billingInterval;
                                    const featureLabels = listEnabledFeatureLabels(plan.features).slice(0, 6);
                                    const priceEntries = supportedIntervalEntries(plan);
                                    const isPreviewOpen = previewPlanKey === plan.planKey && preview?.targetPlan.key === plan.planKey;

                                    return (
                                        <div key={plan.planId} className="rounded-[26px] border border-black/10 bg-white p-5 shadow-sm">
                                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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
                                                            {limitLabel(plan.usersLimit, "usuários")}
                                                        </span>
                                                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/65">
                                                            {limitLabel(plan.vehiclesLimit, "veículos")}
                                                        </span>
                                                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/65">
                                                            {limitLabel(plan.activeAdsLimit, "anúncios")}
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
                                                        disabled={previewingPlanKey === plan.planKey || confirmingPlanKey != null || isCurrentRecurrence || !plan.eligible}
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
                                                        <PreviewMetric label="Cobranças pendentes" value={preview.willUpdatePendingPayments ? "Serão atualizadas" : "Serão mantidas"} />
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
                                                            label="Valor proporcional novo plano"
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
                                                            disabled={confirmingPlanKey === plan.planKey}
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
                        ) : null}
                    </div>
                </section>
            </div>
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
