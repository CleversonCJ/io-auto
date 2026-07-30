"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Cable, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { MercadoLivreSetupCard } from "@/modules/ioauto/components/MercadoLivreSetupCard";
import { OlxSetupCard } from "@/modules/ioauto/components/OlxSetupCard";
import { WebmotorsSetupCard } from "@/modules/ioauto/components/WebmotorsSetupCard";
import type { IntegrationRecord } from "@/modules/ioauto/types";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

type IntegrationDraft = {
    displayName: string;
    status: string;
    endpointUrl: string;
    accountName: string;
    username: string;
    apiToken: string;
    webhookSecret: string;
    lastError: string;
};

type SupportedIntegration = {
    providerKey: string;
    displayName: string;
    description: string;
    nextStepLabel: string;
};

const SUPPORTED_INTEGRATIONS: SupportedIntegration[] = [
    {
        providerKey: "mercadolivre",
        displayName: "Mercado Livre",
        description: "Conecte a conta da loja via OAuth para publicar, pausar, finalizar e sincronizar anúncios da MLB.",
        nextStepLabel: "Conectar via OAuth",
    },
    {
        providerKey: "olx",
        displayName: "OLX",
        description: "Conecte a conta da loja via OAuth para publicar, atualizar e acompanhar anúncios.",
        nextStepLabel: "Conectar via OAuth",
    },
    {
        providerKey: "webmotors",
        displayName: "Webmotors / Estoque e Leads",
        description: "Informe as credenciais da loja e valide o acesso da API Webmotors pelo painel interno.",
        nextStepLabel: "Configurar credenciais",
    },
];

function toDraft(record: IntegrationRecord): IntegrationDraft {
    return {
        displayName: record.displayName,
        status: record.status,
        endpointUrl: record.endpointUrl ?? "",
        accountName: record.accountName ?? "",
        username: record.username ?? "",
        apiToken: "",
        webhookSecret: "",
        lastError: record.lastError ?? "",
    };
}

function normalizeProviderKey(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "mercado-livre" || normalized === "meli") return "mercadolivre";
    if (normalized === "olx-autos") return "olx";
    if (normalized === "web-motors") return "webmotors";
    return normalized;
}

function defaultIntegrationLabel(providerKey: string) {
    const normalized = normalizeProviderKey(providerKey);
    if (normalized === "mercadolivre") return "Mercado Livre";
    if (normalized === "olx") return "OLX";
    if (normalized === "webmotors") return "Webmotors / Estoque e Leads";
    if (!normalized) return "Integração";
    return normalized.substring(0, 1).toUpperCase() + normalized.substring(1);
}

function buildFallbackIntegration(providerKey: string, displayName = defaultIntegrationLabel(providerKey)): IntegrationRecord {
    return {
        providerKey,
        displayName,
        status: "CONFIGURATION_REQUIRED",
        endpointUrl: null,
        accountName: null,
        username: null,
        hasApiToken: false,
        hasWebhookSecret: false,
        supportsPublication: true,
        lastSyncAt: null,
        lastError: null,
        settings: {},
    };
}

function mergeIntegrationCatalog(payload: IntegrationRecord[]) {
    const merged = new Map<string, IntegrationRecord>();

    for (const integration of SUPPORTED_INTEGRATIONS) {
        merged.set(normalizeProviderKey(integration.providerKey), buildFallbackIntegration(integration.providerKey, integration.displayName));
    }

    for (const record of payload) {
        const normalized = normalizeProviderKey(record.providerKey);
        const current = merged.get(normalized);
        merged.set(normalized, {
            ...(current ?? buildFallbackIntegration(record.providerKey, record.displayName)),
            ...record,
            providerKey: record.providerKey,
            displayName: record.displayName?.trim() ? record.displayName : current?.displayName ?? defaultIntegrationLabel(record.providerKey),
        });
    }

    return [...merged.values()].sort((left, right) => {
        const leftOrder = SUPPORTED_INTEGRATIONS.findIndex((item) => normalizeProviderKey(item.providerKey) === normalizeProviderKey(left.providerKey));
        const rightOrder = SUPPORTED_INTEGRATIONS.findIndex((item) => normalizeProviderKey(item.providerKey) === normalizeProviderKey(right.providerKey));

        if (leftOrder !== rightOrder) {
            if (leftOrder === -1) return 1;
            if (rightOrder === -1) return -1;
            return leftOrder - rightOrder;
        }

        return left.displayName.localeCompare(right.displayName, "pt-BR", { sensitivity: "base" });
    });
}

