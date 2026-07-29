"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loadOpenAiModelCatalogFromApi, type OpenAiModelCatalog } from "@/modules/ai-agents/storage";
import { getEmptySupervisorPayload, getFriendlyHttpErrorMessage, getSupervisor, SUPERVISOR_PROVIDER_OPTIONS, type AiSupervisor, type AiSupervisorUpsertPayload, createSupervisor, updateSupervisor } from "@/services/aiSupervisors";
import { AI_AGENT_PROFILE_PRESETS, AI_COMMUNICATION_STYLE_PRESETS } from "@/modules/ai/shared/presets";
import { EmptyState, ErrorState, FieldError, FieldLabel, InlineToggle, LoadingState, PageShell, SectionCard, SupervisorBreadcrumbs, ToastStack, type ToastMessage } from "./SupervisorUi";

const BASE_ROUTE = "/protected/ai/supervisores";

const COMMUNICATION_STYLE_OPTIONS = [...AI_COMMUNICATION_STYLE_PRESETS];
const PROFILE_OPTIONS = [...AI_AGENT_PROFILE_PRESETS];
const MODEL_VERSION_PRESET_OPTIONS = ["v0.5", "v0.6", "v0.7"];
const DEFAULT_TEAM_OPTIONS = ["Geral", "Comercial", "Suporte", "Financeiro"];
type TransferUser = { id: string; fullName: string; email: string };

function isKnownCommunicationStyle(value?: string | null) {
    return COMMUNICATION_STYLE_OPTIONS.some((item) => item.value === (value ?? "").trim());
}

function isKnownProfile(value?: string | null) {
    return PROFILE_OPTIONS.some((item) => item.toLowerCase() === (value ?? "").trim().toLowerCase());
}

function normalizeLegacyTeamSelection(value?: string | null) {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    if (DEFAULT_TEAM_OPTIONS.some((item) => item.toLowerCase() === normalized.toLowerCase())) return "";
    return normalized;
}

const supervisorSchema = z.object({
    name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(80, "Use no máximo 80 caracteres."),
    communicationStyle: z.string().trim().min(1, "Selecione a forma de comunicação.").max(2000, "Use no máximo 2000 caracteres."),
    profile: z.string().trim().min(1, "Selecione o perfil do supervisor.").max(2000, "Use no máximo 2000 caracteres."),
    objective: z.string().max(2000, "Use no máximo 2000 caracteres."),
    provider: z.string().trim().min(1, "Selecione um provedor."),
    model: z.string().trim().min(1, "Informe o modelo.").max(120, "Use no máximo 120 caracteres."),
    reasoningModelVersion: z.string().trim().min(1, "Informe a versão do modelo de raciocínio.").max(80, "Use no máximo 80 caracteres."),
    notifyContactOnAgentTransfer: z.boolean(),
    humanHandoffEnabled: z.boolean(),
    humanHandoffTeam: z.string().trim().max(120, "Use no máximo 120 caracteres."),
    humanHandoffSendMessage: z.boolean(),
    humanHandoffMessage: z.string().max(500, "Use no máximo 500 caracteres."),
    agentIssueHandoffTeam: z.string().trim().max(120, "Use no máximo 120 caracteres."),
    agentIssueSendMessage: z.boolean(),
    enabled: z.boolean(),
    defaultForCompany: z.boolean(),
}).superRefine((value, ctx) => {
    if (value.humanHandoffEnabled && value.humanHandoffTeam.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione o usuário para solicitações de atendimento humano.",
            path: ["humanHandoffTeam"],
        });
    }
    if (value.humanHandoffEnabled && value.humanHandoffSendMessage && value.humanHandoffMessage.trim().length < 5) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe a mensagem de transferência com pelo menos 5 caracteres.",
            path: ["humanHandoffMessage"],
        });
    }
    if (value.agentIssueHandoffTeam.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione o usuário para casos de problemas com o agente.",
            path: ["agentIssueHandoffTeam"],
        });
    }
});

type SupervisorFormValues = z.infer<typeof supervisorSchema>;
type SupervisorFormTab = "profile" | "model" | "human" | "status";

