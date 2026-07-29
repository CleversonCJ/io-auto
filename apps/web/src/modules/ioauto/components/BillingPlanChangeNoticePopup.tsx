"use client";

import { useEffect, useRef, useState } from "react";
import { billingIntervalLabel, formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import type { BillingSnapshot } from "@/modules/ioauto/types";

function adjustmentModeLabel(mode?: string | null) {
    const normalized = String(mode ?? "").trim().toUpperCase();
    if (normalized === "IMMEDIATE_CHARGE") return "Cobrança proporcional imediata";
    if (normalized === "NEXT_CYCLE_CREDIT") return "Crédito programado";
    if (normalized === "UPCOMING_PAYMENT_UPDATE") return "Cobrança pendente substituida";
    return "Atualização do plano";
}

export function BillingPlanChangeNoticePopup() {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [dismissing, setDismissing] = useState(false);
    const popupRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let active = true;
        let firstLoad = true;

        async function loadBillingSnapshot() {
            const response = await fetch("/api/ioauto/billing", { cache: "no-store" });
            if (!response.ok) throw new Error("billing_snapshot_failed");
            return (await response.json()) as BillingSnapshot;
        }

        async function refresh() {
            try {
                const payload = await loadBillingSnapshot();
                if (!active) return;
                setBilling(payload);
            } catch {
                if (!active) return;
                if (firstLoad) {
                    setBilling(null);
                }
            } finally {
                if (!active || !firstLoad) return;
                setLoading(false);
                firstLoad = false;
            }
        }

        void refresh();
        const intervalId = window.setInterval(() => {
            void refresh();
        }, 15000);

        return () => {
            active = false;
            window.clearInterval(intervalId);
        };
    }, []);

    const notice = billing?.planChangeNotice;
    const requiresPayment = (notice?.requiresAction ?? false) || (notice?.immediateChargeCents ?? 0) > 0;
    const canDismiss = !requiresPayment;

    useEffect(() => {
        if (!notice?.active || !requiresPayment) return;

        const element = popupRef.current;
        if (!element) return;

        const restoreVisibility = () => {
            if (element.style.display === "none") {
                element.style.removeProperty("display");
            }
            if (element.hasAttribute("hidden")) {
                element.removeAttribute("hidden");
            }
            if (element.getAttribute("aria-hidden") === "true") {
                element.setAttribute("aria-hidden", "false");
            }
        };

        restoreVisibility();
        const observer = new MutationObserver(() => restoreVisibility());
        observer.observe(element, { attributes: true, attributeFilter: ["style", "hidden", "aria-hidden"] });

        const enforcementInterval = window.setInterval(() => {
            restoreVisibility();
        }, 1000);

        return () => {
            observer.disconnect();
            window.clearInterval(enforcementInterval);
        };
    }, [notice?.active, notice?.createdAt, requiresPayment]);

    async function handleDismiss() {
        if (!canDismiss || dismissing) return;
        setDismissing(true);
        try {
            const response = await fetch("/api/ioauto/billing/plan-change/notice/dismiss", { method: "POST" });
            if (!response.ok) {
                throw new Error("dismiss_failed");
            }
            setBilling((prev) => {
                if (!prev?.planChangeNotice) return prev;
                return {
                    ...prev,
                    planChangeNotice: {
                        ...prev.planChangeNotice,
                        active: false,
                    },
                };
            });
        } catch {
            window.alert("Não foi possível confirmar a leitura do aviso agora. Tente novamente em instantes.");
        } finally {
            setDismissing(false);
        }
    }

    if (loading || !notice?.active) return null;

    return (
        <div ref={popupRef} className="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
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
                        <PopupInfoCard label="Cobrança agora" value={formatMoney(notice.immediateChargeCents, "BRL")} />
                        <PopupInfoCard label="Crédito aplicado" value={formatMoney(notice.creditNextCycleCents, "BRL")} />
                        <PopupInfoCard label="Crédito restante" value={formatMoney(notice.remainingCreditCents, "BRL")} />
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    {requiresPayment ? (
                        <>
                            {notice.invoiceUrl ? (
                                <a
                                    href={notice.invoiceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-io-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5800bb]"
                                >
                                    Abrir cobrança proporcional
                                </a>
                            ) : null}
                            <a
                                href="/protected/perfil#faturas"
                                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
                            >
                                Ver faturas no perfil
                            </a>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleDismiss()}
                            disabled={dismissing}
                            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {dismissing ? "Confirmando..." : "Entendi"}
                        </button>
                    )}
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
