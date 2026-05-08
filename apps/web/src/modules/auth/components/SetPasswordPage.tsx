"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/modules/ioauto/components/BrandMark";
import { setPasswordSchema, type SetPasswordFormValues } from "@/modules/auth/schemas/setPasswordSchema";

type SetPasswordValidation = {
    valid: boolean;
    userName: string;
    email: string;
    companyName: string;
    expiresAt: string;
    remainingHours: number;
};

export function SetPasswordPage({ token }: { token: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [data, setData] = useState<SetPasswordValidation | null>(null);

    const form = useForm<SetPasswordFormValues>({
        resolver: zodResolver(setPasswordSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    useEffect(() => {
        let active = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/public/password-setup/validate?token=${encodeURIComponent(token)}`, {
                    cache: "no-store",
                });

                const payload = await response.json().catch(() => null) as SetPasswordValidation | { message?: string } | null;

                if (!response.ok) {
                    throw new Error(payload && "message" in payload ? payload.message ?? "Não foi possível validar o link." : "Não foi possível validar o link.");
                }

                if (!active) return;
                setData(payload as SetPasswordValidation);
            } catch (cause) {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : "Não foi possível validar o link.");
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void load();

        return () => {
            active = false;
        };
    }, [token]);

    async function onSubmit(values: SetPasswordFormValues) {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/public/password-setup/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    password: values.password,
                }),
            });

            const payload = await response.json().catch(() => null) as { message?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.message ?? "Não foi possível definir sua senha.");
            }

            setSuccess(payload?.message ?? "Senha definida com sucesso.");
            form.reset();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível definir sua senha.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,227,0.14),_transparent_32%),linear-gradient(180deg,_#fcfbff_0%,_#f5efff_100%)]">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-10">
                <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="hidden rounded-[40px] border border-[#6b00e3]/10 bg-white p-10 shadow-[0_30px_80px_rgba(107,0,227,0.08)] lg:flex lg:flex-col lg:justify-between">
                        <div>
                            <BrandMark />
                            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] text-io-dark">
                                Defina sua senha e finalize a criação da conta.
                            </h1>
                            <p className="mt-5 max-w-xl text-base leading-8 text-black/60">
                                Seu acesso ao IO Auto já está quase pronto. Crie uma senha segura para entrar no painel e continuar a configuração da sua operação.
                            </p>
                        </div>

                        <div className="grid gap-3">
                            <div className="rounded-[28px] bg-io-purple p-5 text-white">
                                <p className="text-xs uppercase tracking-[0.28em] text-white/50">Ativação</p>
                                <p className="mt-3 text-lg font-semibold">Um único link, uma senha nova e acesso liberado para começar.</p>
                            </div>
                            <div className="rounded-[28px] border border-[#6b00e3]/10 bg-[#f8f3ff] p-5 text-black/60">
                                O link enviado por e-mail tem validade limitada. Se ele expirar, será preciso gerar um novo convite.
                            </div>
                        </div>
                    </section>

                    <section className="flex items-center justify-center">
                        <div className="w-full max-w-xl rounded-[36px] border border-[#6b00e3]/10 bg-white p-8 shadow-[0_30px_80px_rgba(107,0,227,0.08)]">
                            <div className="mb-8 lg:hidden">
                                <BrandMark />
                            </div>

                            {loading ? (
                                <div className="grid min-h-[360px] place-items-center">
                                    <div className="flex items-center gap-3 text-sm font-medium text-io-purple">
                                        <LoaderCircle className="h-5 w-5 animate-spin" />
                                        Validando seu link de acesso...
                                    </div>
                                </div>
                            ) : error && !data ? (
                                <div className="grid gap-6">
                                    <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-5 text-red-700">
                                        <p className="text-sm font-semibold">Não foi possível continuar.</p>
                                        <p className="mt-2 text-sm leading-7">{error}</p>
                                    </div>
                                    <Link
                                        href="/login"
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                    >
                                        Ir para o login
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            ) : data ? (
                                <div className="grid gap-6">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-io-purple">Definição de senha</p>
                                        <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-io-dark">
                                            {`Olá, ${data.userName}!`}
                                        </h2>
                                        <p className="mt-3 text-sm leading-7 text-black/60">
                                            Você está criando a senha de acesso da conta da empresa <span className="font-semibold text-io-dark">{data.companyName}</span>.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 rounded-[28px] border border-[#6b00e3]/10 bg-[#faf6ff] px-5 py-5">
                                        <div className="inline-flex items-center gap-2 text-sm font-medium text-black/60">
                                            <ShieldCheck className="h-4 w-4 text-io-purple" />
                                            {data.email}
                                        </div>
                                        <div className="inline-flex items-center gap-2 text-sm font-medium text-black/60">
                                            <KeyRound className="h-4 w-4 text-io-purple" />
                                            {`Link válido por aproximadamente ${data.remainingHours} hora(s)`}
                                        </div>
                                    </div>

                                    {error ? (
                                        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                            {error}
                                        </div>
                                    ) : null}

                                    {success ? (
                                        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-5">
                                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                                <CheckCircle2 className="h-5 w-5" />
                                                Senha criada com sucesso
                                            </div>
                                            <p className="mt-3 text-sm leading-7 text-emerald-800">{success}</p>
                                            <Link
                                                href="/login"
                                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                            >
                                                Entrar no IO Auto
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                                            <label className="grid gap-2">
                                                <span className="text-sm font-semibold text-io-dark">Nova senha</span>
                                                <div className="flex h-14 items-center gap-3 rounded-[22px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4">
                                                    <LockKeyhole className="h-4 w-4 text-io-purple" />
                                                    <input
                                                        type="password"
                                                        {...form.register("password")}
                                                        className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/35"
                                                        placeholder="Crie uma senha segura"
                                                    />
                                                </div>
                                                {form.formState.errors.password ? (
                                                    <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
                                                ) : null}
                                            </label>

                                            <label className="grid gap-2">
                                                <span className="text-sm font-semibold text-io-dark">Confirmar senha</span>
                                                <div className="flex h-14 items-center gap-3 rounded-[22px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4">
                                                    <ShieldCheck className="h-4 w-4 text-io-purple" />
                                                    <input
                                                        type="password"
                                                        {...form.register("confirmPassword")}
                                                        className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/35"
                                                        placeholder="Repita a senha"
                                                    />
                                                </div>
                                                {form.formState.errors.confirmPassword ? (
                                                    <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
                                                ) : null}
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="mt-2 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-io-purple px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {saving ? (
                                                    <>
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        Salvando senha...
                                                    </>
                                                ) : (
                                                    <>
                                                        Definir senha e continuar
                                                        <ArrowRight className="h-4 w-4" />
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
