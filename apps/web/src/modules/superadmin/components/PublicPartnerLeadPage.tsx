"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/modules/ioauto/components/BrandMark";
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

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao processar a solicitação.") {
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
            setError("Link de parceiro inválido.");
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        fetchJson<PublicPartnerResponse>(`/api/public/parceiros?ref=${encodeURIComponent(referenceCode)}`, undefined, "Não foi possível validar o parceiro.")
            .then((payload) => {
                if (!active) return;
                setPartner(payload);
            })
            .catch((requestError) => {
                if (!active) return;
                setError(requestError instanceof Error ? requestError.message : "Não foi possível validar o parceiro.");
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
            }, "Não foi possível enviar seu cadastro.");

            setFeedback("Recebemos seus dados. Nosso time comercial vai continuar esse contato.");
            setForm(EMPTY_FORM);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar seu cadastro.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,227,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.14),_transparent_24%),linear-gradient(180deg,#f8f7ff_0%,#f1f3fb_52%,#ffffff_100%)] px-4 py-10">
            <div className="mx-auto grid min-h-[85vh] w-full max-w-5xl place-items-center">
                <div className="grid w-full gap-0 overflow-hidden rounded-[38px] border border-black/10 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.14)] md:grid-cols-[0.95fr_1.05fr]">
                    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_35%),linear-gradient(145deg,#12071f_0%,#280a52_52%,#6b00e3_100%)] p-7 text-white md:p-10">
                        <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-black/20 blur-2xl" />
                        <div className="relative">
                            <BrandMark href="/login" variant="white" />
                            <h1 className="mt-4 font-display text-[2.15rem] font-bold leading-tight">
                                Descubra como o IO Auto pode acelerar a operação da sua loja.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-white/76">
                                Centralize estoque, publicações e operação comercial em uma plataforma pensada para revendas que querem mais organização, mais velocidade e mais resultado.
                            </p>

                            <div className="mt-7 grid gap-3">
                                <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                                    <p className="text-sm font-semibold">Mais controle em menos tempo</p>
                                    <p className="mt-1 text-sm text-white/68">Organize a operação da loja em um fluxo simples e profissional.</p>
                                </div>
                                <div className="rounded-[22px] border border-white/12 bg-black/18 px-4 py-4">
                                    <p className="text-sm font-semibold">Contato comercial consultivo</p>
                                    <p className="mt-1 text-sm text-white/68">Nosso time entende seu perfil e apresenta o plano ideal para o seu momento.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/96 p-6 md:p-10">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Solicite seu atendimento</p>
                            <h2 className="mt-3 text-[1.9rem] font-bold leading-tight text-io-dark">
                                Preencha os dados e conheça o sistema IO Auto.
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-black/56">
                                Nosso time comercial vai analisar seu perfil e entrar em contato para apresentar a plataforma e os planos disponíveis.
                            </p>
                        </div>

                        <div className="mt-8">
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
                                            Seu nome
                                            <input
                                                value={form.shopkeeperName}
                                                onChange={(event) => setForm((current) => ({ ...current, shopkeeperName: event.target.value }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                                placeholder="Seu nome"
                                            />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/62">
                                            Nome da loja
                                            <input
                                                value={form.storeName}
                                                onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                                placeholder="Nome da revenda"
                                            />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/62">
                                            WhatsApp
                                            <input
                                                value={form.whatsapp}
                                                onChange={(event) => setForm((current) => ({ ...current, whatsapp: formatPhoneInput(event.target.value) }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                                placeholder="(11) 99999-9999"
                                            />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/62">
                                            E-mail
                                            <input
                                                value={form.email}
                                                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                                placeholder="contato@loja.com"
                                            />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/62">
                                            Cidade
                                            <input
                                                value={form.city}
                                                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                                placeholder="Cidade"
                                            />
                                        </label>
                                        <label className="grid gap-2 text-sm text-black/62">
                                            Estado
                                            <input
                                                maxLength={2}
                                                value={form.state}
                                                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))}
                                                className="rounded-2xl border border-black/10 bg-white px-4 py-3 uppercase outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
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
                                            className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-io-purple-2 focus:ring-4 focus:ring-[#6b00e3]/10"
                                            placeholder="Quantidade de veículos"
                                        />
                                    </label>

                                    <div className="flex justify-center pt-2 md:justify-start">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="rounded-full bg-[linear-gradient(135deg,#111827_0%,#6b00e3_100%)] px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {saving ? "Enviando..." : "Quero receber contato"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
