"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicPartnerResponse } from "@/modules/superadmin/partnerProgramTypes";

type FormState = {
    shopkeeperName: string;
    storeName: string;
    whatsapp: string;
    email: string;
    city: string;
    state: string;
    approximateStock: string;
};

const EMPTY_FORM: FormState = {
    shopkeeperName: "",
    storeName: "",
    whatsapp: "",
    email: "",
    city: "",
    state: "",
    approximateStock: "",
};

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao processar a solicitacao.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message ?? fallbackMessage);
    }
    return payload as T;
}

function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function PublicPartnerLeadPage({ initialRef }: { initialRef: string }) {
    const [, setPartner] = useState<PublicPartnerResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);

    const referenceCode = useMemo(() => initialRef.trim(), [initialRef]);

    useEffect(() => {
        if (!referenceCode) {
            setLoading(false);
            setError("Link de parceiro invalido.");
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        fetchJson<PublicPartnerResponse>(`/api/public/parceiros?ref=${encodeURIComponent(referenceCode)}`, undefined, "Nao foi possivel validar o parceiro.")
            .then((payload) => {
                if (!active) return;
                setPartner(payload);
            })
            .catch((requestError) => {
                if (!active) return;
                setError(requestError instanceof Error ? requestError.message : "Nao foi possivel validar o parceiro.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [referenceCode]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!referenceCode) return;

        setSaving(true);
        setError(null);
        setFeedback(null);

        try {
            await fetchJson(`/api/public/parceiros/lead?ref=${encodeURIComponent(referenceCode)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shopkeeperName: form.shopkeeperName,
                    storeName: form.storeName,
                    whatsapp: form.whatsapp,
                    email: form.email || null,
                    city: form.city || null,
                    state: form.state || null,
                    approximateStock: form.approximateStock ? Number(form.approximateStock) : null,
                }),
            }, "Nao foi possivel enviar seu cadastro.");

            setFeedback("Recebemos seus dados. Nosso time comercial vai continuar esse contato.");
            setForm(EMPTY_FORM);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar seu cadastro.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.16),_transparent_34%),linear-gradient(180deg,#f6f7fb_0%,#eef2ff_100%)] px-4 py-10">
            <div className="mx-auto grid min-h-[85vh] w-full max-w-5xl place-items-center">
                <div className="grid w-full gap-6 rounded-[38px] border border-black/10 bg-white/92 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
                    <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/42">IO Auto</p>
                        <h1 className="mt-4 font-display text-[2.1rem] font-bold leading-tight text-io-dark">
                            Descubra como o IO Auto pode acelerar a operacao da sua loja.
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-black/56">
                            Preencha o formulario para demonstrar interesse no sistema IO Auto. Nosso time comercial vai analisar seu perfil e entrar em contato para apresentar a plataforma.
                        </p>
                    </div>

                    {loading ? (
                        <div className="rounded-[28px] border border-black/10 bg-black/[0.02] px-5 py-8 text-center text-sm text-black/56">
                            Validando o link do parceiro...
                        </div>
                    ) : error ? (
                        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-center text-sm text-rose-700">
                            {error}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-3xl gap-4">
                            {feedback ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm text-black/62">
                                    Nome do lojista
                                    <input
                                        value={form.shopkeeperName}
                                        onChange={(event) => setForm((current) => ({ ...current, shopkeeperName: event.target.value }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                        placeholder="Seu nome"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm text-black/62">
                                    Nome da loja
                                    <input
                                        value={form.storeName}
                                        onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                        placeholder="Nome da revenda"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm text-black/62">
                                    WhatsApp
                                    <input
                                        value={form.whatsapp}
                                        onChange={(event) => setForm((current) => ({ ...current, whatsapp: formatPhoneInput(event.target.value) }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                        placeholder="(11) 99999-9999"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm text-black/62">
                                    E-mail
                                    <input
                                        value={form.email}
                                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                        placeholder="contato@loja.com"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm text-black/62">
                                    Cidade
                                    <input
                                        value={form.city}
                                        onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                        placeholder="Cidade"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm text-black/62">
                                    Estado
                                    <input
                                        maxLength={2}
                                        value={form.state}
                                        onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))}
                                        className="rounded-2xl border border-black/10 px-4 py-3 uppercase outline-none transition focus:border-io-purple-2"
                                        placeholder="SP"
                                    />
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm text-black/62">
                                Estoque aproximado
                                <input
                                    type="number"
                                    min={0}
                                    value={form.approximateStock}
                                    onChange={(event) => setForm((current) => ({ ...current, approximateStock: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Quantidade de veiculos"
                                />
                            </label>

                            <div className="flex justify-center pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-full bg-io-dark px-7 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? "Enviando..." : "Quero receber contato"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
