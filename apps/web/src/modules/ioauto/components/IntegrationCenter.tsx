"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Cable, LoaderCircle, Plus, Save } from "lucide-react";
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
        description: "Conecte a conta da loja via OAuth para publicar, pausar, finalizar e sincronizar anuncios da MLB.",
        nextStepLabel: "Conectar via OAuth",
    },
    {
        providerKey: "olx",
        displayName: "OLX",
        description: "Conecte a conta da loja via OAuth para publicar, atualizar e acompanhar anuncios.",
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
    return normalized === "olx-autos" ? "olx" : normalized;
}

function defaultIntegrationLabel(providerKey: string) {
    const normalized = normalizeProviderKey(providerKey);
    if (normalized === "mercadolivre") return "Mercado Livre";
    if (normalized === "olx") return "OLX";
    if (normalized === "webmotors") return "Webmotors / Estoque e Leads";
    if (!normalized) return "Integracao";
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
            description: "Configure os dados da integracao e acompanhe o estado da conexao por aqui.",
            nextStepLabel: "Abrir configuracao",
        }
    );
}

export function IntegrationCenter() {
    const searchParams = useSearchParams();
    const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(null);
    const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
    const [drafts, setDrafts] = useState<Record<string, IntegrationDraft>>({});
    const [savingProvider, setSavingProvider] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPlatformPicker, setShowPlatformPicker] = useState(false);

    useEffect(() => {
        void loadIntegrations();
    }, []);

    useEffect(() => {
        const provider = searchParams?.get("provider");
        const message = searchParams?.get("message");
        const status = searchParams?.get("status");
        if (provider) {
            setSelectedProviderKey(normalizeProviderKey(provider));
        }
        if (message) {
            if (status === "error") {
                setError(message);
            } else {
                setNotice(message);
            }
        }
    }, [searchParams]);

    const connectedCount = useMemo(
        () => integrations.filter((integration) => integration.status === "CONNECTED" || integration.status === "ACTIVE").length,
        [integrations]
    );

    const selectedIntegration = useMemo(() => {
        if (!selectedProviderKey) return null;
        return integrations.find((integration) => normalizeProviderKey(integration.providerKey) === selectedProviderKey) ?? null;
    }, [integrations, selectedProviderKey]);

    async function loadIntegrations() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/ioauto/integrations", { cache: "no-store" });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao carregar as integracoes." }));
                throw new Error(payload.message ?? "Falha ao carregar as integracoes.");
            }
            const payload = (await response.json()) as IntegrationRecord[];
            const merged = mergeIntegrationCatalog(payload);
            setIntegrations(merged);
            setDrafts(Object.fromEntries(merged.map((integration) => [normalizeProviderKey(integration.providerKey), toDraft(integration)])));
            setSelectedProviderKey((current) => {
                if (!current) return null;
                return merged.some((integration) => normalizeProviderKey(integration.providerKey) === current) ? current : null;
            });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar as integracoes.");
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

    function selectProvider(providerKey: string) {
        setSelectedProviderKey(normalizeProviderKey(providerKey));
        setShowPlatformPicker(false);
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
                const payload = await response.json().catch(() => ({ message: "Falha ao atualizar a integracao." }));
                throw new Error(payload.message ?? "Falha ao atualizar a integracao.");
            }
            await loadIntegrations();
            setNotice("Integracao atualizada com sucesso.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao atualizar a integracao.");
        } finally {
            setSavingProvider(null);
        }
    }

    return (
        <div className="grid gap-6">
            <header>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Modulo Integracoes</p>
                <h1 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-io-dark">Integracoes</h1>
                <p className="mt-1.5 text-sm text-black/55">Conecte marketplaces, acompanhe status da conta e gerencie a distribuicao do estoque em um unico lugar.</p>
            </header>

            <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-8">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-io-purple animate-pulse" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/35">Ecossistema de conexoes</p>
                </div>
                <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="font-display text-2xl font-bold text-io-dark">Plataformas disponiveis</h2>
                        <p className="mt-2 text-sm text-black/56">{connectedCount} integracoes ativas no momento.</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowPlatformPicker((current) => !current)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-io-dark px-6 text-sm font-bold text-white transition hover:bg-black/85"
                    >
                        <Plus className="h-4 w-4" />
                        Conectar integracao
                    </button>
                </div>

                {showPlatformPicker ? (
                    <div className="mt-6 grid gap-3 xl:grid-cols-2">
                        {SUPPORTED_INTEGRATIONS.map((platform) => {
                            const integration =
                                integrations.find((item) => normalizeProviderKey(item.providerKey) === normalizeProviderKey(platform.providerKey)) ??
                                buildFallbackIntegration(platform.providerKey, platform.displayName);
                            const normalized = normalizeProviderKey(integration.providerKey);
                            const isSelected = selectedProviderKey === normalized;
                            const isConnected = integration.status === "CONNECTED" || integration.status === "ACTIVE";

                            return (
                                <button
                                    key={platform.providerKey}
                                    type="button"
                                    onClick={() => selectProvider(integration.providerKey)}
                                    className={`flex flex-col gap-4 rounded-[28px] border p-5 text-left transition-all md:flex-row md:items-center md:justify-between ${
                                        isSelected
                                            ? "border-io-purple bg-io-purple/5 shadow-[0_14px_35px_rgba(93,63,211,0.12)]"
                                            : "border-black/10 bg-[#fafafa] hover:border-black/18 hover:bg-white"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-io-purple" : isConnected ? "bg-emerald-500" : "bg-black/20"}`} />
                                            <p className="text-base font-bold text-io-dark">{integration.displayName}</p>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-black/56">{platform.description}</p>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 md:justify-end">
                                        <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-black/48">
                                            {isConnected ? "Conta conectada" : platform.nextStepLabel}
                                        </span>
                                        <ArrowRight className="h-4 w-4 text-black/38" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    {integrations.map((integration) => {
                        const normalized = normalizeProviderKey(integration.providerKey);
                        const isSelected = selectedProviderKey === normalized;
                        return (
                            <button
                                key={integration.providerKey}
                                type="button"
                                onClick={() => selectProvider(integration.providerKey)}
                                className={`inline-flex h-12 items-center gap-3 rounded-full border px-5 text-sm font-bold transition-all ${
                                    isSelected
                                        ? "border-io-purple bg-io-purple/5 text-io-purple"
                                        : "border-black/10 bg-white text-black/45 hover:border-black/20 hover:text-io-dark"
                                }`}
                            >
                                <div className={`h-2 w-2 rounded-full ${isSelected ? "bg-io-purple" : "bg-black/20"}`} />
                                {integration.displayName}
                            </button>
                        );
                    })}
                </div>

                {error ? <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                {notice ? <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
            </section>

            {loading ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-[34px] border border-black/10 bg-white shadow-sm">
                    <LoaderCircle className="h-6 w-6 animate-spin text-io-purple" />
                </div>
            ) : selectedIntegration ? (
                <div className="grid gap-8">
                    {renderIntegrationPanel({
                        integration: selectedIntegration,
                        draft: drafts[normalizeProviderKey(selectedIntegration.providerKey)] ?? toDraft(selectedIntegration),
                        saving: savingProvider === normalizeProviderKey(selectedIntegration.providerKey),
                        onDraftChange: (partial) => updateDraft(selectedIntegration.providerKey, partial),
                        onSave: () => void handleSave(selectedIntegration.providerKey),
                    })}
                </div>
            ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[34px] border-2 border-dashed border-black/5 bg-black/[0.02] px-6 text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm text-black/20">
                        <Cable className="h-8 w-8" />
                    </div>
                    <h3 className="mt-6 font-display text-2xl font-bold text-io-dark">Escolha uma plataforma para conectar</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-black/56">
                        Use o botao acima para escolher a integracao. Ao selecionar a plataforma, a tela mostra o login ou a configuracao correspondente.
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowPlatformPicker(true)}
                        className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-io-dark px-6 text-sm font-bold text-white transition hover:bg-black/85"
                    >
                        <Plus className="h-4 w-4" />
                        Escolher integracao
                    </button>
                </div>
            )}
        </div>
    );
}

function renderIntegrationPanel({
    integration,
    draft,
    saving,
    onDraftChange,
    onSave,
}: {
    integration: IntegrationRecord;
    draft: IntegrationDraft;
    saving: boolean;
    onDraftChange: (partial: Partial<IntegrationDraft>) => void;
    onSave: () => void;
}) {
    const normalizedProviderKey = normalizeProviderKey(integration.providerKey);
    if (normalizedProviderKey === "webmotors") {
        return <WebmotorsSetupCard key={integration.providerKey} />;
    }
    if (normalizedProviderKey === "mercadolivre") {
        return <MercadoLivreSetupCard key={integration.providerKey} />;
    }
    if (normalizedProviderKey === "olx") {
        return <OlxSetupCard key={integration.providerKey} />;
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
                    Ultima sincronizacao: {formatDateTime(integration.lastSyncAt)}
                </span>
            </div>

            <div className="mt-10 border-t border-black/5 pt-10">
                <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Nome exibido na plataforma" value={draft.displayName} onChange={(value) => onDraftChange({ displayName: value })} />
                    <SelectField
                        label="Status da Integracao"
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
                    <Field label="Usuario de acesso" value={draft.username} onChange={(value) => onDraftChange({ username: value })} />
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
                    <Field label="Historico de erros" value={draft.lastError} onChange={(value) => onDraftChange({ lastError: value })} className="md:col-span-2" />
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-6 rounded-[28px] bg-black/5 p-6 md:flex-row">
                    <p className="max-w-md text-sm leading-6 text-black/56">
                        {integration.supportsPublication
                            ? "Esta integracao permite publicar e atualizar veiculos na plataforma selecionada."
                            : "Esta integracao e usada apenas para sincronizar dados auxiliares do ecossistema."}
                    </p>

                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="inline-flex h-14 items-center gap-2 rounded-full bg-io-dark px-8 text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/10"
                    >
                        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Salvar alteracoes
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
