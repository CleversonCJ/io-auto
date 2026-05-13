"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, LoaderCircle } from "lucide-react";
import type { BillingAccessStatusSnapshot, BillingRegularizationOptions, BillingSnapshot } from "@/modules/ioauto/types";
import { billingTypeLabel, formatDateTime, formatMoney, statusLabel } from "@/modules/ioauto/formatters";

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
    const [openingPortal, setOpeningPortal] = useState(false);

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

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    const currentStatus = accessStatus?.subscriptionStatus || billing?.status;
    const currentPaymentStatus = accessStatus?.paymentStatus || billing?.status;
    const currentPeriodEnd = accessStatus?.currentPeriodEnd || billing?.currentPeriodEnd;
    const regularizationUrl = regularization?.regularizationUrl || accessStatus?.regularizationUrl;
    const showDelinquencyCards = Boolean(accessStatus?.accessBlocked || regularization?.available);
    const regularizationSummary = regularization?.message
        || accessStatus?.blockReason
        || "A assinatura possui pendencia e precisa de regularizacao para liberar o acesso.";

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

function billingTypeBillingIntervalLabel(value: string) {
    const normalized = String(value).trim().toUpperCase();
    if (normalized === "MONTHLY") return "Mensal";
    if (normalized === "ANNUAL" || normalized === "YEARLY") return "Anual";
    return normalized ? normalized.replaceAll("_", " ") : "-";
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