const TABS: Array<{ id: SupervisorFormTab; label: string }> = [
    { id: "profile", label: "Perfil do Supervisor" },
    { id: "model", label: "Modelo" },
    { id: "human", label: "Transferência humana" },
    { id: "status", label: "Status" },
];

function toFormValues(supervisor?: AiSupervisor | null): SupervisorFormValues {
    const fallback = getEmptySupervisorPayload();
    return {
        name: supervisor?.name ?? fallback.name,
        communicationStyle: isKnownCommunicationStyle(supervisor?.communicationStyle) ? supervisor?.communicationStyle ?? "" : fallback.communicationStyle,
        profile: isKnownProfile(supervisor?.profile) ? supervisor?.profile ?? "" : fallback.profile,
        objective: supervisor?.objective ?? fallback.objective,
        provider: supervisor?.provider ?? fallback.provider,
        model: supervisor?.model ?? fallback.model,
        reasoningModelVersion: supervisor?.reasoningModelVersion ?? fallback.reasoningModelVersion,
        notifyContactOnAgentTransfer: supervisor?.notifyContactOnAgentTransfer ?? fallback.notifyContactOnAgentTransfer,
        humanHandoffEnabled: supervisor?.humanHandoffEnabled ?? fallback.humanHandoffEnabled,
        humanHandoffTeam: normalizeLegacyTeamSelection(supervisor?.humanHandoffTeam ?? fallback.humanHandoffTeam),
        humanHandoffSendMessage: supervisor?.humanHandoffSendMessage ?? fallback.humanHandoffSendMessage,
        humanHandoffMessage: supervisor?.humanHandoffMessage ?? fallback.humanHandoffMessage,
        agentIssueHandoffTeam: normalizeLegacyTeamSelection(supervisor?.agentIssueHandoffTeam ?? fallback.agentIssueHandoffTeam),
        agentIssueSendMessage: supervisor?.agentIssueSendMessage ?? fallback.agentIssueSendMessage,
        enabled: supervisor?.enabled ?? fallback.enabled,
        defaultForCompany: supervisor?.defaultForCompany ?? fallback.defaultForCompany,
    };
}

function toPayload(values: SupervisorFormValues): AiSupervisorUpsertPayload {
    const humanHandoffTeam = values.humanHandoffTeam.trim();
    const agentIssueHandoffTeam = values.agentIssueHandoffTeam.trim() || humanHandoffTeam;
    const humanChoiceOptions = Array.from(new Set([humanHandoffTeam, agentIssueHandoffTeam].filter(Boolean)));

    return {
        name: values.name.trim(),
        communicationStyle: values.communicationStyle.trim(),
        profile: values.profile.trim(),
        objective: values.objective.trim(),
        provider: values.provider.trim(),
        model: values.model.trim(),
        reasoningModelVersion: values.reasoningModelVersion.trim(),
        humanHandoffEnabled: values.humanHandoffEnabled,
        notifyContactOnAgentTransfer: values.notifyContactOnAgentTransfer,
        humanHandoffTeam,
        humanHandoffSendMessage: values.humanHandoffEnabled && values.humanHandoffSendMessage,
        humanHandoffMessage: values.humanHandoffMessage.trim(),
        agentIssueHandoffTeam,
        agentIssueSendMessage: values.agentIssueSendMessage,
        humanUserChoiceEnabled: false,
        humanChoiceOptions,
        enabled: values.enabled,
        defaultForCompany: values.defaultForCompany,
    };
}

function getToastId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

