"use client";

import { useEffect, useState } from "react";
import { billingIntervalLabel, formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import type { BillingSnapshot } from "@/modules/ioauto/types";

function adjustmentModeLabel(mode?: string | null) {
    const normalized = String(mode ?? "").trim().toUpperCase();
    if (normalized === "IMMEDIATE_CHARGE") return "Cobranca proporcional imediata";
    if (normalized === "NEXT_CYCLE_CREDIT") return "Credito programado";
    if (normalized === "UPCOMING_PAYMENT_UPDATE") return "Cobranca pendente substituida";
    return "Atualizacao do plano";
}

export function BillingPlanChangeNoticePopup() {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetch("/api/ioauto/billing", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) return null;
                return (await response.json()) as BillingSnapshot;
            })
            .then((payload) => {
                if (!active) return;
                setBilling(payload);
            })
            .catch(() => {
                if (!active) return;
                setBilling(null);
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const notice = billing?.planChangeNotice;
    if (loading || !notice?.active) return null;

    return (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-white/20 bg-white p-6 shadow-[0_40px_100px_rgba(0,0,0,0.35)] md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-io-purple">Plano atualizado</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900 md:text-3xl">{notice.title || "Seu plano foi alterado"}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{notice.message}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <PopupInfoCard label="Plano anterior" value={notice.currentPlanName || "-"} />
                    <PopupInfoCard label="Plano atual" value={`${notice.targetPlanName || "-"}${notice.targetBillingInterval ? ` • ${billingIntervalLabel(notice.targetBillingInterval)}` : ""}`} />
                    <PopupInfoCard label="Ajuste" value={adjustmentModeLabel(notice.prorationAdjustmentMode)} />
                    <PopupInfoCard label="Registrado em" value={formatDateTime(notice.createdAt)} />
                </div>

                {notice.unlockedFeatures?.length ? (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-900">Funcionalidades liberadas no novo plano</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {notice.unlockedFeatures.map((feature) => (
                                <span key={feature} className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                {(notice.immediateChargeCents || notice.creditNextCycleCents || notice.remainingCreditCents) ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <PopupInfoCard label="Cobranca agora" value={formatMoney(notice.immediateChargeCents, "BRL")} />
                        <PopupInfoCard label="Credito aplicado" value={formatMoney(notice.creditNextCycleCents, "BRL")} />
                        <PopupInfoCard label="Credito restante" value={formatMoney(notice.remainingCreditCents, "BRL")} />
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    {notice.invoiceUrl ? (
                        <a
                            href={notice.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-io-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5800bb]"
                        >
                            Abrir cobranca proporcional
                        </a>
                    ) : null}
                    <a
                        href="/protected/perfil#faturas"
                        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
                    >
                        Ver faturas no perfil
                    </a>
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