function readPlatformDetails(providerKey: string) {
    return (
        SUPPORTED_INTEGRATIONS.find((item) => normalizeProviderKey(item.providerKey) === normalizeProviderKey(providerKey)) ?? {
            providerKey,
            displayName: defaultIntegrationLabel(providerKey),
            description: "Configure os dados da integração e acompanhe o estado da conexão por aqui.",
            nextStepLabel: "Abrir configuração",
        }
    );
}

export function IntegrationCenter() {
    const searchParams = useSearchParams();
    const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
    const [drafts, setDrafts] = useState<Record<string, IntegrationDraft>>({});
    const [savingProvider, setSavingProvider] = useState<string | null>(null);
    const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
    const [deleteBlockedProvider, setDeleteBlockedProvider] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPlatformPicker, setShowPlatformPicker] = useState(false);
    const [openedProviderKeys, setOpenedProviderKeys] = useState<string[]>([]);
    const [pickerProviderKey, setPickerProviderKey] = useState<string>(normalizeProviderKey(SUPPORTED_INTEGRATIONS[0]?.providerKey ?? "mercadolivre"));
    const [connectionOverrides, setConnectionOverrides] = useState<Record<string, boolean>>({});

    useEffect(() => {
        void loadIntegrations();
    }, []);

    useEffect(() => {
        const provider = searchParams?.get("provider");
        const message = searchParams?.get("message");
        const status = searchParams?.get("status");
        if (provider) {
            const normalized = normalizeProviderKey(provider);
            setOpenedProviderKeys((current) => (current.includes(normalized) ? current : [...current, normalized]));
            setPickerProviderKey(normalized);
        }
        if (message) {
            if (status === "error") {
                setError(message);
            } else {
                setNotice(message);
            }
        }
    }, [searchParams]);

    const integrationMap = useMemo(() => {
        return new Map(integrations.map((integration) => [normalizeProviderKey(integration.providerKey), integration]));
    }, [integrations]);

    function isProviderConnected(providerKey: string) {
        const normalized = normalizeProviderKey(providerKey);
        if (normalized in connectionOverrides) {
            return connectionOverrides[normalized];
        }
        const integration = integrationMap.get(normalized);
        return integration?.status === "CONNECTED" || integration?.status === "ACTIVE";
    }

    const connectedCount = useMemo(() => {
        const providerKeys = new Set([
            ...SUPPORTED_INTEGRATIONS.map((item) => normalizeProviderKey(item.providerKey)),
            ...integrations.map((item) => normalizeProviderKey(item.providerKey)),
        ]);
        return [...providerKeys].filter((providerKey) => isProviderConnected(providerKey)).length;
    }, [integrations, connectionOverrides]);

    const visibleIntegrations = useMemo(() => {
        const orderedKeys = [
            ...SUPPORTED_INTEGRATIONS.map((item) => normalizeProviderKey(item.providerKey)),
            ...integrations
                .map((item) => normalizeProviderKey(item.providerKey))
                .filter((providerKey) => !SUPPORTED_INTEGRATIONS.some((item) => normalizeProviderKey(item.providerKey) === providerKey)),
        ];

        return orderedKeys
            .filter((providerKey, index, array) => array.indexOf(providerKey) === index)
            .filter((providerKey) => isProviderConnected(providerKey) || openedProviderKeys.includes(providerKey))
            .map((providerKey) => integrationMap.get(providerKey) ?? buildFallbackIntegration(providerKey, readPlatformDetails(providerKey).displayName));
    }, [integrations, openedProviderKeys, connectionOverrides]);

    async function loadIntegrations() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/ioauto/integrations", { cache: "no-store" });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao carregar as integrações." }));
                throw new Error(payload.message ?? "Falha ao carregar as integrações.");
            }
            const payload = (await response.json()) as IntegrationRecord[];
            const merged = mergeIntegrationCatalog(payload);
            setIntegrations(merged);
            setDrafts(Object.fromEntries(merged.map((integration) => [normalizeProviderKey(integration.providerKey), toDraft(integration)])));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar as integrações.");
        } finally {
            setLoading(false);
        }
    }

    function updateDraft(providerKey: string, partial: Partial<IntegrationDraft>) {
        const normalized = normalizeProviderKey(providerKey);
        const integration = integrations.find((item) => normalizeProviderKey(item.providerKey) === normalized) ?? buildFallbackIntegration(providerKey);
        setDrafts((current) => ({
            ...current,
            [normalized]: {
                ...(current[normalized] ?? toDraft(integration)),
                ...partial,
            },
        }));
    }

    function openProviderCard(providerKey: string) {
        const normalized = normalizeProviderKey(providerKey);
        setOpenedProviderKeys((current) => (current.includes(normalized) ? current : [...current, normalized]));
        setPickerProviderKey(normalized);
        setShowPlatformPicker(false);
    }

    function handleConnectionStateChange(providerKey: string, connected: boolean) {
        const normalized = normalizeProviderKey(providerKey);
        setConnectionOverrides((current) => ({
            ...current,
            [normalized]: connected,
        }));
        setOpenedProviderKeys((current) => (current.includes(normalized) ? current : [...current, normalized]));
        if (!connected) {
            setDeleteBlockedProvider((current) => (current === normalized ? null : current));
        }
    }

    async function handleSave(providerKey: string) {
        const normalized = normalizeProviderKey(providerKey);
        const draft = drafts[normalized];
        if (!draft) return;

        setSavingProvider(normalized);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/ioauto/integrations/${providerKey}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: draft.displayName,
                    status: draft.status,
                    endpointUrl: draft.endpointUrl,
                    accountName: draft.accountName,
                    username: draft.username,
                    apiToken: draft.apiToken,
                    webhookSecret: draft.webhookSecret,
                    lastError: draft.lastError,
                    settings: {},
                    markSyncedNow: draft.status === "CONNECTED" || draft.status === "ACTIVE",
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao atualizar a integração." }));
                throw new Error(payload.message ?? "Falha ao atualizar a integração.");
            }
            await loadIntegrations();
            setNotice("Integração atualizada com sucesso.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao atualizar a integração.");
        } finally {
            setSavingProvider(null);
        }
    }

    async function handleDelete(providerKey: string) {
        const normalized = normalizeProviderKey(providerKey);
        setError(null);
        setNotice(null);

        if (isProviderConnected(normalized)) {
            setDeleteBlockedProvider(normalized);
            return;
        }

        if (!window.confirm(`Excluir a integração ${defaultIntegrationLabel(normalized)} deste tenant?`)) {
            return;
        }

        setDeletingProvider(normalized);
        setDeleteBlockedProvider(null);
        try {
            const response = await fetch(`/api/ioauto/integrations/${encodeURIComponent(normalized)}`, {
                method: "DELETE",
            });
            const payload = await response.json().catch(() => null) as { code?: string; message?: string } | null;
            if (!response.ok) {
                if (payload?.code === "IOAUTO_INTEGRATION_CONNECTED") {
                    setDeleteBlockedProvider(normalized);
                    return;
                }
                throw new Error(payload?.message ?? "Falha ao excluir a integração.");
            }

            setOpenedProviderKeys((current) => current.filter((item) => item !== normalized));
            setConnectionOverrides((current) => Object.fromEntries(
                Object.entries(current).filter(([provider]) => provider !== normalized),
            ));
            await loadIntegrations();
            setNotice(`Integração ${defaultIntegrationLabel(normalized)} excluída com sucesso.`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao excluir a integração.");
        } finally {
            setDeletingProvider(null);
        }
    }

    const supportedOptions = SUPPORTED_INTEGRATIONS.map((platform) => {
        const normalized = normalizeProviderKey(platform.providerKey);
        return {
            ...platform,
            normalizedProviderKey: normalized,
            alreadyVisible: visibleIntegrations.some((integration) => normalizeProviderKey(integration.providerKey) === normalized),
        };
    });

    return (
        <div className="grid gap-6">
            <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-8">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-io-purple animate-pulse" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/35">Ecossistema de conexões</p>
                </div>
                <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="font-display text-2xl font-bold text-io-dark">Integrações conectadas</h2>
                        <p className="mt-2 text-sm text-black/56">
                            {connectedCount} integrações conectadas no momento. Use o seletor para abrir uma plataforma e concluir a conexão quando precisar.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowPlatformPicker((current) => !current)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-io-dark px-6 text-sm font-bold text-white transition hover:bg-black/85"
                    >
                        <Plus className="h-4 w-4" />
                        Conectar integração
                    </button>
                </div>

                {showPlatformPicker ? (
                    <div className="mt-6 rounded-[28px] border border-black/8 bg-[#fafafa] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <label className="grid gap-2 lg:flex-1">
                                <span className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-black/32">Plataforma</span>
                                <select
                                    value={pickerProviderKey}
                                    onChange={(event) => setPickerProviderKey(normalizeProviderKey(event.target.value))}
                                    className="h-12 rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-io-dark outline-none transition focus:border-black/20"
                                >
                                    {supportedOptions.map((platform) => (
                                        <option key={platform.providerKey} value={platform.providerKey}>
                                            {platform.displayName}
                                            {platform.alreadyVisible ? " - card já exibido" : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                type="button"
                                onClick={() => openProviderCard(pickerProviderKey)}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-io-dark px-6 text-sm font-bold text-white transition hover:bg-black/85"
                            >
                                <Plus className="h-4 w-4" />
                                Abrir card
                            </button>
                        </div>
                    </div>
                ) : null}

                {error ? <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                {notice ? <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

                {loading ? (
                    <div className="mt-6 flex min-h-[200px] items-center justify-center rounded-[30px] border border-black/8 bg-[#fafafa]">
                        <LoaderCircle className="h-6 w-6 animate-spin text-io-purple" />
                    </div>
                ) : visibleIntegrations.length ? (
                    <div className="mt-6 grid gap-6">
                        {visibleIntegrations.map((integration) => {
                            const normalized = normalizeProviderKey(integration.providerKey);
                            const connected = isProviderConnected(normalized);
                            return (
                                <div key={normalized} className="grid gap-3">
                                    {renderIntegrationPanel({
                                        integration,
                                        draft: drafts[normalized] ?? toDraft(integration),
                                        saving: savingProvider === normalized,
                                        connected,
                                        onDraftChange: (partial) => updateDraft(integration.providerKey, partial),
                                        onSave: () => void handleSave(integration.providerKey),
                                        onRefreshParent: () => void loadIntegrations(),
                                        onConnectionStateChange: (nextConnected) => handleConnectionStateChange(integration.providerKey, nextConnected),
                                    })}

                                    <section className="flex flex-col gap-4 rounded-[24px] border border-red-100 bg-red-50/55 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-red-800">Excluir integração</p>
                                            <p className="mt-1 text-xs leading-5 text-red-700/75">
                                                Remove as configurações salvas deste tenant. A integração precisa estar desconectada.
                                            </p>
                                            {deleteBlockedProvider === normalized ? (
                                                <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                                    Esta integração está conectada. Desconecte-a antes de excluir.
                                                </p>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(integration.providerKey)}
                                            disabled={deletingProvider != null}
                                            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {deletingProvider === normalized ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            Excluir integração
                                        </button>
                                    </section>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-6 flex min-h-[280px] flex-col items-center justify-center rounded-[30px] border-2 border-dashed border-black/6 bg-black/[0.02] px-6 text-center">
                        <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm text-black/20">
                            <Cable className="h-8 w-8" />
                        </div>
                        <h3 className="mt-6 font-display text-2xl font-bold text-io-dark">Nenhuma integração em exibição</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-black/56">
                            Abra uma plataforma pelo seletor acima para conectar uma nova integração. As contas conectadas ficam visíveis automaticamente neste painel.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}

function renderIntegrationPanel({
    integration,
    draft,
    saving,
    connected,
    onDraftChange,
    onSave,
    onRefreshParent,
    onConnectionStateChange,
}: {
    integration: IntegrationRecord;
    draft: IntegrationDraft;
    saving: boolean;
    connected: boolean;
    onDraftChange: (partial: Partial<IntegrationDraft>) => void;
    onSave: () => void;
    onRefreshParent: () => void;
    onConnectionStateChange: (connected: boolean) => void;
}) {
    const normalizedProviderKey = normalizeProviderKey(integration.providerKey);
    if (normalizedProviderKey === "webmotors") {
        return (
            <WebmotorsSetupCard
                connected={connected}
                onConnectionStateChange={onConnectionStateChange}
                onRefreshParent={onRefreshParent}
            />
        );
    }
    if (normalizedProviderKey === "mercadolivre") {
        return <MercadoLivreSetupCard key={integration.providerKey} onConnectionStateChange={onConnectionStateChange} onRefreshParent={onRefreshParent} />;
    }
    if (normalizedProviderKey === "olx") {
        return <OlxSetupCard key={integration.providerKey} onConnectionStateChange={onConnectionStateChange} onRefreshParent={onRefreshParent} />;
    }

    const platformDetails = readPlatformDetails(integration.providerKey);

    return (
        <article key={integration.providerKey} className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_22px_55px_rgba(0,0,0,0.07)] md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="inline-flex items-center rounded-full border border-io-purple/10 bg-io-purple/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                        {integration.providerKey}
                    </p>
                    <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">{integration.displayName}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-black/56">{platformDetails.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${integration.status === "ACTIVE" || integration.status === "CONNECTED" ? "bg-green-500" : "bg-black/20"}`} />
                        <p className="text-sm font-medium text-black/56">{statusLabel(integration.status)}</p>
                    </div>
                </div>
                <span className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-black/45">
                    última sincronização: {formatDateTime(integration.lastSyncAt)}
                </span>
            </div>

            <div className="mt-10 border-t border-black/5 pt-10">
                <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Nome exibido na plataforma" value={draft.displayName} onChange={(value) => onDraftChange({ displayName: value })} />
                    <SelectField
                        label="Status da Integração"
                        value={draft.status}
                        onChange={(value) => onDraftChange({ status: value })}
                        options={[
                            { value: "CONFIGURATION_REQUIRED", label: "Configurar" },
                            { value: "CONNECTED", label: "Conectado" },
                            { value: "ACTIVE", label: "Ativo" },
                            { value: "ERROR", label: "Com erro" },
                        ]}
                    />
                    <Field label="URL do Endpoint / API" value={draft.endpointUrl} onChange={(value) => onDraftChange({ endpointUrl: value })} className="md:col-span-2" />
                    <Field label="ID da Conta ou Dealer" value={draft.accountName} onChange={(value) => onDraftChange({ accountName: value })} />
                    <Field label="Usuário de acesso" value={draft.username} onChange={(value) => onDraftChange({ username: value })} />
                    <Field
                        label={integration.hasApiToken ? "Atualizar Token API (opcional)" : "Token API / Chave de Acesso"}
                        value={draft.apiToken}
                        onChange={(value) => onDraftChange({ apiToken: value })}
                    />
                    <Field
                        label={integration.hasWebhookSecret ? "Atualizar Webhook Secret (opcional)" : "Webhook Secret"}
                        value={draft.webhookSecret}
                        onChange={(value) => onDraftChange({ webhookSecret: value })}
                    />
                    <Field label="Histórico de erros" value={draft.lastError} onChange={(value) => onDraftChange({ lastError: value })} className="md:col-span-2" />
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-6 rounded-[28px] bg-black/5 p-6 md:flex-row">
                    <p className="max-w-md text-sm leading-6 text-black/56">
                        {integration.supportsPublication
                            ? "Esta integração permite publicar e atualizar veículos na plataforma selecionada."
                            : "Esta integração é usada apenas para sincronizar dados auxiliares do ecossistema."}
                    </p>

                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="inline-flex h-14 items-center gap-2 rounded-full bg-io-dark px-8 text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/10"
                    >
                        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Salvar alterações
                    </button>
                </div>
            </div>
        </article>
    );
}

function Field({
    label,
    value,
    onChange,
    className = "",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    return (
        <label className={`grid gap-2 ${className}`}>
            <span className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-black/32">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-14 rounded-full border border-black/10 bg-black/5 px-5 text-sm font-medium text-io-dark outline-none transition focus:border-black/20 focus:bg-white"
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <label className="grid gap-2">
            <span className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-black/32">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-14 rounded-full border border-black/10 bg-black/5 px-5 text-sm font-medium text-io-dark outline-none transition focus:border-black/20 focus:bg-white"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
