"use client";

import { useEffect, useState } from "react";

type SupportSettingsPayload = {
    configured: boolean;
    whatsappNumber: string;
    whatsappDisplay: string;
    whatsappUrl: string;
    updatedAt?: string | null;
};

function formatPhoneInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toBrDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR");
}

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao processar a solicitação.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message ?? fallbackMessage);
    }
    return payload as T;
}

export function SuperAdminSupportSettingsPage() {
    const [formWhatsapp, setFormWhatsapp] = useState("");
    const [preview, setPreview] = useState<SupportSettingsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadSettings() {
        setLoading(true);
        setError(null);

        try {
            const payload = await fetchJson<SupportSettingsPayload>(
                "/api/superadmin/support-settings",
                undefined,
                "Falha ao carregar as configurações de suporte.",
            );
            setPreview(payload);
            setFormWhatsapp(formatPhoneInput(payload.whatsappNumber || ""));
        } catch (requestError) {
            setPreview(null);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar as configurações de suporte.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setFeedback(null);
        setError(null);

        try {
            const payload = await fetchJson<SupportSettingsPayload>(
                "/api/superadmin/support-settings",
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ whatsappNumber: formWhatsapp }),
                },
                "Falha ao salvar as configurações de suporte.",
            );
            setPreview(payload);
            setFormWhatsapp(formatPhoneInput(payload.whatsappNumber || ""));
            setFeedback("Número de suporte salvo com sucesso.");
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao salvar as configurações de suporte.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="grid gap-6">
            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <form onSubmit={handleSubmit} className="grid gap-5">
                    <label className="grid gap-2 text-sm font-medium text-io-dark">
                        Número do WhatsApp de suporte
                        <input
                            value={formWhatsapp}
                            onChange={(event) => setFormWhatsapp(formatPhoneInput(event.target.value))}
                            placeholder="(11) 99999-9999"
                            className="h-12 rounded-2xl border border-black/12 px-4 text-sm outline-none transition focus:border-black/25"
                        />
                    </label>

                    <div className="rounded-2xl border border-dashed border-black/12 bg-black/[0.02] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Prévia</p>
                        <p className="mt-2 text-sm text-black/65">
                            Mensagem mostrada no login: <span className="font-semibold text-io-dark">A conta da sua empresa foi bloqueada, para saber mais entre em contato conosco via suporte.</span>
                        </p>
                        <p className="mt-2 text-sm text-black/65">
                            Número atual: <span className="font-semibold text-io-dark">{preview?.whatsappDisplay || "-"}</span>
                        </p>
                        <p className="mt-2 text-sm text-black/65">
                            Última atualização: <span className="font-semibold text-io-dark">{toBrDateTime(preview?.updatedAt)}</span>
                        </p>
                        {preview?.configured && preview.whatsappUrl ? (
                            <a
                                href={preview.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-io-dark px-5 text-sm font-semibold text-white"
                            >
                                Abrir WhatsApp configurado
                            </a>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            disabled={saving || loading}
                            className="inline-flex h-11 items-center justify-center rounded-full bg-io-dark px-5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {saving ? "Salvando..." : "Salvar número de suporte"}
                        </button>
                        {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
                        {error ? <p className="text-sm text-red-700">{error}</p> : null}
                        {loading ? <p className="text-sm text-black/55">Carregando configurações...</p> : null}
                    </div>
                </form>
            </section>
        </div>
    );
}
