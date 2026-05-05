"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginForm } from "@/modules/auth/schemas/loginSchema";
import { useState } from "react";

type LoginFormProps = {
    embedded?: boolean;
};

export function LoginForm({ embedded = false }: LoginFormProps) {
    const [error, setError] = useState<string | null>(null);

    const form = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: LoginForm) {
        setError(null);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ message: "Falha no login" }));
                setError(data.message ?? "Falha no login");
                return;
            }

            // Use a full navigation so the browser persists the new httpOnly
            // auth cookies before the protected app bootstraps.
            window.location.assign("/protected/dashboard");
        } catch {
            setError("Não foi possível conectar com o servidor de autenticação.");
        }
    }

    const content = (
        <>
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(0,0,0,0.45)", marginBottom: 8 }}>Acesso seguro</p>
                <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08 }}>Entrar no IOAuto</h1>
                <p style={{ marginTop: 8, color: "rgba(0,0,0,0.58)", lineHeight: 1.7 }}>Use o e-mail e a senha configurados na ativacao da operacao.</p>
            </div>

            {error && (
                <div style={{ background: "#ffecec", border: "1px solid #ffb3b3", padding: 12, borderRadius: 18, marginBottom: 12, fontSize: 14 }}>
                    {error}
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
