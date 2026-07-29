"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, Save, Unplug } from "lucide-react";
import type { WebmotorsSettingsRecord, WebmotorsValidationResult } from "@/modules/ioauto/types";

type LoadState = "idle" | "loading" | "ready";

type Props = {
    connected?: boolean;
    onConnectionStateChange?: (connected: boolean) => void;
    onRefreshParent?: () => void;
};

const DEFAULT_SETTINGS: WebmotorsSettingsRecord = {
    id: "",
    companyId: "",
    storeKey: "default",
    storeName: "Loja principal",
    featureFlags: {
        soapAdsEnabled: false,
        restLeadsEnabled: true,
        catalogSyncEnabled: false,
        leadPullEnabled: true,
        callbackEnabled: false,
    },
    soapBaseUrl: "",
    soapAuthPath: "",
    soapInventoryPath: "",
    soapCatalogPath: "",
    soapCnpj: "",
    soapEmail: "",
    soapPassword: "",
    restTokenUrl: "",
    restApiBaseUrl: "",
    restUsername: "",
    restPassword: "",
    restClientId: "",
    restClientSecret: "",
    callbackSecret: "",
};

export function WebmotorsSetupCard({ connected = false, onConnectionStateChange, onRefreshParent }: Props) {
    const [draft, setDraft] = useState<WebmotorsSettingsRecord>(DEFAULT_SETTINGS);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [validation, setValidation] = useState<WebmotorsValidationResult | null>(null);

    useEffect(() => {
        loadSettings().catch((cause: Error) => {
            setError(cause.message);
            setLoadState("idle");
        });
    }, []);

    async function loadSettings() {
        setLoadState("loading");
        setError(null);
        const response = await fetch("/api/ioauto/webmotors/settings?storeKey=default", { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(readMessage(payload, "Falha ao carregar as configuracoes da Webmotors."));
        }

        setDraft(normalizeSettings(payload));
        setLoadState("ready");
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(null);
        setValidation(null);

        const response = await fetch("/api/ioauto/webmotors/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            setError(readMessage(payload, "Falha ao salvar as configuracoes da Webmotors."));
            setSaving(false);
            return;
        }

        setDraft(normalizeSettings(payload));
        setSuccess("Configuracoes salvas. O sistema ja monta o Basic auth, faz o login e usa o access_token automaticamente.");
        setSaving(false);
        onRefreshParent?.();
    }

    async function handleValidate() {
        setValidating(true);
        setError(null);
        setSuccess(null);

        const saveResponse = await fetch("/api/ioauto/webmotors/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
        });
        const savePayload = await saveResponse.json().catch(() => null);

        if (!saveResponse.ok) {
            setError(readMessage(savePayload, "Nao foi possivel salvar as configuracoes antes da validacao."));
            setValidating(false);
            return;
        }

        setDraft(normalizeSettings(savePayload));

        const response = await fetch(`/api/ioauto/webmotors/settings/validate?storeKey=${encodeURIComponent(draft.storeKey || "default")}`, {
            method: "POST",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            setError(readMessage(payload, "Falha ao validar as credenciais da Webmotors."));
            setValidation(null);
            setValidating(false);
            return;
        }

        setValidation(payload as WebmotorsValidationResult);
        setSuccess(readMessage(payload, "Credenciais validadas com sucesso."));
        setValidating(false);
        onConnectionStateChange?.(true);
        onRefreshParent?.();
    }

    async function handleDisconnect() {
        setDisconnecting(true);
        setError(null);
        setSuccess(null);

        const response = await fetch("/api/ioauto/webmotors/settings/disconnect", {
            method: "POST",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            setError(readMessage(payload, "Falha ao desconectar a Webmotors."));
            setDisconnecting(false);
            return;
        }

        setDraft(DEFAULT_SETTINGS);
        setValidation(null);
        setSuccess("Integracao Webmotors desconectada. Agora ela pode ser excluida.");
        setDisconnecting(false);
        onConnectionStateChange?.(false);
        onRefreshParent?.();
    }

    return (
        <section className="rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.28em] text-black/40">WebMotors REST</p>
                    <h1 className="mt-2 font-display text-3xl font-bold text-io-dark">Autenticacao da API WebMotors</h1>
                    <p className="mt-2 text-sm text-black/55">
                        Preencha as credenciais do painel da WebMotors. O sistema cuida dos passos tecnicos: gera
                        <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">Authorization: Basic base64(clientId:clientSecret)</code>,
                        faz o <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">POST /login</code> com usuario e senha,
                        recebe o <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">access_token</code>
                        e consulta o <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">GET /estoque</code> com
                        <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">client_id</code> e
                        <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">access_token</code>.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white">
                    <KeyRound className="h-4 w-4" />
                    Loja {draft.storeKey || "default"}
                </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-[28px] bg-[#f7f7f7] p-4 text-sm text-black/65">
                <p>1. Client ID + Client Secret entram no header Basic do login.</p>
                <p>2. Usuario + senha da integracao vao no POST /login.</p>
                <p>3. O estoque vem do GET /estoque com client_id e access_token.</p>
            </div>

            {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {success ? <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}
            {validation ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Token validado com status {validation.statusCode}.</span>
                    <span>Expira em aproximadamente {validation.expiresInSeconds}s.</span>
                </div>
            ) : null}

            {loadState === "loading" ? (
                <div className="mt-8 flex items-center gap-3 text-sm text-black/55">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Carregando configuracoes da WebMotors...
                </div>
            ) : (
                <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <Field label="Nome da loja" value={draft.storeName} onChange={(value) => setDraft((current) => ({ ...current, storeName: value }))} />
                        <Field label="Store key" value={draft.storeKey} onChange={(value) => setDraft((current) => ({ ...current, storeKey: value }))} />
                        <ToggleField
                            label="Leads REST ativos"
                            checked={draft.featureFlags.restLeadsEnabled}
                            onChange={(checked) => setDraft((current) => ({
                                ...current,
                                featureFlags: { ...current.featureFlags, restLeadsEnabled: checked },
                            }))}
                        />
                        <Field label="Login URL" value={draft.restTokenUrl} onChange={(value) => setDraft((current) => ({ ...current, restTokenUrl: value }))} className="xl:col-span-2" />
                        <Field label="Site API base URL" value={draft.restApiBaseUrl} onChange={(value) => setDraft((current) => ({ ...current, restApiBaseUrl: value }))} className="xl:col-span-2" />
                        <Field label="Client ID" value={draft.restClientId} onChange={(value) => setDraft((current) => ({ ...current, restClientId: value }))} />
                        <Field label="Client Secret" value={draft.restClientSecret} onChange={(value) => setDraft((current) => ({ ...current, restClientSecret: value }))} type="password" />
                        <Field label="Usuario da API" value={draft.restUsername} onChange={(value) => setDraft((current) => ({ ...current, restUsername: value }))} />
                        <Field label="Senha da API" value={draft.restPassword} onChange={(value) => setDraft((current) => ({ ...current, restPassword: value }))} type="password" />
                        <ToggleField
                            label="Pull de leads ativo"
                            checked={draft.featureFlags.leadPullEnabled}
                            onChange={(checked) => setDraft((current) => ({
                                ...current,
                                featureFlags: { ...current.featureFlags, leadPullEnabled: checked },
                            }))}
                        />
                        <ToggleField
                            label="Callback ativo"
                            checked={draft.featureFlags.callbackEnabled}
                            onChange={(checked) => setDraft((current) => ({
                                ...current,
                                featureFlags: { ...current.featureFlags, callbackEnabled: checked },
                            }))}
                        />
                        <Field label="Segredo do callback" value={draft.callbackSecret} onChange={(value) => setDraft((current) => ({ ...current, callbackSecret: value }))} />
                    </div>

                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        {connected ? (
                            <button
                                type="button"
                                onClick={() => void handleDisconnect()}
                                disabled={saving || validating || disconnecting}
                                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {disconnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                                Desconectar
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => handleValidate()}
                            disabled={saving || validating || disconnecting}
                            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-io-dark transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {validating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Salvar e validar token
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave()}
                            disabled={saving || validating || disconnecting}
                            className="inline-flex items-center gap-2 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20"
                        >
                            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar configuracoes
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}

function normalizeSettings(payload: unknown): WebmotorsSettingsRecord {
    if (!payload || typeof payload !== "object") {
        return DEFAULT_SETTINGS;
    }

    const raw = payload as Partial<WebmotorsSettingsRecord> & { featureFlags?: Partial<WebmotorsSettingsRecord["featureFlags"]> };
    return {
        ...DEFAULT_SETTINGS,
        ...raw,
        storeKey: typeof raw.storeKey === "string" && raw.storeKey.trim() ? raw.storeKey : "default",
        storeName: typeof raw.storeName === "string" && raw.storeName.trim() ? raw.storeName : "Loja principal",
        featureFlags: {
            ...DEFAULT_SETTINGS.featureFlags,
            ...raw.featureFlags,
        },
    };
}

function readMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === "object" && "message" in payload) {
        const value = (payload as { message?: unknown }).message;
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return fallback;
}

function Field({
    label,
    value,
    onChange,
    className = "",
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    type?: "text" | "password";
}) {
    return (
        <label className={`grid gap-2 ${className}`}>
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function ToggleField({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex h-12 items-center justify-between rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark">
            <span className="font-medium text-black/60">{label}</span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-black/20" />
        </label>
    );
}
