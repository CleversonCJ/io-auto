"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRightLeft, Cable, CheckCircle2, ExternalLink, LoaderCircle, LogOut, RefreshCw, Unplug, X } from "lucide-react";
import type { MeliAdRecord, MeliIntegrationStatus, MeliSyncSummary } from "@/modules/ioauto/types";
import { formatDateTime } from "@/modules/ioauto/formatters";

function getInitials(fullName?: string | null, nickname?: string | null) {
    const source = (fullName?.trim() || nickname?.trim() || "Mercado Livre").split(/\s+/).filter(Boolean);
    const first = source[0]?.[0] ?? "M";
    const second = source[1]?.[0] ?? source[0]?.[1] ?? "L";
    return `${first}${second}`.toUpperCase();
}

type Props = {
    onConnectionStateChange?: (connected: boolean) => void;
    onRefreshParent?: () => void;
};

export function MercadoLivreSetupCard({ onConnectionStateChange, onRefreshParent }: Props) {
    const [status, setStatus] = useState<MeliIntegrationStatus | null>(null);
    const [ads, setAds] = useState<MeliAdRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [switchAccountOpen, setSwitchAccountOpen] = useState(false);
    const [meliSessionChanged, setMeliSessionChanged] = useState(false);

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
            const nextStatus = statusPayload as MeliIntegrationStatus;
            setStatus(nextStatus);
            onConnectionStateChange?.(nextStatus.connected);

            if (adsResponse.ok) {
                setAds((await adsResponse.json()) as MeliAdRecord[]);
            } else {
                setAds([]);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar a integração Mercado Livre.");
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
                throw new Error(payload?.message ?? "Falha ao iniciar a conexão com o Mercado Livre.");
            }
            window.location.assign(payload.url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao iniciar a conexão com o Mercado Livre.");
            setWorking(null);
        }
    }

    async function handleDisconnect() {
        await runAction("disconnect", async () => {
            const response = await fetch("/api/integrations/mercadolivre/disconnect", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as { message?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.message ?? "Falha ao desconectar a conta Mercado Livre.");
            }
            setMessage(payload?.message ?? "Autorização revogada e conta Mercado Livre desconectada.");
            await loadAll();
            onRefreshParent?.();
        });
    }

    function openSwitchAccount() {
        setError(null);
        setMessage(null);
        setMeliSessionChanged(false);
        setSwitchAccountOpen(true);
    }

    async function handleSwitchAccount() {
        setWorking("switch");
        setError(null);
        try {
            const response = await fetch("/api/integrations/mercadolivre/switch-account", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
            if (!response.ok || !payload?.url) {
                throw new Error(payload?.message ?? "Falha ao iniciar a troca da conta Mercado Livre.");
            }
            setSwitchAccountOpen(false);
            window.location.assign(payload.url);
        } catch (cause) {
            setSwitchAccountOpen(false);
            setError(cause instanceof Error ? cause.message : "Falha ao iniciar a troca da conta Mercado Livre.");
            setWorking(null);
        }
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
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao sincronizar os anúncios do Mercado Livre.");
            }
            const summary = payload as MeliSyncSummary;
            setMessage(`Sincronização concluída: ${summary.total} anúncios consultados no Mercado Livre.`);
            await loadAll();
            onRefreshParent?.();
        });
    }

    async function runAction(action: string, callback: () => Promise<void>) {
        setWorking(action);
        setError(null);
        setMessage(null);
        try {
            await callback();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao processar a ação.");
        } finally {
            setWorking(null);
        }
    }

    const activeAds = ads.filter((item) => item.status?.toUpperCase() === "ACTIVE").length;
    const connectedDisplayName = status?.fullName || status?.nickname || "Conta ainda não conectada";
    const lastSync = ads
        .map((item) => item.lastSyncedAt)
        .filter((item): item is string => Boolean(item))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

    if (loading) {
        return (
            <article className="rounded-[34px] border border-black/10 bg-white p-8 shadow-[0_22px_55px_rgba(0,0,0,0.07)]">
                <div className="flex items-center gap-3 text-black/52">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Carregando integração Mercado Livre...</span>
                </div>
            </article>
        );
    }

    return (
        <article className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_22px_55px_rgba(0,0,0,0.07)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">Mercado Livre</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-black/56">
                        Conecte sua conta da loja, sincronize categorias e acompanhe os anúncios.
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
                        <>
                            <button
                                type="button"
                                onClick={openSwitchAccount}
                                disabled={working != null}
                                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ffe14a] px-5 text-sm font-semibold text-[#2f2a05] transition hover:bg-[#f0cf2e] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {working === "switch" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                                Trocar conta
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDisconnect()}
                                disabled={working != null}
                                className="inline-flex h-12 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {working === "disconnect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                                Desconectar
                            </button>
                        </>
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

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                <StatCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    label="Status da conta"
                    value={status?.connected ? "Conectada" : "Desconectada"}
                />
                <StatCard
                    icon={<ExternalLink className="h-5 w-5" />}
                    label="Anúncios ativos"
                    value={String(activeAds)}
                />
                <StatCard
                    icon={<RefreshCw className="h-5 w-5" />}
                    label="última sincronização"
                    value={formatDateTime(lastSync)}
                />
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-[28px] border border-black/8 bg-[#faf8f4] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        {status?.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={status.profileImageUrl}
                                alt={status.fullName ?? status.nickname ?? "Conta Mercado Livre"}
                                className="h-20 w-20 rounded-[26px] border border-black/8 object-cover"
                            />
                        ) : (
                            <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-[#ffe14a] text-xl font-bold text-[#2f2a05]">
                                {getInitials(status?.fullName, status?.nickname)}
                            </div>
                        )}

                        <div className="md:flex-1">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Conta conectada</p>
                            <h3 className="mt-2 font-display text-3xl font-bold text-io-dark">{connectedDisplayName}</h3>
                            <p className="mt-2 text-sm text-black/52">
                                {status?.nickname ? `Apelido da conta: ${status.nickname}` : "Aguardando dados da conta conectada."}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <InfoRow label="Apelido" value={status?.nickname ?? "-"} />
                        <InfoRow label="Site" value={status?.siteId ?? "MLB"} />
                        <InfoRow label="Conectada em" value={formatDateTime(status?.connectedAt)} />
                    </div>
                </section>

                <section className="rounded-[28px] border border-black/8 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Ações</p>
                    <div className="mt-4 grid gap-3">
                        <ActionButton
                            label="Sincronizar categorias MLB"
                            loading={working === "categories"}
                            onClick={() => void handleSyncCategories()}
                            disabled={!status?.connected || working != null}
                        />
                        <ActionButton
                            label="Sincronizar meus anúncios"
                            loading={working === "ads"}
                            onClick={() => void handleSyncAds()}
                            disabled={!status?.connected || working != null}
                        />
                    </div>
                </section>
            </div>

            {switchAccountOpen ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && working !== "switch") setSwitchAccountOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="meli-switch-account-title"
                        className="w-full max-w-xl rounded-[32px] border border-white/20 bg-white p-6 shadow-[0_32px_100px_rgba(0,0,0,0.3)] md:p-8"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8a7300]">Troca segura de conta</p>
                                <h3 id="meli-switch-account-title" className="mt-3 font-display text-3xl font-bold text-io-dark">Conectar outro Mercado Livre</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSwitchAccountOpen(false)}
                                disabled={working === "switch"}
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5 text-black/55 transition hover:bg-black/10 disabled:opacity-40"
                                aria-label="Fechar troca de conta"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 rounded-[24px] border border-black/8 bg-[#faf8f4] p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Conta atual</p>
                            <p className="mt-2 text-lg font-bold text-io-dark">{connectedDisplayName}</p>
                            {status?.userId ? <p className="mt-1 text-xs text-black/45">ID Mercado Livre: {status.userId}</p> : null}
                        </div>

                        <div className="mt-6 space-y-4 text-sm leading-6 text-black/62">
                            <p>
                                Para impedir que o Mercado Livre reutilize automaticamente esta conta, abra o site em outra aba,
                                saia da sessão atual e entre com a conta principal que deseja conectar.
                            </p>
                            <a
                                href="https://www.mercadolivre.com.br/"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-5 font-semibold text-io-dark transition hover:border-black/25"
                            >
                                <LogOut className="h-4 w-4" />
                                Abrir Mercado Livre para trocar login
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>

                        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[22px] border border-black/10 bg-black/[0.025] p-4">
                            <input
                                type="checkbox"
                                checked={meliSessionChanged}
                                onChange={(event) => setMeliSessionChanged(event.target.checked)}
                                className="mt-1 h-4 w-4 accent-[#c9a900]"
                            />
                            <span className="text-sm leading-6 text-black/65">
                                Já saí da conta atual ou alterei o usuário no Mercado Livre.
                            </span>
                        </label>

                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setSwitchAccountOpen(false)}
                                disabled={working === "switch"}
                                className="inline-flex h-12 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-black/65 transition hover:border-black/25 disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSwitchAccount()}
                                disabled={!meliSessionChanged || working === "switch"}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#ffe14a] px-5 text-sm font-bold text-[#2f2a05] transition hover:bg-[#f0cf2e] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30"
                            >
                                {working === "switch" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                                Revogar e conectar outra conta
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </article>
    );
}

function StatCard({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[28px] border border-black/8 bg-[#fafafa] p-5">
            <div className="flex items-center justify-between gap-3 text-black/42">
                <p className="text-xs font-bold uppercase tracking-[0.18em]">{label}</p>
                {icon}
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-io-dark">{value}</p>
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
