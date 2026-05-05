"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Cable, CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, Unplug, Wallet } from "lucide-react";
import type { OlxBalanceSnapshot, OlxIntegrationStatus, OlxWebhookConfig } from "@/modules/ioauto/types";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

type CatalogSyncSummary = {
    brands: number;
    models: number;
    versions: number;
    syncedAt: string;
};

export function OlxSetupCard() {
    const [status, setStatus] = useState<OlxIntegrationStatus | null>(null);
    const [balance, setBalance] = useState<OlxBalanceSnapshot | null>(null);
    const [webhook, setWebhook] = useState<OlxWebhookConfig | null>(null);
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
            const [statusResponse, webhookResponse] = await Promise.all([
                fetch("/api/integrations/olx/status", { cache: "no-store" }),
                fetch("/api/integrations/olx/webhook", { cache: "no-store" }),
            ]);

            if (!statusResponse.ok) {
                const payload = await statusResponse.json().catch(() => ({ message: "Falha ao carregar a OLX." }));
                throw new Error(payload.message ?? "Falha ao carregar a OLX.");
            }

            const statusPayload = (await statusResponse.json()) as OlxIntegrationStatus;
            setStatus(statusPayload);

            if (webhookResponse.ok) {
                setWebhook((await webhookResponse.json()) as OlxWebhookConfig);
            } else {
                setWebhook(null);
            }

            if (statusPayload.connected) {
                const balanceResponse = await fetch("/api/integrations/olx/balance", { cache: "no-store" });
                if (balanceResponse.ok) {
                    setBalance((await balanceResponse.json()) as OlxBalanceSnapshot);
                } else {
                    setBalance(null);
                }
            } else {
                setBalance(null);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar a OLX.");
        } finally {
            setLoading(false);
        }
    }

    async function handleConnect() {
        setWorking("connect");
        setError(null);
        try {
            const response = await fetch("/api/integrations/olx/connect-url", { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
            if (!response.ok || !payload?.url) {
                throw new Error(payload?.message ?? "Falha ao iniciar a conexao com a OLX.");
            }
            window.location.assign(payload.url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao iniciar a conexao com a OLX.");
            setWorking(null);
        }
    }

    async function handleDisconnect() {
        await runAction("disconnect", async () => {
            const response = await fetch("/api/integrations/olx/disconnect", { method: "POST" });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao desconectar a OLX." }));
                throw new Error(payload.message ?? "Falha ao desconectar a OLX.");
            }
            setMessage("Conta OLX desconectada.");
            await loadAll();
        });
    }

    async function handleSyncCatalog() {
        await runAction("catalog", async () => {
            const response = await fetch("/api/integrations/olx/catalog/sync", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as CatalogSyncSummary | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao sincronizar o catalogo da OLX.");
            }
            const summary = payload as CatalogSyncSummary;
            setMessage(`Catalogo OLX sincronizado: ${summary.brands} marcas, ${summary.models} modelos e ${summary.versions} versoes.`);
        });
    }

    async function handleConfigureWebhook() {
        await runAction("webhook", async () => {
            const response = await fetch("/api/integrations/olx/webhook/configure", { method: "POST" });
            const payload = (await response.json().catch(() => null)) as OlxWebhookConfig | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao configurar o webhook da OLX.");
            }
            setWebhook(payload as OlxWebhookConfig);
            setMessage("Webhook da OLX configurado com sucesso.");
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

    if (loading) {
        return (
            <article className="rounded-[34px] border border-black/10 bg-white p-8 shadow-[0_22px_55px_rgba(0,0,0,0.07)]">
                <div className="flex items-center gap-3 text-black/52">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Carregando integracao OLX...</span>
                </div>
            </article>
        );
    }

    return (
        <article className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_22px_55px_rgba(0,0,0,0.07)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="inline-flex items-center rounded-full bg-[#fff3e8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d56700]">
                        Integracao OLX
                    </p>
                    <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">OLX</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-black/56">
                        Conecte a conta da loja via OAuth, sincronize o catalogo da OLX e acompanhe o saldo de anuncios sem expor credenciais no frontend.
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
                            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#d56700] px-5 text-sm font-semibold text-white transition hover:bg-[#9f4c00] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {working === "connect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
                            Conectar OLX
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
                    icon={<Wallet className="h-5 w-5" />}
                    label="Saldo de anuncios"
                    value={balance?.ads?.available != null ? String(balance.ads.available) : "-"}
                    detail={balance?.available ? `Total do plano: ${balance.ads?.total ?? "-"}` : balance?.message ?? "Conecte a conta para consultar"}
                />
                <StatCard
                    icon={<RefreshCw className="h-5 w-5" />}
                    label="Webhook"
                    value={webhook?.configured ? "Ativo" : "Nao configurado"}
                    detail={webhook?.id ?? "Sem identificador salvo"}
                />
                <StatCard
                    icon={<ExternalLink className="h-5 w-5" />}
                    label="Ultima atualizacao"
                    value={formatDateTime(status?.updatedAt)}
                    detail={status?.userEmail ?? status?.userName ?? "Conta sem dados do anunciante"}
                />
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[28px] border border-black/8 bg-[#faf8f4] p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Conta conectada</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoRow label="Nome OLX" value={status?.userName ?? "-"} />
                        <InfoRow label="E-mail OLX" value={status?.userEmail ?? "-"} />
                        <InfoRow label="Conectada em" value={formatDateTime(status?.connectedAt)} />
                        <InfoRow label="Webhook ID" value={status?.webhookNotificationId ?? "-"} />
                    </div>
                </section>

                <section className="rounded-[28px] border border-black/8 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Acoes</p>
                    <div className="mt-4 grid gap-3">
                        <ActionButton
                            label="Sincronizar catalogo OLX"
                            loading={working === "catalog"}
                            onClick={() => void handleSyncCatalog()}
                            disabled={!status?.connected || working != null}
                        />
                        <ActionButton
                            label={webhook?.configured ? "Atualizar webhook OLX" : "Configurar webhook OLX"}
                            loading={working === "webhook"}
                            onClick={() => void handleConfigureWebhook()}
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
