"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginForm } from "@/modules/auth/schemas/loginSchema";

type LoginFormProps = {
    embedded?: boolean;
};

type LoginErrorState = {
    code?: string | null;
    message: string;
};

type SupportContactState = {
    configured: boolean;
    whatsappNumber: string;
    whatsappDisplay: string;
    whatsappUrl: string;
};

function resolveLoginErrorMessage(code?: string | null, fallback?: string | null) {
    if (code === "AUTH_INVALID") {
        return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
    }
    if (code === "AUTH_INACTIVE") {
        return "Seu acesso esta inativo no momento. Entre em contato com o administrador da empresa.";
    }
    if (code === "TENANT_BLOCKED") {
        return "A conta da sua empresa esta bloqueada no momento. Fale com o suporte para regularizar o acesso.";
    }
    if (code === "VALIDATION_ERROR") {
        return fallback || "Revise os dados informados e tente novamente.";
    }
    return fallback || "Nao foi possivel concluir o login no momento.";
}

export function LoginForm({ embedded = false }: LoginFormProps) {
    const [error, setError] = useState<LoginErrorState | null>(null);
    const [supportContact, setSupportContact] = useState<SupportContactState | null>(null);
    const [supportLoading, setSupportLoading] = useState(false);

    const form = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function loadSupportContact() {
        if (supportLoading || supportContact?.whatsappUrl) {
            return;
        }

        setSupportLoading(true);
        try {
            const response = await fetch("/api/auth/support-contact", { cache: "no-store" });
            if (!response.ok) {
                return;
            }

            const payload = (await response.json()) as SupportContactState;
            setSupportContact(payload);
        } catch {
            // Ignore contact loading failures so the login flow keeps working.
        } finally {
            setSupportLoading(false);
        }
    }

    useEffect(() => {
        if (error?.code === "TENANT_BLOCKED") {
            void loadSupportContact();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error?.code]);

    async function onSubmit(values: LoginForm) {
        setError(null);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ code: null, message: "Falha no login" }));
                setError({
                    code: data.code ?? null,
                    message: resolveLoginErrorMessage(data.code ?? null, data.message ?? null),
                });
                return;
            }

            // Use a full navigation so the browser persists the new httpOnly
            // auth cookies before the protected app bootstraps.
            window.location.assign("/protected");
        } catch {
            setError({ message: "Não foi possível conectar com o servidor de autenticação." });
        }
    }

    const blockedTenant = error?.code === "TENANT_BLOCKED";

    const content = (
        <>
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(0,0,0,0.45)", marginBottom: 8 }}>Acesso seguro</p>
                <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08 }}>Entrar no IOAuto</h1>
                <p style={{ marginTop: 8, color: "rgba(0,0,0,0.58)", lineHeight: 1.7 }}>Use o e-mail e a senha configurados na ativação da operação.</p>
            </div>

            {error && (
                <div style={{ background: "#ffecec", border: "1px solid #ffb3b3", padding: 16, borderRadius: 18, marginBottom: 12, fontSize: 14, display: "grid", gap: 12 }}>
                    <span>{error.message}</span>
                    {blockedTenant && supportContact?.configured && supportContact.whatsappUrl ? (
                        <a
                            href={supportContact.whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 44,
                                padding: "0 18px",
                                borderRadius: 999,
                                background: "#121212",
                                color: "#ffffff",
                                fontWeight: 700,
                                textDecoration: "none",
                                width: "fit-content",
                            }}
                        >
                            Falar com o suporte no WhatsApp
                        </a>
                    ) : null}
                    {blockedTenant && supportLoading ? (
                        <span style={{ color: "rgba(0,0,0,0.58)", fontSize: 13 }}>Carregando contato do suporte...</span>
                    ) : null}
                </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: 12 }}>
                <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Email</label>
                    <input
                        {...form.register("email")}
                        style={{ width: "100%", height: 48, padding: "0 16px", borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)", background: "#f5f5f5", outline: "none" }}
                    />
                    {form.formState.errors.email && (
                        <p style={{ color: "#c00", marginTop: 6, fontSize: 12 }}>{form.formState.errors.email.message}</p>
                    )}
                </div>

                <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Senha</label>
                    <input
                        type="password"
                        {...form.register("password")}
                        style={{ width: "100%", height: 48, padding: "0 16px", borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)", background: "#f5f5f5", outline: "none" }}
                    />
                    {form.formState.errors.password && (
                        <p style={{ color: "#c00", marginTop: 6, fontSize: 12 }}>{form.formState.errors.password.message}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    style={{ height: 50, borderRadius: 999, border: "none", cursor: "pointer", background: "#121212", color: "#ffffff", fontWeight: 700 }}
                >
                    {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
                </button>
            </form>
        </>
    );

    if (embedded) return content;

    return (
        <div style={{ maxWidth: 420, margin: "64px auto", padding: 24, border: "1px solid #ddd", borderRadius: 12 }}>
            {content}
        </div>
    );
}
