"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

type Props = {
    companyName?: string | null;
};

export function ImpersonationBanner({ companyName }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleExit() {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/auth/impersonation/exit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.message ?? "Falha ao encerrar impersonacao.");
            }

            router.push("/protected/superadmin/tenants");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao encerrar impersonacao.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    Voce esta acessando como administrador da conta {companyName ?? "selecionada"}.
                </div>
                <button
                    type="button"
                    onClick={handleExit}
                    disabled={loading}
                    className="rounded-full border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Saindo..." : "Sair da impersonacao"}
                </button>
            </div>
            {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
    );
}
