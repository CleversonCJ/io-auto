"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, MessageCircle, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import {
    submitPublicCatalogLead,
    trackPublicLeadEvent,
    type PublicLeadTrackingParams,
} from "@/modules/ioauto/publicLeadTracking";

type Props = {
    open: boolean;
    companyId: string;
    redirectUrl: string | null;
    vehicleId?: string | null;
    vehicleTitle?: string | null;
    eventType: "CONTACT_CLICK" | "INTEREST_CLICK";
    tracking: PublicLeadTrackingParams;
    onClose: () => void;
};

function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
}

function formatPhoneInput(value: string) {
    const digits = normalizePhone(value).slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function PublicCatalogLeadCaptureModal({
    open,
    companyId,
    redirectUrl,
    vehicleId = null,
    vehicleTitle = null,
    eventType,
    tracking,
    onClose,
}: Props) {
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setCustomerName("");
            setCustomerPhone("");
            setSubmitting(false);
            setFeedback(null);
        }
    }, [open]);

    const sanitizedPhoneLength = useMemo(() => normalizePhone(customerPhone).length, [customerPhone]);

    if (!open) {
        return null;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!redirectUrl) {
            setFeedback("O contato via WhatsApp est\u00E1 indispon\u00EDvel no momento.");
            return;
        }

        if (!customerName.trim()) {
            setFeedback("Informe seu nome para continuar.");
            return;
        }

        if (sanitizedPhoneLength < 10 || sanitizedPhoneLength > 11) {
            setFeedback("Informe um telefone com DDD para continuar.");
            return;
        }

        setSubmitting(true);
        setFeedback(null);

        try {
            await submitPublicCatalogLead(companyId, {
                vehicleId,
                customerName: customerName.trim(),
                customerPhone,
                sourceType: tracking.sourceType,
                sourceReference: tracking.sourceReference,
            });

            trackPublicLeadEvent(companyId, {
                vehicleId,
                eventType,
                sourceType: tracking.sourceType,
                sourceReference: tracking.sourceReference,
            });

            window.location.assign(redirectUrl);
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "N\u00E3o foi poss\u00EDvel continuar para o WhatsApp.");
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1230]/35 p-4 backdrop-blur-[2px]"
            onClick={(event) => {
                if (event.target === event.currentTarget && !submitting) {
                    onClose();
                }
            }}
        >
            <div className="w-full max-w-lg overflow-hidden rounded-[32px] border border-[#6b00e3]/12 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbf7ff_100%)] shadow-[0_30px_90px_rgba(107,0,227,0.18)]">
                <div className="border-b border-[#6b00e3]/10 bg-[radial-gradient(circle_at_top_left,_rgba(154,92,255,0.18),_transparent_52%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(251,247,255,0.96))] px-6 py-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-[#f4ebff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {"Contato protegido"}
                            </span>
                            <h3 className="mt-4 font-display text-[1.95rem] font-bold leading-tight text-io-dark">
                                {"Antes de ir para o WhatsApp"}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-black/60">
                                {"\u00C9 rapidinho: preencha seu nome e telefone para a loja identificar seu contato e continuar a conversa."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#6b00e3]/10 bg-white text-black/55 transition hover:border-[#6b00e3]/20 hover:text-io-purple disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Fechar formul\u00E1rio"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {vehicleTitle ? (
                        <div className="mt-5 rounded-[24px] border border-[#6b00e3]/10 bg-white/85 px-4 py-4 shadow-[0_10px_24px_rgba(107,0,227,0.06)]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/35">
                                {"Ve\u00EDculo selecionado"}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-io-dark">{vehicleTitle}</p>
                        </div>
                    ) : null}
                </div>

                <form onSubmit={handleSubmit} className="grid gap-5 px-6 py-6">
                    <label className="grid gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-black/42">
                            {"Nome"}
                        </span>
                        <div className="flex h-14 items-center gap-3 rounded-[24px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4 transition focus-within:border-[#6b00e3]/28 focus-within:bg-white">
                            <UserRound className="h-4 w-4 text-io-purple" />
                            <input
                                value={customerName}
                                onChange={(event) => {
                                    setCustomerName(event.target.value);
                                    setFeedback(null);
                                }}
                                placeholder="Digite seu nome"
                                className="w-full bg-transparent text-sm font-medium text-io-dark outline-none placeholder:text-black/35"
                                autoComplete="name"
                                disabled={submitting}
                            />
                        </div>
                    </label>

                    <label className="grid gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-black/42">
                            {"Telefone"}
                        </span>
                        <div className="flex h-14 items-center gap-3 rounded-[24px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4 transition focus-within:border-[#6b00e3]/28 focus-within:bg-white">
                            <Phone className="h-4 w-4 text-io-purple" />
                            <input
                                value={customerPhone}
                                onChange={(event) => {
                                    setCustomerPhone(formatPhoneInput(event.target.value));
                                    setFeedback(null);
                                }}
                                placeholder="(11) 99999-9999"
                                className="w-full bg-transparent text-sm font-medium text-io-dark outline-none placeholder:text-black/35"
                                inputMode="tel"
                                autoComplete="tel"
                                disabled={submitting}
                            />
                        </div>
                    </label>

                    {feedback ? (
                        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {feedback}
                        </div>
                    ) : null}

                    <div className="rounded-[24px] border border-[#6b00e3]/10 bg-[#f7f0ff] px-4 py-4 text-sm text-black/58">
                        {"Seus dados ser\u00E3o usados apenas para registrar o lead e continuar o contato no WhatsApp."}
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-full border border-[#6b00e3]/12 bg-white px-5 py-3 text-sm font-semibold text-black/60 transition hover:border-[#6b00e3]/20 hover:text-io-purple disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {"Cancelar"}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(107,0,227,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                            {submitting ? "Enviando..." : "Continuar para o WhatsApp"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
