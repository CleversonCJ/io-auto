"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, LoaderCircle } from "lucide-react";
import type { BillingSnapshot } from "@/modules/ioauto/types";
import { formatDateTime, formatMoney, statusLabel } from "@/modules/ioauto/formatters";

type SubscriptionCenterProps = {
    title?: string;
    description?: string;
};

export function SubscriptionCenter({
    title = "Assinatura do tenant",
    description = "Cobranca recorrente pronta para operacao automatica via Asaas.",
}: SubscriptionCenterProps) {
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);

    async function loadBilling() {
        const response = await fetch("/api/ioauto/billing", { cache: "no-store" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ message: "Falha ao carregar a assinatura." }));
            throw new Error(payload.message ?? "Falha ao carregar a assinatura.");
        }
        setBilling((await response.json()) as BillingSnapshot);
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
                <InfoCard label="Status" value={statusLabel(billing?.status)} />
                <InfoCard label="Valor" value={formatMoney(billing?.amountCents, (billing?.currency ?? "BRL").toUpperCase())} />
                <InfoCard label="Renovacao" value={formatDateTime(billing?.currentPeriodEnd)} />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
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

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className="mt-3 text-lg font-semibold text-io-dark">{value}</p>
        </div>
    );
}
