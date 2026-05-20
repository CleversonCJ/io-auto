"use client";

import { useEffect, useState } from "react";
import { billingTypeLabel, formatDateTime, statusLabel } from "@/modules/ioauto/formatters";
import type { BillingAccessStatusSnapshot, BillingRegularizationOptions } from "@/modules/ioauto/types";

export function BillingAccessBlockerPopup() {
    const [status, setStatus] = useState<BillingAccessStatusSnapshot | null>(null);
    const [regularization, setRegularization] = useState<BillingRegularizationOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkingRelease, setCheckingRelease] = useState(false);

    async function loadAccessStatus() {
        const response = await fetch("/api/ioauto/billing/access-status", { cache: "no-store" });
        if (!response.ok) {
            setStatus(null);
            setRegularization(null);
            return;
        }

        const payload = (await response.json()) as BillingAccessStatusSnapshot;
        setStatus(payload);

        if (!payload.accessBlocked || payload.companyStatus?.toUpperCase() === "BLOCKED") {
            setRegularization(null);
            return;
        }

        const optionsResponse = await fetch("/api/ioauto/billing/regularization-options", { cache: "no-store" });
        if (!optionsResponse.ok) {
            setRegularization(null);
            return;
        }

        const options = (await optionsResponse.json()) as BillingRegularizationOptions;
        setRegularization(options);
    }

    useEffect(() => {
        setLoading(true);
        loadAccessStatus()
            .catch(() => {
                setStatus(null);
                setRegularization(null);
            })
            .finally(() => setLoading(false));
    }, []);

    async function verifyPaymentStatus() {
        setCheckingRelease(true);
        try {
            const response = await fetch("/api/ioauto/billing/access-status/verify", { method: "POST" });
            if (!response.ok) return;

            const payload = (await response.json()) as BillingAccessStatusSnapshot;
            setStatus(payload);

            if (!payload.accessBlocked) {
                window.location.reload();
                return;
            }

            if (payload.companyStatus?.toUpperCase() === "BLOCKED") {
                setRegularization(null);
                return;
            }

            const optionsResponse = await fetch("/api/ioauto/billing/regularization-options", { cache: "no-store" });
            if (!optionsResponse.ok) return;
            setRegularization((await optionsResponse.json()) as BillingRegularizationOptions);
        } finally {
            setCheckingRelease(false);
        }
    }

    const blocked = status?.accessBlocked === true;
    const companyBlocked = status?.companyStatus?.toUpperCase() === "BLOCKED";

    useEffect(() => {
        if (!blocked || companyBlocked) return;
        const intervalId = window.setInterval(() => {
            void verifyPaymentStatus();
        }, 15000);

        return () => window.clearInterval(intervalId);
    }, [blocked, companyBlocked]);

    if (loading || !blocked || companyBlocked) return null;

    const regularizationUrl = regularization?.regularizationUrl || status?.regularizationUrl;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-white/20 bg-white p-6 shadow-[0_40px_100px_rgba(0,0,0,0.35)] md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-700">Acesso bloqueado</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900 md:text-3xl">Pagamento pendente da assinatura</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {status?.blockReason || "Sua assinatura esta pendente. Regularize o pagamento para liberar o sistema novamente."}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <PopupInfoCard label="Assinatura" value={statusLabel(status?.subscriptionStatus)} />
                    <PopupInfoCard label="Pagamento" value={statusLabel(status?.paymentStatus)} />
                    <PopupInfoCard label="Forma" value={billingTypeLabel(status?.billingType)} />
                    <PopupInfoCard
                        label={status?.blockedAt ? "Bloqueado em" : "Vencimento"}
                        value={formatDateTime(status?.blockedAt || status?.currentPeriodEnd)}
                    />
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-700">
                        Use o botao abaixo para abrir a cobranca no Asaas e realizar o pagamento da fatura em aberto.
                    </p>
                    {regularizationUrl ? (
                        <a
                            href={regularizationUrl}
                            target="_self"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Ir para pagamento no Asaas
                        </a>
                    ) : (
                        <button
                            type="button"
                            disabled
                            className="mt-3 inline-flex cursor-not-allowed rounded-full bg-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600"
                        >
                            Aguardando link de pagamento
                        </button>
                    )}
                </div>

                <p className="mt-6 text-xs text-zinc-500">
                    A conta sera liberada automaticamente apos a confirmacao de pagamento do Asaas.
                    {checkingRelease ? " Verificando status de pagamento..." : ""}
                </p>
            </div>
        </div>
    );
}

function PopupInfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">{value}</p>
        </div>
    );
}
