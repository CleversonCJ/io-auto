"use client";

import { useEffect, useState } from "react";
import { billingTypeLabel, formatDateTime, statusLabel } from "@/modules/ioauto/formatters";
import type { BillingAccessStatusSnapshot, BillingRegularizationOptions } from "@/modules/ioauto/types";

function normalizePixImageSource(raw: string | null | undefined) {
    const value = (raw ?? "").trim();
    if (!value) return null;
    if (value.startsWith("data:image")) return value;
    return `data:image/png;base64,${value}`;
}

export function BillingAccessBlockerPopup() {
    const [status, setStatus] = useState<BillingAccessStatusSnapshot | null>(null);
    const [regularization, setRegularization] = useState<BillingRegularizationOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    async function loadAccessStatus() {
        const response = await fetch("/api/ioauto/billing/access-status", { cache: "no-store" });
        if (!response.ok) {
            setStatus(null);
            setRegularization(null);
            return;
        }

        const payload = (await response.json()) as BillingAccessStatusSnapshot;
        setStatus(payload);

        if (!payload.accessBlocked) {
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

    async function verifyPayment() {
        setVerifying(true);
        setCopyFeedback(null);
        try {
            const response = await fetch("/api/ioauto/billing/access-status/verify", { method: "POST" });
            if (!response.ok) return;

            const payload = (await response.json()) as BillingAccessStatusSnapshot;
            setStatus(payload);

            if (!payload.accessBlocked) {
                window.location.reload();
                return;
            }

            const optionsResponse = await fetch("/api/ioauto/billing/regularization-options", { cache: "no-store" });
            if (!optionsResponse.ok) return;
            setRegularization((await optionsResponse.json()) as BillingRegularizationOptions);
        } finally {
            setVerifying(false);
        }
    }

    async function copyPixCode() {
        const code = regularization?.pixCopyPasteCode;
        if (!code) return;

        try {
            await navigator.clipboard.writeText(code);
            setCopyFeedback("Codigo Pix copiado.");
        } catch {
            setCopyFeedback("Nao foi possivel copiar automaticamente.");
        }
    }

    const blocked = status?.accessBlocked === true;
    if (loading || !blocked) return null;

    const regularizationUrl = regularization?.regularizationUrl || status?.regularizationUrl;
    const pixImage = normalizePixImageSource(regularization?.pixEncodedImage);

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

                {regularization?.available && regularization.pix ? (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-900">Regularizacao via Pix</p>
                        <p className="mt-1 text-sm text-emerald-900/80">{regularization.message}</p>
                        {pixImage ? (
                            <div className="mt-3 flex justify-center">
                                <img src={pixImage} alt="QR Code Pix" className="h-52 w-52 rounded-xl border border-emerald-200 bg-white p-2" />
                            </div>
                        ) : null}
                        {regularization.pixCopyPasteCode ? (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
                                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Codigo Pix copia e cola</p>
                                <p className="break-all text-xs text-zinc-700">{regularization.pixCopyPasteCode}</p>
                            </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={copyPixCode}
                                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                            >
                                Copiar codigo Pix
                            </button>
                            {regularizationUrl ? (
                                <a
                                    href={regularizationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
                                >
                                    Abrir cobranca no Asaas
                                </a>
                            ) : null}
                        </div>
                        {copyFeedback ? <p className="mt-2 text-xs text-emerald-800">{copyFeedback}</p> : null}
                    </div>
                ) : null}

                {regularization?.available && regularization.creditCard ? (
                    <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-sm font-semibold text-sky-900">Regularizacao via Cartao</p>
                        <p className="mt-1 text-sm text-sky-900/80">{regularization.message}</p>
                        <p className="mt-2 text-sm text-sky-900">{regularization.cardSummary || "Cartao salvo no Asaas."}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {regularizationUrl ? (
                                <a
                                    href={regularizationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
                                >
                                    Confirmar pagamento com cartao
                                </a>
                            ) : null}
                            {regularizationUrl ? (
                                <a
                                    href={regularizationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-800"
                                >
                                    Atualizar cartao
                                </a>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {!regularization?.available && regularizationUrl ? (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm text-zinc-700">Abra a cobranca para regularizar o pagamento.</p>
                        <a
                            href={regularizationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Abrir cobranca
                        </a>
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={verifyPayment}
                        disabled={verifying}
                        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                        {verifying ? "Verificando..." : "Ja paguei, verificar novamente"}
                    </button>
                </div>
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