export function SupervisorForm({ supervisorId }: { supervisorId?: string }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<SupervisorFormTab>("profile");
    const [loading, setLoading] = useState(Boolean(supervisorId));
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentSupervisor, setCurrentSupervisor] = useState<AiSupervisor | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [openAiCatalog, setOpenAiCatalog] = useState<OpenAiModelCatalog>({ modelVersions: [], reasoningModels: [] });
    const [openAiCatalogLoading, setOpenAiCatalogLoading] = useState(false);
    const [openAiCatalogLoaded, setOpenAiCatalogLoaded] = useState(false);
    const [transferUsers, setTransferUsers] = useState<TransferUser[]>([]);
    const [transferUsersLoading, setTransferUsersLoading] = useState(false);
    const [transferUsersLoaded, setTransferUsersLoaded] = useState(false);

    const form = useForm<SupervisorFormValues>({
        resolver: zodResolver(supervisorSchema),
        mode: "onChange",
        defaultValues: toFormValues(),
    });

    const notifyContactOnAgentTransfer = form.watch("notifyContactOnAgentTransfer");
    const humanHandoffEnabled = form.watch("humanHandoffEnabled");
    const humanHandoffTeam = form.watch("humanHandoffTeam");
    const humanHandoffSendMessage = form.watch("humanHandoffSendMessage");
    const humanHandoffMessage = form.watch("humanHandoffMessage");
    const agentIssueHandoffTeam = form.watch("agentIssueHandoffTeam");
    const agentIssueSendMessage = form.watch("agentIssueSendMessage");
    const communicationStyle = form.watch("communicationStyle");
    const profile = form.watch("profile");
    const objectiveLength = form.watch("objective").length;
    const provider = form.watch("provider");
    const model = form.watch("model");
    const reasoningModelVersion = form.watch("reasoningModelVersion");
    const communicationHint = COMMUNICATION_STYLE_OPTIONS.find((item) => item.value === communicationStyle)?.example
        ?? "Selecione um estilo padrão, igual ao cadastro dos agentes IA.";
    const hasLegacyCommunicationStyle = Boolean(currentSupervisor?.communicationStyle) && !isKnownCommunicationStyle(currentSupervisor?.communicationStyle);
    const hasLegacyProfile = Boolean(currentSupervisor?.profile) && !isKnownProfile(currentSupervisor?.profile);
    const isOpenAiProvider = provider === "openai";
    const reasoningOptions = useMemo(() => {
        const options = [...openAiCatalog.reasoningModels];
        if (model) options.unshift(model);
        return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
    }, [model, openAiCatalog.reasoningModels]);
    const modelVersionOptions = useMemo(() => {
        const options = [...MODEL_VERSION_PRESET_OPTIONS];
        if (reasoningModelVersion) options.unshift(reasoningModelVersion);
        return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
    }, [reasoningModelVersion]);
    const transferUserOptions = useMemo(() => {
        const base = transferUsers.map((user) => ({
            id: user.id,
            label: `${user.fullName}${user.email ? ` (${user.email})` : ""}`,
        }));
        const legacyValues = [humanHandoffTeam, agentIssueHandoffTeam]
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((value) => !base.some((item) => item.id === value))
            .map((value) => ({ id: value, label: `Valor atual: ${value}` }));
        return [...base, ...legacyValues];
    }, [agentIssueHandoffTeam, humanHandoffTeam, transferUsers]);

    useEffect(() => {
        if (!supervisorId) return;
        const resolvedSupervisorId = supervisorId;
        let active = true;

        async function load() {
            setLoading(true);
            setLoadError(null);
            try {
                const supervisor = await getSupervisor(resolvedSupervisorId);
                if (!active) return;
                setCurrentSupervisor(supervisor);
                form.reset(toFormValues(supervisor));
            } catch (error) {
                if (!active) return;
                setLoadError(getFriendlyHttpErrorMessage(error, "Não foi possível carregar o supervisor."));
            } finally {
                if (active) setLoading(false);
            }
        }

        load();
        return () => {
            active = false;
        };
    }, [form, supervisorId]);

    useEffect(() => {
        if (!isOpenAiProvider || openAiCatalogLoaded) return;

        let cancelled = false;

        async function loadCatalog() {
            setOpenAiCatalogLoading(true);
            try {
                const catalog = await loadOpenAiModelCatalogFromApi();
                if (cancelled) return;
                setOpenAiCatalog(catalog);
            } catch {
                if (cancelled) return;
                setOpenAiCatalog({ modelVersions: [], reasoningModels: [] });
            } finally {
                if (cancelled) return;
                setOpenAiCatalogLoaded(true);
                setOpenAiCatalogLoading(false);
            }
        }

        void loadCatalog();

        return () => {
            cancelled = true;
        };
    }, [isOpenAiProvider, openAiCatalogLoaded]);

    useEffect(() => {
        if (activeTab !== "human" || transferUsersLoaded) return;

        let cancelled = false;

        async function loadTransferUsers() {
            setTransferUsersLoading(true);
            try {
                const res = await fetch("/api/atendimentos/users", { cache: "no-store" });
                const data = res.ok ? await res.json().catch(() => []) : [];
                if (cancelled) return;
                const parsed = Array.isArray(data)
                    ? data.map((item) => {
                        const source = (item ?? {}) as Record<string, unknown>;
                        return {
                            id: String(source.id ?? "").trim(),
                            fullName: String(source.fullName ?? "").trim(),
                            email: String(source.email ?? "").trim(),
                        } satisfies TransferUser;
                    }).filter((item) => item.id && item.fullName)
                    : [];
                setTransferUsers(parsed);
            } catch {
                if (cancelled) return;
                setTransferUsers([]);
            } finally {
                if (cancelled) return;
                setTransferUsersLoaded(true);
                setTransferUsersLoading(false);
            }
        }

        void loadTransferUsers();

        return () => {
            cancelled = true;
        };
    }, [activeTab, transferUsersLoaded]);

    useEffect(() => {
        if (humanHandoffEnabled) return;
        if (!form.getValues("humanHandoffSendMessage")) return;
        form.setValue("humanHandoffSendMessage", false, { shouldDirty: true, shouldValidate: true });
    }, [form, humanHandoffEnabled]);

    function pushToast(message: string, type: ToastMessage["type"]) {
        const id = getToastId();
        setToasts((current) => [...current, { id, message, type }]);
        window.setTimeout(() => {
            setToasts((current) => current.filter((item) => item.id !== id));
        }, 4500);
    }

    function dismissToast(id: number) {
        setToasts((current) => current.filter((item) => item.id !== id));
    }

    function confirmLeave() {
        if (!form.formState.isDirty) return true;
        return window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?");
    }

    async function handleSubmit(intent: "save" | "distribution") {
        await form.handleSubmit(async (values) => {
            setSubmitting(true);
            try {
                const payload = toPayload(values);
                const saved = supervisorId
                    ? await updateSupervisor(supervisorId, payload)
                    : await createSupervisor(payload);

                setCurrentSupervisor(saved);
                form.reset(toFormValues(saved));
                pushToast(supervisorId ? "Supervisor atualizado com sucesso." : "Supervisor criado com sucesso.", "success");

                if (intent === "distribution") {
                    router.push(`${BASE_ROUTE}/${saved.id}/distribuicao`);
                    return;
                }

                if (!supervisorId) {
                    router.replace(`${BASE_ROUTE}/${saved.id}`);
                    return;
                }

                router.refresh();
            } catch (error) {
                pushToast(getFriendlyHttpErrorMessage(error, "Não foi possível salvar o supervisor."), "error");
            } finally {
                setSubmitting(false);
            }
        })();
    }

    if (loading) {
        return <LoadingState label="Carregando configuração do supervisor..." />;
    }

    if (loadError) {
        return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;
    }

    const pageTitle = supervisorId ? currentSupervisor?.name || "Editar supervisor" : "Novo Supervisor";

    return (
        <>
            <SupervisorBreadcrumbs
                items={[
                    { label: "IA", href: "/protected/agentes-ia" },
                    { label: "Supervisores", href: BASE_ROUTE },
                    { label: pageTitle },
                ]}
            />

            <PageShell
                title={pageTitle}
                description="Configure a identidade do supervisor, o modelo usado na triagem e as regras de handoff humano."
                actions={(
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                if (!confirmLeave()) return;
                                router.push(BASE_ROUTE);
                            }}
                            className="h-11 rounded-xl border border-black/10 px-4 text-sm font-medium text-black/65 transition hover:bg-black/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit("save")}
                            disabled={submitting}
                            className="h-11 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit("distribution")}
                            disabled={submitting}
                            className="h-11 rounded-xl border border-io-purple/25 bg-io-purple/10 px-4 text-sm font-semibold text-io-purple transition hover:bg-io-purple/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Salvar e ir para Distribuição
                        </button>
                    </>
                )}
            >
                <SectionCard
                    title="Configuração do Supervisor"
                    description="Os campos abaixo controlam como o supervisor interpreta os primeiros contatos e quando aciona handoff."
                >
                    <div className="mb-5 flex flex-wrap gap-2 border-b border-black/5 pb-4">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? "bg-io-purple text-white" : "border border-black/10 bg-white text-black/65 hover:bg-black/5"}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === "profile" ? (
                        <div className="grid gap-5">
                            <div>
                                <FieldLabel htmlFor="supervisor-name" label="Nome do supervisor" required />
                                <input
                                    id="supervisor-name"
                                    {...form.register("name")}
                                    placeholder="Ex.: Supervisor de Triagem de Leads"
                                    className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                />
                                <FieldError message={form.formState.errors.name?.message} />
                            </div>

                            <div>
                                <FieldLabel label="Forma de comunicação" required description="Tom e estilo usados quando o supervisor precisar perguntar algo ao lead." />
                                <div className="grid gap-2">
                                    <div className="flex flex-wrap gap-2">
                                        {COMMUNICATION_STYLE_OPTIONS.map((item) => {
                                            const active = communicationStyle === item.value;
                                            return (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => form.setValue("communicationStyle", item.value, { shouldDirty: true, shouldValidate: true })}
                                                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                                        active ? "border-io-purple bg-white text-io-purple" : "border-black/15 bg-[#f3f5f9] text-io-dark"
                                                    }`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-sm text-black/60">{communicationHint}</p>
                                    {hasLegacyCommunicationStyle ? (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                            O valor atual deste supervisor não corresponde aos presets dos agentes IA. Escolha uma das opções para substituir.
                                        </div>
                                    ) : null}
                                </div>
                                <FieldError message={form.formState.errors.communicationStyle?.message} />
                            </div>

                            <div>
                                <FieldLabel label="Perfil do supervisor" required description="Defina a persona do roteador usando o mesmo conjunto de perfis dos agentes IA." />
                                <div className="flex flex-wrap gap-2">
                                    {PROFILE_OPTIONS.map((item) => {
                                        const active = profile.toLowerCase() === item.toLowerCase();
                                        return (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => form.setValue("profile", item, { shouldDirty: true, shouldValidate: true })}
                                                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                                    active ? "border-io-purple bg-white text-io-purple" : "border-black/15 bg-[#f3f5f9] text-io-dark"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        );
                                    })}
                                </div>
                                {hasLegacyProfile ? (
                                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        O valor atual deste supervisor não corresponde aos perfis padrão dos agentes IA. Escolha uma das opções para substituir.
                                    </div>
                                ) : null}
                                <FieldError message={form.formState.errors.profile?.message} />
                            </div>

                            <div>
                                <FieldLabel htmlFor="supervisor-objective" label="Objetivo do supervisor" description="O que ele precisa maximizar na triagem." trailing={`${objectiveLength}/2000`} />
                                <textarea
                                    id="supervisor-objective"
                                    rows={5}
                                    maxLength={2000}
                                    {...form.register("objective")}
                                    placeholder="Ex.: Encaminhar o lead ao agente ideal com o menor número de mensagens possível."
                                    className="w-full rounded-2xl border border-black/10 px-3 py-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                />
                                <FieldError message={form.formState.errors.objective?.message} />
                            </div>
                        </div>
                    ) : null}

                    {activeTab === "model" ? (
                        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
                            <div className="space-y-5">
                                <div>
                                    <FieldLabel htmlFor="supervisor-provider" label="Provedor" required />
                                    <select
                                        id="supervisor-provider"
                                        {...form.register("provider")}
                                        className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                    >
                                        {SUPERVISOR_PROVIDER_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError message={form.formState.errors.provider?.message} />
                                </div>

                                <div>
                                    <FieldLabel htmlFor="supervisor-model" label="Modelo de raciocínio" required description="Mesmo comportamento do painel de Agentes IA." />
                                    {isOpenAiProvider ? (
                                        <select
                                            id="supervisor-model"
                                            {...form.register("model")}
                                            disabled={openAiCatalogLoading}
                                            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10 disabled:bg-black/5"
                                        >
                                            <option value="">
                                                {openAiCatalogLoading ? "Carregando modelos OpenAI..." : "Selecione modelo de raciocínio"}
                                            </option>
                                            {reasoningOptions.map((item) => (
                                                <option key={item} value={item}>
                                                    {item}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            id="supervisor-model"
                                            {...form.register("model")}
                                            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                            placeholder="Modelo de raciocínio"
                                        />
                                    )}
                                    <FieldError message={form.formState.errors.model?.message} />
                                </div>

                                <div>
                                    <FieldLabel htmlFor="supervisor-version" label="Versão do modelo" required />
                                    {isOpenAiProvider ? (
                                        <select
                                            id="supervisor-version"
                                            {...form.register("reasoningModelVersion")}
                                            disabled={openAiCatalogLoading}
                                            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10 disabled:bg-black/5"
                                        >
                                            <option value="">
                                                {openAiCatalogLoading ? "Carregando modelos OpenAI..." : "Selecione versão do modelo"}
                                            </option>
                                            {modelVersionOptions.map((item) => (
                                                <option key={item} value={item}>
                                                    {item}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            id="supervisor-version"
                                            {...form.register("reasoningModelVersion")}
                                            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                            placeholder="Versão do modelo"
                                        />
                                    )}
                                    <FieldError message={form.formState.errors.reasoningModelVersion?.message} />
                                </div>
                                {isOpenAiProvider && !openAiCatalogLoading && openAiCatalogLoaded && reasoningOptions.length === 0 && modelVersionOptions.length === 0 ? (
                                    <p className="text-xs text-black/60">
                                        Nenhum modelo OpenAI disponível. Configure a chave no provedor OpenAI salvo ou em OPENAI_API_KEY na API.
                                    </p>
                                ) : null}
                            </div>

                            <div className="rounded-2xl border border-io-purple/15 bg-io-purple/5 p-4">
                                <h3 className="text-sm font-semibold text-io-dark">Execução determinística</h3>
                                <ul className="mt-3 space-y-2 text-sm text-black/60">
                                    <li>A temperatura no backend fica travada em 0 para reduzir variância.</li>
                                    <li>O prompt do supervisor envia contexto compacto e candidatos truncados.</li>
                                    <li>JSON estrito reduz custo de tokens e facilita auditoria.</li>
                                    <li>O cooldown e o gating evitam chamadas desnecessárias ao modelo.</li>
                                </ul>
                            </div>
                        </div>
                    ) : null}

                    {activeTab === "human" ? (
                        <div className="grid gap-4">
                            <label className="flex items-start gap-3 rounded-2xl border border-black/10 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={notifyContactOnAgentTransfer}
                                    onChange={(event) => form.setValue("notifyContactOnAgentTransfer", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                                    className="mt-1 h-4 w-4 rounded border-black/25 text-io-purple focus:ring-io-purple"
                                />
                                <span className="text-sm text-io-dark">
                                    <span className="block font-medium">Notificar o contato quando houver troca do agente responsável pelo atendimento</span>
                                    <span className="mt-1 block text-xs text-black/55">
                                        Exemplo: Parece que sua dúvida é com outra equipe. Estou transferindo seu atendimento agora.
                                    </span>
                                </span>
                            </label>

                            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                <label className="mb-4 flex items-center gap-3 text-sm font-medium text-io-dark">
                                    <input
                                        type="checkbox"
                                        checked={humanHandoffEnabled}
                                        onChange={(event) => form.setValue("humanHandoffEnabled", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                                        className="h-4 w-4 rounded border-black/25 text-io-purple focus:ring-io-purple"
                                    />
                                    Habilitar transferência para atendimento humano
                                </label>

                                <div className="space-y-4">
                                    <div>
                                        <FieldLabel htmlFor="human-handoff-team" label="Transferir para este usuário em solicitações de atendimento humano" required />
                                        <select
                                            id="human-handoff-team"
                                            value={humanHandoffTeam}
                                            onChange={(event) => form.setValue("humanHandoffTeam", event.target.value, { shouldDirty: true, shouldValidate: true })}
                                            disabled={!humanHandoffEnabled}
                                            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10 disabled:bg-black/5"
                                        >
                                            <option value="">
                                                {transferUsersLoading ? "Carregando usuários..." : "Selecione um usuário"}
                                            </option>
                                            {transferUserOptions.map((option) => (
                                                <option key={option.id} value={option.id}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError message={form.formState.errors.humanHandoffTeam?.message} />
                                        {transferUsersLoaded && transferUserOptions.length === 0 ? (
                                            <p className="mt-2 text-xs text-amber-700">Nenhum usuário disponível para transferência.</p>
                                        ) : null}
                                    </div>

                                    <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-io-dark">
                                        <input
                                            type="checkbox"
                                            checked={humanHandoffSendMessage}
                                            onChange={(event) => form.setValue("humanHandoffSendMessage", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                                            disabled={!humanHandoffEnabled}
                                            className="h-4 w-4 rounded border-black/25 text-io-purple focus:ring-io-purple"
                                        />
                                        Enviar mensagem de transferência
                                    </label>

                                    <div className="rounded-xl border border-black/10 bg-white p-3">
                                        <FieldLabel
                                            htmlFor="human-handoff-message"
                                            label="Mensagem de transferência"
                                            required={humanHandoffEnabled && humanHandoffSendMessage}
                                            trailing={`${humanHandoffMessage.length}/500`}
                                        />
                                        <textarea
                                            id="human-handoff-message"
                                            rows={3}
                                            maxLength={500}
                                            value={humanHandoffMessage}
                                            onChange={(event) => form.setValue("humanHandoffMessage", event.target.value, { shouldDirty: true, shouldValidate: true })}
                                            disabled={!humanHandoffEnabled || !humanHandoffSendMessage}
                                            className="w-full rounded-2xl border border-black/10 px-3 py-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10 disabled:bg-black/5"
                                            placeholder="Estamos transferindo seu atendimento para um de nossos especialistas, por favor aguarde!"
                                        />
                                        <FieldError message={form.formState.errors.humanHandoffMessage?.message} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                <div>
                                    <FieldLabel htmlFor="agent-issue-team" label="Transferir para este usuário em casos de problemas com o Agente" required />
                                    <select
                                        id="agent-issue-team"
                                        value={agentIssueHandoffTeam}
                                        onChange={(event) => form.setValue("agentIssueHandoffTeam", event.target.value, { shouldDirty: true, shouldValidate: true })}
                                        className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-io-purple focus:ring-2 focus:ring-io-purple/10"
                                    >
                                        <option value="">
                                            {transferUsersLoading ? "Carregando usuários..." : "Selecione um usuário"}
                                        </option>
                                        {transferUserOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError message={form.formState.errors.agentIssueHandoffTeam?.message} />
                                </div>

                                <label className="mt-4 flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-io-dark">
                                    <input
                                        type="checkbox"
                                        checked={agentIssueSendMessage}
                                        onChange={(event) => form.setValue("agentIssueSendMessage", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                                        className="h-4 w-4 rounded border-black/25 text-io-purple focus:ring-io-purple"
                                    />
                                    Enviar mensagem
                                </label>
                            </div>
                        </div>
                    ) : null}

                    {activeTab === "status" ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <InlineToggle
                                checked={form.watch("enabled")}
                                onChange={(checked) => form.setValue("enabled", checked, { shouldDirty: true, shouldValidate: true })}
                                label="Supervisor ativo"
                                description="Quando desligado, o roteamento não usa este supervisor em runtime."
                            />
                            <InlineToggle
                                checked={form.watch("defaultForCompany")}
                                onChange={(checked) => form.setValue("defaultForCompany", checked, { shouldDirty: true, shouldValidate: true })}
                                label="Usar como supervisor padrão da empresa"
                                description="Este supervisor vira o fallback principal quando houver triagem automática sem mapeamento específico."
                            />
                        </div>
                    ) : null}
                </SectionCard>

                {!supervisorId ? (
                    <EmptyState
                        title="Distribuição disponível após salvar"
                        description="Crie o supervisor primeiro para depois vincular agentes e configurar as regras de distribuição."
                    />
                ) : null}
            </PageShell>

            <ToastStack items={toasts} onDismiss={dismissToast} />
        </>
    );
}
