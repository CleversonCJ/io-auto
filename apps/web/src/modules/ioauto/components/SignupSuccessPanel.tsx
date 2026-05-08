"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import type { SignupStatus } from "@/modules/ioauto/types";

type SignupSuccessPanelProps = {
    intentId: string;
    sessionId: string;
};

export function SignupSuccessPanel({ intentId, sessionId }: SignupSuccessPanelProps) {
    const [status, setStatus] = useState<SignupStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function pollStatus() {
            try {
                const params = new URLSearchParams({ intentId, sessionId });
                const response = await fetch(`/api/public/signup/status?${params.toString()}`, { cache: "no-store" });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao validar a ativação." }));
                    throw new Error(payload.message ?? "Falha ao validar a ativação.");
                }
                const payload = (await response.json()) as SignupStatus;
                if (!active) return;
                setStatus(payload);
                setError(null);
                if (!payload.accessReady) {
                    window.setTimeout(pollStatus, 3000);
                }
            } catch (cause) {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : "Falha ao validar a ativação.");
            }
        }

        pollStatus();

        return () => {
            active = false;
        };
    }, [intentId, sessionId]);

    const ready = useMemo(() => status?.accessReady ?? false, [status]);

    return (
        <div className="rounded-[34px] border border-[#6b00e3]/12 bg-white p-8 shadow-[0_18px_45px_rgba(90,10,160,0.10)]">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#6b00e3] text-white">
                {ready ? <CheckCircle2 className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin" />}
            </div>

            <h1 className="mt-6 font-display text-4xl font-bold text-io-dark">
                {ready ? "Conta liberada com sucesso" : "Validando sua assinatura"}
            </h1>
            <p className="mt-4 text-sm leading-7 text-black/55">
                {status?.message ?? "Estamos confirmando o pagamento no Asaas e concluindo a ativacao da conta."}
            </p>

            {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-6 grid gap-3 rounded-[28px] bg-[#faf6ff] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-black/55">Empresa</span>
                    <span className="font-semibold text-io-dark">{status?.companyName || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-black/55">Login</span>
                    <span className="font-semibold text-io-dark">{status?.loginEmail || "-"}</span>
                </div>
            </div>

            {ready ? (
                <div className="mt-4 rounded-[28px] border border-[#6b00e3]/12 bg-[#f6f0ff] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[#6b00e3]/75">Proximo passo</p>
                    <p className="mt-2 text-sm leading-7 text-black/58">
                        Abra o e-mail informado no cadastro e use o link recebido para definir sua senha antes do primeiro login.
                    </p>
                </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
                {ready ? (
                    <Link href="/login" className="rounded-full bg-[#6b00e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5800bb]">
                        Entrar depois de definir a senha
                    </Link>
                ) : null}
                <Link href="/" className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-black/65 transition hover:border-[#6b00e3]/20 hover:text-[#6b00e3]">
                    Voltar para a home
                </Link>
            </div>
        </div>
    );
}
