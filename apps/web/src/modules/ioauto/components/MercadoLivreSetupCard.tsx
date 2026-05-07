"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Cable, CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import type { MeliAdRecord, MeliIntegrationStatus, MeliSyncSummary } from "@/modules/ioauto/types";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

export function MercadoLivreSetupCard() {
    const [status, setStatus] = useState<MeliIntegrationStatus | null>(null);
    const [ads, setAds] = useState<MeliAdRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        setError(null);
        try {
            const [statusResponse, adsResponse] = await Promise.all([
                fetch("/api/integrations/mercadolivre/status", { cache: "no-store" }),
                fetch("/api/integrations/mercadolivre/ads", { cache: "no-store" }),
            ]);

            const statusPayload = (await statusResponse.json().catch(() => null)) as MeliIntegrationStatus | { message?: string } | null;
            if (!statusResponse.ok) {
                throw new Error((statusPayload as { message?: string } | null)?.message ?? "Falha ao carregar o status do Mercado Livre.");
            }
            setStatus(statusPayload as MeliIntegrationStatus);

            if (adsResponse.ok) {
                setAds((await adsResponse.json()) as MeliAdRecord[]);
            } else {
                setAds([]);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar a integracao Mercado Livre.");
        } finally {
            setLoading(false);
        }
    }

    async function handleConnect() {
        setWorking("connect");
        setError(null);
        try {
            const response = await fetch("/api/integrations/mercadolivre/connect-url", { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
            if (!response.ok || !payload?.url) {
                throw new Error(payload?.message ?? "Falha ao iniciar a conexao com o Mercado Livre.");
            }
            window.location.assign(payload.url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao iniciar a conexao com o Mercado Livre.");
            setWorking(null);
        }
    }

    async function handleDisconnect() {
        await runAction("disconnect", async () => {
            const response = await fetch("/api/integrations/mercadolivre/disconnect", { method: "POST" });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao desconectar a conta Mercado Livre." }));
                throw new Error(payload.message ?? "Falha ao desconectar a conta Mercado Livre.");
            }
            setMessage("Conta Mercado Livre desconectada.");
            await loadAll();
        });
    }

    async function handleSyncCategories() {
        await runAction("categories", async () => {
            const response = await fetch("/api/integrations/mercadolivre/categories/sync", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as { total?: number; message?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.message ?? "Falha ao sincronizar as categorias do Mercado Livre.");
            }
            setMessage(`Categorias do Mercado Livre sincronizadas: ${payload?.total ?? 0} categorias raiz atualizadas.`);
        });
    }

    async function handleSyncAds() {
        await runAction("ads", async () => {
            const response = await fetch("/api/integrations/mercadolivre/ads/sync-all", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as MeliSyncSummary | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao sincronizar os anuncios do Mercado Livre.");
            }
            const summary = payload as MeliSyncSummary;
            setMessage(`Sincronizacao concluida: ${summary.total} anuncios consultados no Mercado Livre.`);
            await loadAll();
        });
    }

    async function runAction(action: string, callback: () => Promise<void>) {
        setWorking(action);
        setError(null);
        setMessage(null);
        try {
            await callback();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao processar a acao.");
        } finally {
            setWorking(null);
        }
    }

    const activeAds = ads.filter((item) => item.status?.toUpperCase() === "ACTIVE").length;
    const lastSync = ads
        .map((item) => item.lastSyncedAt)
        .filter((item): item is string => Boolean(item))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

    if (loading) {
        return (
            <article className="rounded-[34px] border border-black/10 bg-white p-8 shadow-[0_22px_55px_rgba(0,0,0,0.07)]">
                <div className="flex items-center gap-3 text-black/52">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Carregando integracao Mercado Livre...</span>
                </div>
            </article>
        );
    }

    return (
        <article className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_22px_55px_rgba(0,0,0,0.07)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="inline-flex items-center rounded-full bg-[#fff9d7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8b7400]">
                        Integracao Mercado Livre
                    </p>
                    <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">Mercado Livre</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-black/56">
                        Conecte a conta da loja via OAuth, sincronize categorias da MLB e acompanhe os anuncios sem expor tokens no frontend.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => void loadAll()}
                        disabled={working != null}
                        className="inline-flex h-12 items-center gap-2 rounded-full border border-black/12 px-5 text-sm font-semibold text-black/72 transition hover:border-black/20 hover:text-io-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {working === "refresh" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Atualizar
                    </button>
                    {status?.connected ? (
                        <button
                            type="button"
                            onClick={() => void handleDisconnect()}
                            disabled={working != null}
                            className="inline-flex h-12 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {working === "disconnect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                            Desconectar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleConnect()}
                            disabled={working != null}
                            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ffe14a] px-5 text-sm font-semibold text-[#2f2a05] transition hover:bg-[#f0cf2e] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {working === "connect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
                            Conectar Mercado Livre
                        </button>
                    )}
                </div>
            </div>

            {error ? <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    label="Status da conta"
                    value={status?.connected ? "Conectada" : "Desconectada"}
                    detail={status ? statusLabel(status.integrationStatus) : "-"}
                />
                <StatCard
                    icon={<ExternalLink className="h-5 w-5" />}
                    label="Anuncios ativos"
                    value={String(activeAds)}
                    detail={`${ads.length} anuncios locais monitorados`}
                />
                <StatCard
                    icon={<RefreshCw className="h-5 w-5" />}
                    label="Ultima sincronizacao"
                    value={formatDateTime(lastSync)}
                    detail={status?.nickname ?? "Sem conta conectada"}
                />
                <StatCard
                    icon={<Cable className="h-5 w-5" />}
                    label="Site / usuario"
                    value={status?.siteId ?? "MLB"}
                    detail={status?.userId != null ? `User ID ${status.userId}` : "Conta ainda nao conectada"}
                />
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[28px] border border-black/8 bg-[#faf8f4] p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Conta conectada</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoRow label="Nickname" value={status?.nickname ?? "-"} />
                        <InfoRow label="User ID" value={status?.userId != null ? String(status.userId) : "-"} />
                        <InfoRow label="Site" value={status?.siteId ?? "MLB"} />
                        <InfoRow label="Conectada em" value={formatDateTime(status?.connectedAt)} />
                    </div>
                </section>

                <section className="rounded-[28px] border border-black/8 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Acoes</p>
                    <div className="mt-4 grid gap-3">
                        <ActionButton
                            label="Sincronizar categorias MLB"
                            loading={working === "categories"}
                            onClick={() => void handleSyncCategories()}
                            disabled={working != null}
                        />
                        <ActionButton
                            label="Sincronizar meus anuncios"
                            loading={working === "ads"}
                            onClick={() => void handleSyncAds()}
                            disabled={!status?.connected || working != null}
                        />
                    </div>
                </section>
            </div>
        </article>
    );
}

function StatCard({
    icon,
    label,
    value,
    detail,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="rounded-[28px] border border-black/8 bg-[#fafafa] p-5">
            <div className="flex items-center justify-between gap-3 text-black/42">
                <p className="text-xs font-bold uppercase tracking-[0.18em]">{label}</p>
                {icon}
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-io-dark">{value}</p>
            <p className="mt-2 text-sm text-black/52">{detail}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-black/8 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">{label}</p>
            <p className="mt-2 text-sm font-medium text-io-dark">{value}</p>
        </div>
    );
}

function ActionButton({
    label,
    loading,
    disabled,
    onClick,
}: {
    label: string;
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20"
        >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {label}
        </button>
    );
}
