"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";
import {
    EMPTY_AI_AGENTS_STATE,
    disconnectGoogleOAuthFromApi,
    loadGoogleOAuthStatusFromApi,
    loadAiAgentsStateFromApi,
    loadOpenAiModelCatalogFromApi,
    saveAiAgentsStateToApi,
    uploadKnowledgeFilesToApi,
    type AiAgent,
    type AiAgentStageBehavior,
    type AiAgentsState,
    type OpenAiModelCatalog,
    type AiProvider,
    type AiProviderType,
    type AiAgentCapabilityConfigs,
    type GoogleOAuthStatus,
    type KnowledgeBase,
    type KnowledgeAsset,
    type KnowledgeAssetType,
} from "@/modules/ai-agents/storage";
import { loadCrmStateFromApi, type CrmCustomField, type CrmStage } from "@/modules/crm/storage";
import {
    AI_AGENT_PROFILE_OPTIONS,
    AI_COMMUNICATION_STYLE_OPTIONS,
} from "@/modules/ai/shared/presets";

type Tab = "providers" | "agents" | "knowledge";
type TransferUser = { id: string; fullName: string; email: string };

const providerTypes: AiProviderType[] = ["openai", "anthropic", "google", "meta", "azure-openai", "custom"];
const modelVersionPresetOptions: string[] = ["v0.5", "v0.6", "v0.7"];
const communicationStyleOptions = AI_COMMUNICATION_STYLE_OPTIONS;
const agentProfileOptions = AI_AGENT_PROFILE_OPTIONS;
type AgentCapabilityKey = "kanban_move_card" | "crm_update_contact_data" | "schedule_google_meeting";
type AgentCapability = {
    key: AgentCapabilityKey;
    label: string;
    description: string;
    skillToken: string;
    setupLabel: string;
    setupType: "kanban-prompts" | "crm-fields" | "google-calendar";
};
const agentCapabilities: AgentCapability[] = [
    {
        key: "schedule_google_meeting",
        label: "Agendar reuniões no Google Calendar",
        description: "Permite consultar horários reais, sugerir slots e criar reuniões com Google Meet.",
        skillToken: "schedule_google_meeting",
        setupLabel: "Ver conexão Google",
        setupType: "google-calendar",
    },
    {
        key: "kanban_move_card",
        label: "Mover cards no Kanban",
        description: "Permite atualizar estágio de cards no CRM durante o atendimento.",
        skillToken: "kanban_move_card",
        setupLabel: "Configurar prompts",
        setupType: "kanban-prompts",
    },
    {
        key: "crm_update_contact_data",
        label: "Atualizar dados do contato no CRM",
        description: "Permite capturar dados informados pelo lead durante a conversa e preencher os campos do card automaticamente.",
        skillToken: "crm_update_contact_data",
        setupLabel: "Configurar campos do CRM",
        setupType: "crm-fields",
    },
];
function getDefaultCapabilityConfigs(): AiAgentCapabilityConfigs {
    return {
        kanbanMoveCardStagePrompts: {},
        crmFieldIdsToFill: [],
    };
}

function newDefaultStageBehaviors(): AiAgentStageBehavior[] {
    return [
        { id: `behavior_greeting_${Date.now()}`, stage: "Saudação", instruction: "Cumprimente com educação e identifique a necessidade principal do cliente." },
        { id: `behavior_qualification_${Date.now()}`, stage: "Qualificação", instruction: "Faça perguntas objetivas para qualificar o contexto e o objetivo do contato." },
        { id: `behavior_solution_${Date.now()}`, stage: "Apresentação de solução", instruction: "Apresente a melhor solução com clareza, benefícios e próximos passos." },
        { id: `behavior_handover_${Date.now()}`, stage: "Encaminhamento", instruction: "Confirme entendimento e encaminhe para humano quando necessário." },
    ];
}

function stagePresetByType(type: "sales" | "support" | "onboarding"): AiAgentStageBehavior[] {
    const now = Date.now();
    if (type === "support") {
        return [
            { id: `behavior_support_1_${now}`, stage: "Triagem inicial", instruction: "Cumprimente o cliente e identifique rapidamente o problema principal." },
            { id: `behavior_support_2_${now}`, stage: "Diagnóstico", instruction: "Colete contexto técnico essencial e valide impactos para priorizar o atendimento." },
            { id: `behavior_support_3_${now}`, stage: "Resolução", instruction: "Oriente em passos claros, confirme a solução e registre pendências." },
        ];
    }
    if (type === "onboarding") {
        return [
            { id: `behavior_onboarding_1_${now}`, stage: "Boas-vindas", instruction: "Apresente o fluxo de onboarding e alinhe expectativa de entrega com o cliente." },
            { id: `behavior_onboarding_2_${now}`, stage: "Coleta de informações", instruction: "Solicite dados obrigatórios e valide se todos os acessos foram compartilhados." },
            { id: `behavior_onboarding_3_${now}`, stage: "Plano inicial", instruction: "Defina próximos passos, prazos e pontos de acompanhamento do onboarding." },
        ];
    }
    return [
        { id: `behavior_sales_1_${now}`, stage: "Abertura", instruction: "Cumprimente e descubra o momento da empresa e objetivo do contato." },
        { id: `behavior_sales_2_${now}`, stage: "Qualificação", instruction: "Faça perguntas para qualificar necessidade, urgência e fit da oportunidade." },
        { id: `behavior_sales_3_${now}`, stage: "Proposta e próximo passo", instruction: "Apresente proposta objetiva e conduza para agendamento/fechamento." },
    ];
}

function newProvider(): AiProvider {
    const now = new Date().toISOString();
    return {
        id: `provider_${Date.now()}`,
        name: "",
        type: "openai",
        apiBaseUrl: "",
        apiKey: "",
        modelFamily: "",
        modelVersion: "",
        reasoningModel: "",
        createdAt: now,
        updatedAt: now,
    };
}

function newAgent(providerId = "", knowledgeBaseId = ""): AiAgent {
    const now = new Date().toISOString();
    return {
        id: `agent_${Date.now()}`,
        name: "",
        communicationStyle: "",
        profile: "",
        objective: "",
        stageBehaviors: newDefaultStageBehaviors(),
        skills: [],
        capabilityConfigs: getDefaultCapabilityConfigs(),
        rules: [],
        restrictions: [],
        providerId,
        knowledgeBaseId,
        reasoningModel: "",
        modelVersion: "",
        temperature: 1,
        transferUserId: "",
        maxTokensPerMessage: 1200,
        delayMessageSeconds: 2,
        delayTypingSeconds: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };
}

function newKnowledgeBase(name?: string): KnowledgeBase {
    const now = new Date().toISOString();
    return {
        id: `knowledge_base_${Date.now()}`,
        name: (name ?? "").trim() || "Nova base",
        vectorStoreIds: [],
        files: [],
        createdAt: now,
        updatedAt: now,
    };
}

function detectKnowledgeType(fileName: string): KnowledgeAssetType {
    const normalized = fileName.toLowerCase();
    if (normalized.endsWith(".pdf")) return "pdf";
    if (normalized.endsWith(".txt") || normalized.endsWith(".md")) return "txt";
    if (normalized.endsWith(".csv") || normalized.endsWith(".xlsx") || normalized.endsWith(".xls")) return "spreadsheet";
    if (normalized.endsWith(".doc") || normalized.endsWith(".docx")) return "doc";
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) return "url";
    return "other";
}

async function readTextFileSafely(file: File): Promise<string> {
    const textLikeExtensions = [".txt", ".md", ".csv", ".json"];
    const lower = file.name.toLowerCase();
    const canReadAsText = textLikeExtensions.some((ext) => lower.endsWith(ext));
    if (!canReadAsText) return "";
    try {
        return await file.text();
    } catch {
        return "";
    }
}

async function readPdfFileSafely(file: File): Promise<string> {
    try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item) => {
                    if (!item || typeof item !== "object" || !("str" in item)) return "";
                    return String((item as { str?: unknown }).str ?? "");
                })
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
            if (pageText) pages.push(pageText);
        }
        return pages.join("\n\n").trim();
    } catch {
        return "";
    }
}

async function readDocxFileSafely(file: File): Promise<string> {
    try {
        const mammoth = await import("mammoth");
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        return String(result.value ?? "").replace(/\r\n/g, "\n").trim();
    } catch {
        return "";
    }
}

async function readKnowledgeFileContent(file: File): Promise<string> {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) return readPdfFileSafely(file);
    if (lower.endsWith(".docx")) return readDocxFileSafely(file);
    return readTextFileSafely(file);
}

function parseMultilinePreserve(value: string) {
    return value.replace(/\r\n/g, "\n").split("\n");
}

function formatMultiline(value: string[]) {
    return value.join("\n");
}

function getTemperatureHint(value: number) {
    if (Math.abs(value - 1) < 0.001) return "Equilibrio entre criatividade e treinamento.";
    if (value < 1) return "Mais restrito: respostas mais previsíveis e consistentes.";
    if (value <= 1.3) return "Mais criativo: variação controlada de respostas.";
    return "Alta criatividade, com maior variação de respostas.";
}

function normalizeUploadStatus(status: string): KnowledgeAsset["processingStatus"] {
    const normalized = status.trim().toLowerCase();
    if (normalized === "completed") return "ready";
    if (normalized === "failed" || normalized === "cancelled" || normalized === "error") return "failed";
    return "processing";
}

function statusLabel(status: KnowledgeAsset["processingStatus"]) {
    if (status === "processing") return "Processando";
    if (status === "failed") return "Falha";
    return "Pronto";
}

function statusClasses(status: KnowledgeAsset["processingStatus"]) {
    if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-700";
    if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
    return "border-green-200 bg-green-50 text-green-700";
}

function googleStatusLabel(status: GoogleOAuthStatus["status"] | "") {
    if (status === "CONNECTED") return "Conectado";
    if (status === "ERROR") return "Erro";
    return "Desconectado";
}

function googleStatusClasses(status: GoogleOAuthStatus["status"] | "") {
    if (status === "CONNECTED") return "border-green-200 bg-green-50 text-green-700";
    if (status === "ERROR") return "border-red-200 bg-red-50 text-red-700";
    return "border-black/15 bg-[#f3f5f9] text-black/65";
}

function getMergedRulesRestrictions(agent: AiAgent | null): string[] {
    if (!agent) return [];
    return [...agent.rules, ...agent.restrictions];
}

export function AiAgentsStudio() {
    const searchParams = useSearchParams();
    const [state, setState] = useState<AiAgentsState>(EMPTY_AI_AGENTS_STATE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("providers");
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState("");
    const [users, setUsers] = useState<TransferUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [openAiCatalog, setOpenAiCatalog] = useState<OpenAiModelCatalog>({ modelVersions: [], reasoningModels: [] });
    const [openAiCatalogLoading, setOpenAiCatalogLoading] = useState(false);
    const [openAiCatalogLoaded, setOpenAiCatalogLoaded] = useState(false);
    const [crmStages, setCrmStages] = useState<CrmStage[]>([]);
    const [crmCustomFields, setCrmCustomFields] = useState<CrmCustomField[]>([]);
    const [crmMetaLoading, setCrmMetaLoading] = useState(false);
    const [crmMetaLoaded, setCrmMetaLoaded] = useState(false);
    const [isCapabilityPickerOpen, setIsCapabilityPickerOpen] = useState(false);
    const [activeCapabilitySetup, setActiveCapabilitySetup] = useState<AgentCapabilityKey | null>(null);
    const [googleOauthStatus, setGoogleOauthStatus] = useState<GoogleOAuthStatus | null>(null);
    const [googleOauthLoading, setGoogleOauthLoading] = useState(false);
    const [googleOauthSyncing, setGoogleOauthSyncing] = useState(false);

    const selectedProvider = useMemo(() => state.providers.find((item) => item.id === selectedProviderId) ?? null, [state.providers, selectedProviderId]);
    const selectedAgent = useMemo(() => state.agents.find((item) => item.id === selectedAgentId) ?? null, [state.agents, selectedAgentId]);
    const selectedKnowledgeBase = useMemo(() => state.knowledgeBase.find((item) => item.id === selectedKnowledgeBaseId) ?? null, [state.knowledgeBase, selectedKnowledgeBaseId]);
    const selectedAgentProvider = useMemo(() => state.providers.find((item) => item.id === selectedAgent?.providerId) ?? null, [state.providers, selectedAgent]);
    const selectedAgentIsOpenAi = selectedAgentProvider?.type === "openai";
    const selectedCommunicationOption = useMemo(() => {
        const current = (selectedAgent?.communicationStyle ?? "").trim();
        if (!current) return "";
        const found = communicationStyleOptions.find((item) => item.value === current);
        return found ? found.value : "__custom__";
    }, [selectedAgent?.communicationStyle]);
    const selectedProfileOption = useMemo(() => {
        const current = (selectedAgent?.profile ?? "").trim();
        if (!current) return "";
        const found = agentProfileOptions.find((item) => item.toLowerCase() === current.toLowerCase());
        return found ?? "Outro";
    }, [selectedAgent?.profile]);
    const communicationHint = useMemo(() => {
        const current = selectedCommunicationOption || "__custom__";
        const option = communicationStyleOptions.find((item) => item.value === current) ?? communicationStyleOptions[communicationStyleOptions.length - 1];
        return option.example;
    }, [selectedCommunicationOption]);
    const reasoningOptions = useMemo(() => {
        const options = [...openAiCatalog.reasoningModels];
        if (selectedAgent?.reasoningModel) options.unshift(selectedAgent.reasoningModel);
        return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
    }, [openAiCatalog.reasoningModels, selectedAgent?.reasoningModel]);
    const modelVersionOptions = useMemo(() => {
        const options = [...modelVersionPresetOptions];
        if (selectedAgent?.modelVersion) options.unshift(selectedAgent.modelVersion);
        return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
    }, [selectedAgent?.modelVersion]);
    const selectedCapabilities = useMemo(() => {
        if (!selectedAgent) return [] as AgentCapability[];
        return agentCapabilities.filter((capability) => selectedAgent.skills.includes(capability.skillToken));
    }, [selectedAgent]);
    const availableCapabilities = useMemo(() => {
        if (!selectedAgent) return [] as AgentCapability[];
        return agentCapabilities.filter((capability) => !selectedAgent.skills.includes(capability.skillToken));
    }, [selectedAgent]);

    async function refreshGoogleOAuthStatus(showErrorFeedback = false) {
        setGoogleOauthLoading(true);
        try {
            const nextStatus = await loadGoogleOAuthStatusFromApi();
            setGoogleOauthStatus(nextStatus);
        } catch {
            setGoogleOauthStatus(null);
            if (showErrorFeedback) {
                setError("Não foi possível carregar o status da integração Google.");
            }
        } finally {
            setGoogleOauthLoading(false);
        }
    }

    useEffect(() => {
        async function boot() {
            setLoading(true);
            setError(null);
            try {
                const aiState = await loadAiAgentsStateFromApi();
                setState(aiState);
                if (aiState.providers[0]) setSelectedProviderId(aiState.providers[0].id);
                if (aiState.agents[0]) setSelectedAgentId(aiState.agents[0].id);
                if (aiState.knowledgeBase[0]) setSelectedKnowledgeBaseId(aiState.knowledgeBase[0].id);
            } catch {
                setError("Não foi possível carregar as configurações de agentes IA.");
            } finally {
                setLoading(false);
            }
            await refreshGoogleOAuthStatus(false);
        }
        boot();
    }, []);

    useEffect(() => {
        const tabParam = searchParams?.get("tab");
        if (tabParam === "providers" || tabParam === "agents" || tabParam === "knowledge") {
            setTab(tabParam);
        }

        const googleOauth = searchParams?.get("google_oauth");
        if (!googleOauth) return;

        if (googleOauth === "connected") {
            const email = (searchParams?.get("google_email") ?? "").trim();
            setSuccess(email ? `Conta Google conectada com sucesso (${email}).` : "Conta Google conectada com sucesso.");
            void refreshGoogleOAuthStatus(false);
        } else if (googleOauth === "error") {
            const message = (searchParams?.get("message") ?? "").trim();
            setError(message || "Falha ao concluir a conexão com o Google.");
            void refreshGoogleOAuthStatus(false);
        }

        if (typeof window !== "undefined") {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete("google_oauth");
            currentUrl.searchParams.delete("google_email");
            currentUrl.searchParams.delete("message");
            window.history.replaceState({}, "", currentUrl.toString());
        }
    }, [searchParams]);

    async function ensureUsersLoaded() {
        if (usersLoaded || usersLoading) return;
        setUsersLoading(true);
        try {
            const usersRes = await fetch("/api/atendimentos/users", { cache: "no-store" });
            const usersData = usersRes.ok ? ((await usersRes.json().catch(() => [])) as TransferUser[]) : [];
            setUsers(Array.isArray(usersData) ? usersData : []);
        } finally {
            setUsersLoaded(true);
            setUsersLoading(false);
        }
    }

    async function ensureOpenAiCatalogLoaded() {
        if (openAiCatalogLoaded || openAiCatalogLoading) return;
        setOpenAiCatalogLoading(true);
        try {
            const catalog = await loadOpenAiModelCatalogFromApi().catch(() => ({ modelVersions: [], reasoningModels: [] }));
            setOpenAiCatalog(catalog);
        } finally {
            setOpenAiCatalogLoaded(true);
            setOpenAiCatalogLoading(false);
        }
    }

    async function ensureCrmMetaLoaded(force = false) {
        if (!force && (crmMetaLoaded || crmMetaLoading)) return;
        setCrmMetaLoading(true);
        try {
            const crm = await loadCrmStateFromApi();
            setCrmStages(Array.isArray(crm.stages) ? crm.stages : []);
            setCrmCustomFields(Array.isArray(crm.customFields) ? crm.customFields : []);
        } catch {
            setCrmStages([]);
            setCrmCustomFields([]);
            setError("Não foi possível carregar configurações do CRM.");
        } finally {
            setCrmMetaLoaded(true);
            setCrmMetaLoading(false);
        }
    }

    useEffect(() => {
        if (tab !== "agents") return;
        ensureUsersLoaded().catch(() => undefined);
        ensureOpenAiCatalogLoaded().catch(() => undefined);
    }, [tab]);

    useEffect(() => {
        setActiveCapabilitySetup(null);
        setIsCapabilityPickerOpen(false);
    }, [selectedAgentId]);

    function clearFeedback() {
        setError(null);
        setSuccess(null);
    }

    function startGoogleOAuth() {
        clearFeedback();
        setGoogleOauthSyncing(true);
        window.location.href = "/api/integrations/google/oauth/start";
    }

    async function disconnectGoogleOAuth() {
        setGoogleOauthSyncing(true);
        clearFeedback();
        try {
            await disconnectGoogleOAuthFromApi();
            await refreshGoogleOAuthStatus(false);
            setSuccess("Integração Google desconectada.");
        } catch {
            setError("Não foi possível desconectar a integração Google.");
        } finally {
            setGoogleOauthSyncing(false);
        }
    }

    async function persist(nextState: AiAgentsState, message: string) {
        setSaving(true);
        clearFeedback();
        try {
            const saved = await saveAiAgentsStateToApi(nextState);
            setState(saved);
            setSuccess(message);
        } catch {
            setError("Falha ao salvar no servidor.");
        } finally {
            setSaving(false);
        }
    }

    function upsertProvider(patch: Partial<AiProvider>) {
        if (!selectedProvider) return;
        const now = new Date().toISOString();
        const nextState: AiAgentsState = {
            ...state,
            providers: state.providers.map((item) => (item.id === selectedProvider.id ? { ...item, ...patch, updatedAt: now } : item)),
        };
        setState(nextState);
    }

    function upsertAgent(patch: Partial<AiAgent>) {
        if (!selectedAgent) return;
        const now = new Date().toISOString();
        const nextState: AiAgentsState = {
            ...state,
            agents: state.agents.map((item) => (item.id === selectedAgent.id ? { ...item, ...patch, updatedAt: now } : item)),
        };
        setState(nextState);
    }

    function getAgentCapabilityConfigs(agent: AiAgent): AiAgentCapabilityConfigs {
        return {
            ...getDefaultCapabilityConfigs(),
            ...(agent.capabilityConfigs ?? {}),
            kanbanMoveCardStagePrompts: {
                ...getDefaultCapabilityConfigs().kanbanMoveCardStagePrompts,
                ...(agent.capabilityConfigs?.kanbanMoveCardStagePrompts ?? {}),
            },
            crmFieldIdsToFill: Array.isArray(agent.capabilityConfigs?.crmFieldIdsToFill)
                ? agent.capabilityConfigs.crmFieldIdsToFill
                : [],
        };
    }

    function upsertCapabilityConfigs(patch: Partial<AiAgentCapabilityConfigs>) {
        if (!selectedAgent) return;
        const current = getAgentCapabilityConfigs(selectedAgent);
        upsertAgent({
            capabilityConfigs: {
                ...current,
                ...patch,
            },
        });
    }

    function openCapabilitySetup(capabilityKey: AgentCapabilityKey) {
        const capability = agentCapabilities.find((item) => item.key === capabilityKey);
        if (capability?.setupType === "kanban-prompts" || capability?.setupType === "crm-fields") {
            ensureCrmMetaLoaded(true).catch(() => undefined);
        }
        if (capability?.setupType === "google-calendar") {
            setTab("providers");
            setSuccess("Conecte o Google Calendar da empresa na aba Provedores para liberar o agendamento deste agente.");
            return;
        }
        setActiveCapabilitySetup(capabilityKey);
    }

    function closeCapabilitySetup() {
        setActiveCapabilitySetup(null);
    }

    function addCapability(capability: AgentCapability) {
        if (!selectedAgent) return;
        const nextSkills = Array.from(new Set([...selectedAgent.skills, capability.skillToken]));
        upsertAgent({ skills: nextSkills });
        setIsCapabilityPickerOpen(false);
        openCapabilitySetup(capability.key);
    }

    function removeCapability(capability: AgentCapability) {
        if (!selectedAgent) return;
        const nextSkills = selectedAgent.skills.filter((item) => item !== capability.skillToken);
        upsertAgent({ skills: nextSkills });
        if (activeCapabilitySetup === capability.key) closeCapabilitySetup();
    }

    function updateKanbanStagePrompt(stageId: string, prompt: string) {
        if (!selectedAgent) return;
        const current = getAgentCapabilityConfigs(selectedAgent);
        upsertCapabilityConfigs({
            kanbanMoveCardStagePrompts: {
                ...current.kanbanMoveCardStagePrompts,
                [stageId]: prompt,
            },
        });
    }

    function toggleCrmFieldSelection(fieldId: string, checked: boolean) {
        if (!selectedAgent) return;
        const current = getAgentCapabilityConfigs(selectedAgent);
        const next = checked
            ? Array.from(new Set([...current.crmFieldIdsToFill, fieldId]))
            : current.crmFieldIdsToFill.filter((item) => item !== fieldId);
        upsertCapabilityConfigs({ crmFieldIdsToFill: next });
    }

    function addStageBehavior() {
        if (!selectedAgent) return;
        const next: AiAgentStageBehavior = {
            id: `behavior_${Date.now()}`,
            stage: "",
            instruction: "",
        };
        upsertAgent({ stageBehaviors: [...selectedAgent.stageBehaviors, next] });
    }

    function updateStageBehavior(id: string, patch: Partial<AiAgentStageBehavior>) {
        if (!selectedAgent) return;
        upsertAgent({
            stageBehaviors: selectedAgent.stageBehaviors.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        });
    }

    function deleteStageBehavior(id: string) {
        if (!selectedAgent) return;
        upsertAgent({ stageBehaviors: selectedAgent.stageBehaviors.filter((item) => item.id !== id) });
    }

    function applyDefaultStageBehaviors() {
        if (!selectedAgent) return;
        upsertAgent({ stageBehaviors: newDefaultStageBehaviors() });
    }

    function applyPresetStageBehaviors(type: "sales" | "support" | "onboarding") {
        if (!selectedAgent) return;
        upsertAgent({ stageBehaviors: stagePresetByType(type) });
    }

    function reorderStageBehaviors(draggedId: string, targetId: string) {
        if (!selectedAgent) return;
        if (!draggedId || !targetId || draggedId === targetId) return;
        const current = [...selectedAgent.stageBehaviors];
        const fromIndex = current.findIndex((item) => item.id === draggedId);
        const toIndex = current.findIndex((item) => item.id === targetId);
        if (fromIndex < 0 || toIndex < 0) return;
        const [moved] = current.splice(fromIndex, 1);
        current.splice(toIndex, 0, moved);
        upsertAgent({ stageBehaviors: current });
    }

    function addProvider() {
        clearFeedback();
        const item = newProvider();
        const nextState = { ...state, providers: [...state.providers, item] };
        setState(nextState);
        setSelectedProviderId(item.id);
        setTab("providers");
    }

    function addAgent() {
        clearFeedback();
        const item = newAgent(state.providers[0]?.id ?? "", state.knowledgeBase[0]?.id ?? "");
        const nextState = { ...state, agents: [...state.agents, item] };
        setState(nextState);
        setSelectedAgentId(item.id);
        setTab("agents");
    }

    function addKnowledge() {
        clearFeedback();
        if (state.knowledgeBase.length === 0) {
            const base = newKnowledgeBase("Base principal");
            setState({ ...state, knowledgeBase: [base] });
            setSelectedKnowledgeBaseId(base.id);
        }
        setTab("knowledge");
    }

    function deleteProvider() {
        if (!selectedProvider) return;
        const nextProviders = state.providers.filter((item) => item.id !== selectedProvider.id);
        const replacement = nextProviders[0]?.id ?? "";
        const nextAgents = state.agents.map((agent) =>
            agent.providerId === selectedProvider.id ? { ...agent, providerId: replacement } : agent
        );
        setState({ ...state, providers: nextProviders, agents: nextAgents });
        setSelectedProviderId(replacement);
    }

    function deleteAgent() {
        if (!selectedAgent) return;
        const nextAgents = state.agents.filter((item) => item.id !== selectedAgent.id);
        setState({ ...state, agents: nextAgents });
        setSelectedAgentId(nextAgents[0]?.id ?? "");
    }

    function createKnowledgeBase() {
        clearFeedback();
        const base = newKnowledgeBase(`Base ${state.knowledgeBase.length + 1}`);
        const next = [...state.knowledgeBase, base];
        setState({ ...state, knowledgeBase: next });
        setSelectedKnowledgeBaseId(base.id);
    }

    function deleteKnowledgeBase(baseId: string) {
        const next = state.knowledgeBase.filter((item) => item.id !== baseId);
        setState({
            ...state,
            knowledgeBase: next,
            agents: state.agents.map((agent) => (
                agent.knowledgeBaseId === baseId ? { ...agent, knowledgeBaseId: "" } : agent
            )),
        });
        if (selectedKnowledgeBaseId === baseId) setSelectedKnowledgeBaseId(next[0]?.id ?? "");
    }

    function renameKnowledgeBase(baseId: string, name: string) {
        const now = new Date().toISOString();
        const next = state.knowledgeBase.map((item) => (item.id === baseId ? { ...item, name, updatedAt: now } : item));
        setState({ ...state, knowledgeBase: next });
    }

    async function uploadKnowledgeFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        if (!selectedKnowledgeBase) {
            setError("Crie ou selecione uma base de conhecimento antes de enviar arquivos.");
            return;
        }
        clearFeedback();
        const now = new Date().toISOString();
        const incoming = Array.from(files);
        const contentTasks = incoming.map(async (file) => ({
            sourceName: file.name,
            content: await readKnowledgeFileContent(file),
        }));
        const optimisticEntries = incoming.map((file, index) => ({
            id: `knowledge_upload_${Date.now()}_${index}`,
            title: file.name,
            type: detectKnowledgeType(file.name),
            description: "",
            sourceName: file.name,
            content: "",
            tags: [],
            processingStatus: "processing",
            createdAt: now,
            updatedAt: now,
        } as KnowledgeAsset));
        const optimisticIds = new Set<string>();
        const optimisticBySource = new Map<string, string>();
        const optimisticState: AiAgentsState = {
            ...state,
            knowledgeBase: state.knowledgeBase.map((base) => {
                if (base.id !== selectedKnowledgeBase.id) return base;
                const mergedFiles = [...base.files];
                for (const item of optimisticEntries) {
                    const existingIndex = mergedFiles.findIndex((entry) => entry.sourceName === item.sourceName);
                    if (existingIndex >= 0) {
                        const id = mergedFiles[existingIndex].id;
                        optimisticIds.add(id);
                        optimisticBySource.set(item.sourceName, id);
                        mergedFiles[existingIndex] = { ...mergedFiles[existingIndex], ...item, id, processingStatus: "processing" };
                    } else {
                        optimisticIds.add(item.id);
                        optimisticBySource.set(item.sourceName, item.id);
                        mergedFiles.push(item);
                    }
                }
                return { ...base, files: mergedFiles, updatedAt: now };
            }),
        };
        setState(optimisticState);
        setSaving(true);
        let uploadedVectorStoreIds: string[] = [];
        let uploadStatusesBySource = new Map<string, KnowledgeAsset["processingStatus"]>();
        try {
            const uploadResult = await uploadKnowledgeFilesToApi(selectedKnowledgeBase.id, selectedKnowledgeBase.name, incoming);
            uploadedVectorStoreIds = uploadResult.vectorStoreIds;
            uploadStatusesBySource = new Map(
                uploadResult.uploadedFiles.map((entry) => [entry.fileName, normalizeUploadStatus(entry.status)])
            );
        } catch (err) {
            const failedState: AiAgentsState = {
                ...optimisticState,
                knowledgeBase: optimisticState.knowledgeBase.map((base) => {
                    if (base.id !== selectedKnowledgeBase.id) return base;
                    return {
                        ...base,
                        files: base.files.map((entry) => (
                            optimisticIds.has(entry.id)
                                ? { ...entry, processingStatus: "failed", updatedAt: new Date().toISOString() }
                                : entry
                        )),
                    };
                }),
            };
            setState(failedState);
            setSaving(false);
            setError(err instanceof Error ? err.message : "Falha ao enviar arquivos para OpenAI.");
            return;
        }
        const localContent = await Promise.all(contentTasks);
        const contentBySource = new Map(localContent.map((item) => [item.sourceName, item.content]));
        const finalEntries = incoming.map((file, index) => {
            const sourceName = file.name;
            return {
                id: optimisticBySource.get(sourceName) ?? `knowledge_${Date.now()}_${index}`,
                title: file.name,
                type: detectKnowledgeType(file.name),
                description: "",
                sourceName,
                content: contentBySource.get(sourceName) ?? "",
                tags: [],
                processingStatus: uploadStatusesBySource.get(sourceName) ?? "processing",
                createdAt: now,
                updatedAt: now,
            } as KnowledgeAsset;
        });

        const next = optimisticState.knowledgeBase.map((base) => {
            if (base.id !== selectedKnowledgeBase.id) return base;
            const mergedFiles = [...base.files];
            for (const item of finalEntries) {
                const existingIndex = mergedFiles.findIndex((entry) => entry.id === item.id);
                if (existingIndex >= 0) {
                    mergedFiles[existingIndex] = { ...mergedFiles[existingIndex], ...item, id: mergedFiles[existingIndex].id };
                } else {
                    mergedFiles.push(item);
                }
            }
            const mergedVectorStoreIds = Array.from(new Set([...(base.vectorStoreIds ?? []), ...uploadedVectorStoreIds]));
            return { ...base, files: mergedFiles, vectorStoreIds: mergedVectorStoreIds, updatedAt: now };
        });
        const nextState = { ...optimisticState, knowledgeBase: next };
        try {
            const saved = await saveAiAgentsStateToApi(nextState);
            setState(saved);
            setSuccess("Arquivos enviados com sucesso.");
        } catch {
            setState(nextState);
            setError("Arquivos enviados, mas falhou ao sincronizar estado local no servidor.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <SystemPageLoader label="Carregando Agentes IA" description="Preparando agentes, modelos e automações..." />;
    }

    return (
        <section className="grid gap-4">
            <header className="sticky top-0 z-20 rounded-b-2xl border border-black/10 border-t-0 bg-white shadow-soft">
                <div className="flex flex-wrap items-center justify-end gap-3 border-b border-black/10 px-4 py-4 md:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={addProvider} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-medium text-io-dark">Novo provedor</button>
                        <button type="button" onClick={addAgent} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-medium text-io-dark">Novo agente</button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => persist(state, "Configurações de agentes IA salvas com sucesso.")} 
                            className="rounded-lg bg-io-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {saving ? "Salvando..." : "Salvar tudo"}
                        </button>
                    </div>
                </div>

                <div className="px-4 py-3 md:px-5">
                    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-black/10 bg-[#f3f5f9] p-1">
                        {([
                            ["providers", "Provedores"],
                            ["agents", "Agentes"],
                            ["knowledge", "Base de conhecimento"],
                        ] as Array<[Tab, string]>).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTab(value)}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                                    tab === value ? "bg-white text-io-dark shadow-sm" : "text-black/65 hover:bg-white"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {(error || success) && (
                    <div className="border-t border-black/10 px-4 py-3 md:px-5">
                        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        {success && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}
                    </div>
                )}
            </header>

            {tab === "providers" && (
                <div className="grid gap-4">
                    <section className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-io-dark">Google Calendar e Google Meet</p>
                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${googleStatusClasses(googleOauthStatus?.status ?? "")}`}>
                                        {googleOauthLoading ? "Carregando..." : googleStatusLabel(googleOauthStatus?.status ?? "")}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-black/60">
                                    Conecte a conta Google da empresa para consultar disponibilidade real e criar reuniões com Meet.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void refreshGoogleOAuthStatus(true)}
                                    disabled={googleOauthLoading || googleOauthSyncing}
                                    className="rounded-lg border border-black/15 bg-[#f3f5f9] px-3 py-2 text-sm font-medium text-io-dark disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Atualizar status
                                </button>
                                <button
                                    type="button"
                                    onClick={startGoogleOAuth}
                                    disabled={googleOauthSyncing}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {googleOauthSyncing ? "Abrindo..." : googleOauthStatus?.status === "CONNECTED" ? "Reconectar Google" : "Conectar Google"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void disconnectGoogleOAuth()}
                                    disabled={googleOauthSyncing || googleOauthStatus?.status !== "CONNECTED"}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Desconectar
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-black/70">
                            <p>
                                <span className="font-semibold text-io-dark">Conta conectada:</span>{" "}
                                {googleOauthStatus?.googleUserEmail || "Nenhuma conta conectada"}
                            </p>
                            <p>
                                <span className="font-semibold text-io-dark">Redirect URI esperado:</span>{" "}
                                <span className="text-xs">/api/integrations/google/oauth/callback</span>
                            </p>
                            <p className="text-xs text-black/55">
                                Configure esse caminho no Google Cloud Console dentro de Authorized redirect URIs, usando o domínio do frontend.
                            </p>
                        </div>
                    </section>

                    <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="rounded-2xl border border-black/10 bg-white p-3">
                            <p className="mb-2 text-sm font-semibold text-io-dark">Lista de provedores</p>
                            <div className="grid gap-2">
                                {state.providers.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedProviderId(item.id)}
                                        className={`rounded-xl border px-3 py-2 text-left text-sm ${selectedProviderId === item.id ? "border-io-purple bg-io-purple/10" : "border-black/10"}`}
                                    >
                                        <p className="font-semibold text-io-dark">{item.name || "Provedor sem nome"}</p>
                                        <p className="text-xs text-black/55">{item.type}</p>
                                    </button>
                                ))}
                            </div>
                        </aside>
                        <article className="rounded-2xl border border-black/10 bg-white p-4">
                            {!selectedProvider ? (
                                <p className="text-sm text-black/60">Selecione ou crie um provedor.</p>
                            ) : (
                                <div className="grid gap-3">
                                    <label className="grid gap-1 text-sm text-io-dark">
                                        Provedor
                                        <select value={selectedProvider.type} onChange={(e) => upsertProvider({ type: e.target.value as AiProviderType })} className="h-10 rounded-xl border px-3 text-sm">
                                            {providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                    </label>
                                    <label className="grid gap-1 text-sm text-io-dark">
                                        Chave da API
                                        <input value={selectedProvider.apiKey} onChange={(e) => upsertProvider({ apiKey: e.target.value })} placeholder="Chave" className="h-10 rounded-xl border px-3 text-sm" />
                                    </label>
                                    <label className="grid gap-1 text-sm text-io-dark">
                                        Nome
                                        <input value={selectedProvider.name} onChange={(e) => upsertProvider({ name: e.target.value })} placeholder="Nome" className="h-10 rounded-xl border px-3 text-sm" />
                                    </label>
                                    <div>
                                        <button type="button" onClick={deleteProvider} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Excluir provedor</button>
                                    </div>
                                </div>
                            )}
                        </article>
                    </div>
                </div>
            )}

            {tab === "agents" && (
                <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="rounded-2xl border border-black/10 bg-white p-3">
                        <p className="mb-2 text-sm font-semibold text-io-dark">Lista de agentes</p>
                        {(usersLoading || openAiCatalogLoading) && (
                            <div className="mb-2 rounded-xl border border-black/10 bg-[#f8f9fb] px-3 py-2 text-xs text-black/60">
                                Carregando dados da aba Agentes...
                            </div>
                        )}
                        <div className="grid gap-2">
                            {state.agents.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedAgentId(item.id)}
                                    className={`rounded-xl border px-3 py-2 text-left text-sm ${selectedAgentId === item.id ? "border-io-purple bg-io-purple/10" : "border-black/10"}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-io-dark">{item.name || "Agente sem nome"}</p>
                                            <p className="text-xs text-black/55">{item.isActive ? "Ativo" : "Inativo"}</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={item.isActive}
                                            aria-label={item.isActive ? "Desativar agente" : "Ativar agente"}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                const now = new Date().toISOString();
                                                setState((prev) => ({
                                                    ...prev,
                                                    agents: prev.agents.map((agent) =>
                                                        agent.id === item.id ? { ...agent, isActive: !agent.isActive, updatedAt: now } : agent
                                                    ),
                                                }));
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                                item.isActive ? "bg-io-purple" : "bg-black/25"
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                                    item.isActive ? "translate-x-5" : "translate-x-1"
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </aside>
                    <article className="grid gap-4">
                        {!selectedAgent ? (
                            <section className="rounded-2xl border border-black/10 bg-white p-4">
                                <p className="text-sm text-black/60">Selecione ou crie um agente.</p>
                            </section>
                        ) : (
                            <div className="grid gap-4">
                                <div className="rounded-2xl border border-black/10 bg-white p-4">
                                <div className="grid gap-3">
                                <input value={selectedAgent.name} onChange={(e) => upsertAgent({ name: e.target.value })} placeholder="Nome do agente" className="h-10 rounded-xl border px-3 text-sm" />
                                <div className="grid gap-2">
                                    <p className="text-sm font-semibold text-io-dark">Forma de comunicação *</p>
                                    <div className="flex flex-wrap gap-2">
                                        {communicationStyleOptions.map((item) => {
                                            const active = selectedCommunicationOption === item.value;
                                            return (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => upsertAgent({ communicationStyle: item.value === "__custom__" ? "" : item.value })}
                                                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                                        active ? "border-io-purple text-io-purple bg-white" : "border-black/15 text-io-dark bg-[#f3f5f9]"
                                                    }`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedCommunicationOption === "__custom__" && (
                                        <input
                                            value={selectedAgent.communicationStyle}
                                            onChange={(e) => upsertAgent({ communicationStyle: e.target.value })}
                                            placeholder="Digite a forma de comunicação personalizada"
                                            className="h-10 rounded-xl border px-3 text-sm"
                                        />
                                    )}
                                    <p className="text-sm text-black/60">{communicationHint}</p>
                                </div>

                                <div className="grid gap-2">
                                    <p className="text-sm font-semibold text-io-dark">Perfil do agente *</p>
                                    <div className="flex flex-wrap gap-2">
                                        {agentProfileOptions.map((item) => {
                                            const active = selectedProfileOption.toLowerCase() === item.toLowerCase();
                                            return (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => upsertAgent({ profile: item === "Outro" ? "" : item })}
                                                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                                        active ? "border-io-purple text-io-purple bg-white" : "border-black/15 text-io-dark bg-[#f3f5f9]"
                                                    }`}
                                                >
                                                    {item}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedProfileOption === "Outro" && (
                                        <input
                                            value={selectedAgent.profile}
                                            onChange={(e) => upsertAgent({ profile: e.target.value })}
                                            placeholder="Digite o perfil personalizado"
                                            className="h-10 rounded-xl border px-3 text-sm"
                                        />
                                    )}
                                </div>
                                <textarea value={selectedAgent.objective} onChange={(e) => upsertAgent({ objective: e.target.value })} placeholder="Objetivo do agente" className="min-h-[86px] rounded-xl border px-3 py-2 text-sm" />

                                <div className="grid gap-3 md:grid-cols-2">
                                    <select value={selectedAgent.providerId} onChange={(e) => upsertAgent({ providerId: e.target.value })} className="h-10 rounded-xl border px-3 text-sm">
                                        <option value="">Selecione provedor</option>
                                        {state.providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                    <select value={selectedAgent.knowledgeBaseId} onChange={(e) => upsertAgent({ knowledgeBaseId: e.target.value })} className="h-10 rounded-xl border px-3 text-sm">
                                        <option value="">Selecione base de conhecimento</option>
                                        {state.knowledgeBase.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                    {selectedAgentIsOpenAi ? (
                                        <select
                                            value={selectedAgent.reasoningModel}
                                            onChange={(e) => upsertAgent({ reasoningModel: e.target.value })}
                                            className="h-10 rounded-xl border px-3 text-sm"
                                            disabled={openAiCatalogLoading}
                                        >
                                            <option value="">{openAiCatalogLoading ? "Carregando modelos OpenAI..." : "Selecione modelo de raciocínio"}</option>
                                            {reasoningOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                        </select>
                                    ) : (
                                        <input value={selectedAgent.reasoningModel} onChange={(e) => upsertAgent({ reasoningModel: e.target.value })} placeholder="Modelo de raciocínio" className="h-10 rounded-xl border px-3 text-sm" />
                                    )}
                                    {selectedAgentIsOpenAi ? (
                                        <select
                                            value={selectedAgent.modelVersion}
                                            onChange={(e) => upsertAgent({ modelVersion: e.target.value })}
                                            className="h-10 rounded-xl border px-3 text-sm"
                                            disabled={openAiCatalogLoading}
                                        >
                                            <option value="">{openAiCatalogLoading ? "Carregando modelos OpenAI..." : "Selecione versão do modelo"}</option>
                                            {modelVersionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                        </select>
                                    ) : (
                                        <input value={selectedAgent.modelVersion} onChange={(e) => upsertAgent({ modelVersion: e.target.value })} placeholder="Versão do modelo" className="h-10 rounded-xl border px-3 text-sm" />
                                    )}
                                    <select value={selectedAgent.transferUserId} onChange={(e) => upsertAgent({ transferUserId: e.target.value })} className="h-10 rounded-xl border px-3 text-sm" disabled={usersLoading}>
                                        <option value="">{usersLoading ? "Carregando usuários..." : "Usuário para transferência"}</option>
                                        {users.map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.email})</option>)}
                                    </select>
                                </div>
                                {selectedAgentIsOpenAi && !openAiCatalogLoading && openAiCatalogLoaded && reasoningOptions.length === 0 && modelVersionOptions.length === 0 && (
                                    <p className="text-xs text-black/60">
                                        Nenhum modelo OpenAI disponível. Configure a chave no provedor OpenAI salvo ou em OPENAI_API_KEY na API.
                                    </p>
                                )}

                                <div className="grid gap-3">
                                    <div className="rounded-xl border border-black/10 bg-white p-3">
                                        <p className="text-sm font-semibold text-io-dark">Temperatura / Nível de criatividade *</p>
                                        <div className="mt-2 flex items-center justify-between text-base font-semibold text-io-purple">
                                            <span>Restrito</span>
                                            <span>Criativo</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={2}
                                            step={0.1}
                                            value={selectedAgent.temperature}
                                            onChange={(e) => upsertAgent({ temperature: Number(e.target.value) })}
                                            className="mt-3 h-2 w-full cursor-pointer accent-io-purple"
                                        />
                                        <p className="mt-3 text-sm text-black/65">{getTemperatureHint(selectedAgent.temperature)}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <label className="grid gap-1 text-xs text-black/65">Limite de tokens
                                        <input type="number" min={100} max={20000} value={selectedAgent.maxTokensPerMessage} onChange={(e) => upsertAgent({ maxTokensPerMessage: Number(e.target.value) })} className="h-10 rounded-xl border px-3 text-sm" />
                                    </label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="grid gap-1 text-xs text-black/65">Delay da resposta (s)
                                            <input type="number" min={0} max={30} value={selectedAgent.delayMessageSeconds} onChange={(e) => upsertAgent({ delayMessageSeconds: Number(e.target.value) })} className="h-10 rounded-xl border px-3 text-sm" />
                                        </label>
                                        <label className="grid gap-1 text-xs text-black/65">Delay digitando (s)
                                            <input type="number" min={0} max={30} value={selectedAgent.delayTypingSeconds} onChange={(e) => upsertAgent({ delayTypingSeconds: Number(e.target.value) })} className="h-10 rounded-xl border px-3 text-sm" />
                                        </label>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <div className="rounded-xl border border-black/10 bg-[#f8f9fb] p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-io-dark">Habilidades do agente</p>
                                            <button
                                                type="button"
                                                onClick={() => setIsCapabilityPickerOpen(true)}
                                                className="grid h-7 w-7 place-items-center rounded-lg border border-black/15 bg-white text-base font-semibold leading-none text-io-dark"
                                                aria-label="Adicionar habilidade"
                                                title="Adicionar habilidade"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <p className="mt-1 text-xs text-black/60">
                                            Sem habilidade selecionada, o agente apenas conversa com o contato.
                                        </p>
                                        {selectedCapabilities.some((item) => item.key === "schedule_google_meeting") && googleOauthStatus?.status !== "CONNECTED" && (
                                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                A habilidade de agendamento está ativa, mas a conta Google da empresa ainda não está conectada. Sem isso, o backend bloqueia o agendamento.
                                            </div>
                                        )}
                                        <div className="mt-3 grid gap-2">
                                            {selectedCapabilities.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-black/20 bg-white p-3 text-sm text-black/55">
                                                    Nenhuma habilidade selecionada.
                                                </div>
                                            ) : (
                                                selectedCapabilities.map((capability) => {
                                                    const configs = getAgentCapabilityConfigs(selectedAgent);
                                                    const stagePrompts = configs.kanbanMoveCardStagePrompts;
                                                    const configuredStagePrompts = crmStages.length > 0
                                                        ? crmStages.filter((stage) => (stagePrompts[stage.id] ?? "").trim().length > 0).length
                                                        : Object.values(stagePrompts).filter((value) => value.trim().length > 0).length;
                                                    const stageSummary = crmStages.length > 0
                                                        ? `${configuredStagePrompts}/${crmStages.length} etapas com prompt`
                                                        : `${configuredStagePrompts} prompt(s) configurado(s)`;
                                                    const crmFieldSummary = `${configs.crmFieldIdsToFill.length} campo(s) selecionado(s)`;
                                                    const googleSummary = googleOauthStatus?.status === "CONNECTED"
                                                        ? `Google conectado: ${googleOauthStatus.googleUserEmail || "conta ativa"}`
                                                        : "Requer Google conectado na aba Provedores";
                                                    const setupSummary = capability.key === "kanban_move_card"
                                                        ? stageSummary
                                                        : capability.key === "crm_update_contact_data"
                                                            ? crmFieldSummary
                                                            : googleSummary;

                                                    return (
                                                        <div key={capability.key} className="rounded-xl border border-black/10 bg-white p-3">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-io-dark">{capability.label}</p>
                                                                    <p className="text-xs text-black/60">{capability.description}</p>
                                                                    <p className="mt-1 text-xs font-medium text-black/70">{setupSummary}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openCapabilitySetup(capability.key)}
                                                                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                                                            capability.key === "schedule_google_meeting"
                                                                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                                : "border border-io-purple/25 bg-io-purple/10 text-io-purple"
                                                                        }`}
                                                                    >
                                                                        {capability.setupLabel}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeCapability(capability)}
                                                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                                                                    >
                                                                        Remover
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                    <textarea
                                        value={formatMultiline(getMergedRulesRestrictions(selectedAgent))}
                                        onChange={(e) => upsertAgent({ rules: parseMultilinePreserve(e.target.value), restrictions: [] })}
                                        placeholder="Regras e restrições (uma por linha)"
                                        className="min-h-[120px] rounded-xl border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <button type="button" onClick={deleteAgent} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Excluir agente</button>
                                </div>
                                </div>
                                </div>

                                <div className="rounded-2xl border border-black/10 bg-white">
                                    <div className="border-b border-black/10 p-4">
                                        <p className="text-3xl font-semibold text-io-dark">Comportamento</p>
                                        <p className="text-xl text-io-dark">Etapas:</p>
                                    </div>
                                    <div className="border-b border-black/10 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-io-dark">Estágios da conversa</p>
                                        </div>
                                        <p className="text-sm text-black/60">Defina as etapas que o agente deve seguir durante a conversa.</p>
                                    </div>
                                    <div className="grid gap-3 p-4">
                                        {selectedAgent.stageBehaviors.map((item, index) => (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(event) => {
                                                    event.dataTransfer.setData("text/plain", item.id);
                                                    event.dataTransfer.effectAllowed = "move";
                                                }}
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect = "move";
                                                }}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    const draggedId = event.dataTransfer.getData("text/plain");
                                                    reorderStageBehaviors(draggedId, item.id);
                                                }}
                                                className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                                            >
                                                <div className="grid place-items-center text-black/45" title="Arraste para reordenar">
                                                    <span className="cursor-grab text-xl leading-none active:cursor-grabbing">&#8942;</span>
                                                </div>
                                                <div className="rounded-xl border border-black/15 bg-[#f8f9fb] p-3">
                                                    <p className="mb-2 text-sm font-semibold text-io-dark">Passo {index + 1}:</p>
                                                    <textarea value={item.instruction} onChange={(e) => updateStageBehavior(item.id, { instruction: e.target.value })} placeholder="Conteúdo da etapa" className="min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm" />
                                                </div>
                                                <div className="grid place-items-center">
                                                    <button type="button" onClick={() => deleteStageBehavior(item.id)} className="grid h-8 w-8 place-items-center rounded-full border border-black/25 text-black/60 transition hover:border-red-300 hover:text-red-700">×</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-black/10 px-4 py-3">
                                        <div className="flex justify-end">
                                            <button type="button" onClick={addStageBehavior} className="rounded-lg bg-io-purple px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Adicionar estágio</button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </article>
                </div>
            )}

            {tab === "agents" && selectedAgent && isCapabilityPickerOpen && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
                            <div>
                                <p className="text-lg font-semibold text-io-dark">Adicionar habilidade</p>
                                <p className="text-sm text-black/60">
                                    Selecione o que este agente poderá fazer além de conversar com o contato.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCapabilityPickerOpen(false)}
                                className="grid h-8 w-8 place-items-center rounded-full border border-black/20 text-black/60"
                                aria-label="Fechar popup"
                            >
                                x
                            </button>
                        </div>
                        <div className="grid gap-3 p-4">
                            {availableCapabilities.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/20 p-3 text-sm text-black/55">
                                    Todas as habilidades disponíveis já foram adicionadas.
                                </div>
                            ) : (
                                availableCapabilities.map((capability) => (
                                    <div key={capability.key} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/10 p-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-io-dark">{capability.label}</p>
                                            <p className="text-xs text-black/60">{capability.description}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addCapability(capability)}
                                            className="rounded-lg border border-io-purple/30 bg-io-purple/10 px-3 py-1.5 text-xs font-semibold text-io-purple"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "agents" && selectedAgent && activeCapabilitySetup === "kanban_move_card" && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
                            <div>
                                <p className="text-lg font-semibold text-io-dark">Configurar habilidade: Mover cards no Kanban</p>
                                <p className="text-sm text-black/60">
                                    Defina um prompt por etapa para orientar quando o agente deve mover o card do lead.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCapabilitySetup}
                                className="grid h-8 w-8 place-items-center rounded-full border border-black/20 text-black/60"
                                aria-label="Fechar popup"
                            >
                                x
                            </button>
                        </div>
                        <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-4">
                            {crmMetaLoading ? (
                                <p className="text-sm text-black/60">Carregando etapas do Kanban...</p>
                            ) : crmStages.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/20 p-3 text-sm text-black/55">
                                    Nenhuma etapa encontrada no CRM. Crie as colunas no Kanban para configurar os prompts.
                                </div>
                            ) : (
                                crmStages
                                    .slice()
                                    .sort((a, b) => a.order - b.order)
                                    .map((stage) => (
                                        <label key={stage.id} className="grid gap-1">
                                            <span className="text-sm font-semibold text-io-dark">{stage.title}</span>
                                            <textarea
                                                value={getAgentCapabilityConfigs(selectedAgent).kanbanMoveCardStagePrompts[stage.id] ?? ""}
                                                onChange={(event) => updateKanbanStagePrompt(stage.id, event.target.value)}
                                                placeholder={`Ex: Mover para "${stage.title}" quando o lead confirmar interesse nesta etapa.`}
                                                className="min-h-[92px] rounded-xl border px-3 py-2 text-sm"
                                            />
                                        </label>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "agents" && selectedAgent && activeCapabilitySetup === "crm_update_contact_data" && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
                            <div>
                                <p className="text-lg font-semibold text-io-dark">Configurar habilidade: Atualizar dados do contato no CRM</p>
                                <p className="text-sm text-black/60">
                                    Selecione quais campos do card o agente deve preencher até o fim da conversa.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCapabilitySetup}
                                className="grid h-8 w-8 place-items-center rounded-full border border-black/20 text-black/60"
                                aria-label="Fechar popup"
                            >
                                x
                            </button>
                        </div>
                        <div className="grid max-h-[70vh] gap-2 overflow-y-auto p-4">
                            {crmMetaLoading ? (
                                <p className="text-sm text-black/60">Carregando campos do CRM...</p>
                            ) : crmCustomFields.length === 0 ? (
                                <div className="grid gap-3 rounded-xl border border-dashed border-black/20 p-3 text-sm text-black/55">
                                    <p>Nenhum campo personalizado encontrado no card do CRM.</p>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => { window.location.href = "/protected/crm"; }}
                                            className="rounded-lg border border-io-purple/30 bg-io-purple/10 px-3 py-1.5 text-xs font-semibold text-io-purple"
                                        >
                                            Configurar campos no CRM
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                crmCustomFields
                                    .slice()
                                    .sort((a, b) => a.order - b.order)
                                    .map((field) => {
                                        const checked = getAgentCapabilityConfigs(selectedAgent).crmFieldIdsToFill.includes(field.id);
                                        return (
                                            <label key={field.id} className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => toggleCrmFieldSelection(field.id, event.target.checked)}
                                                    className="h-4 w-4"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-io-dark">{field.label}</p>
                                                    <p className="text-xs text-black/55">Tipo: {field.type}</p>
                                                </div>
                                            </label>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "knowledge" && (
                <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="rounded-2xl border border-black/10 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-io-dark">Lista de bases</p>
                                <button
                                    type="button"
                                    onClick={createKnowledgeBase}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-black/15 bg-[#f3f5f9] text-base font-semibold leading-none text-io-dark"
                                    aria-label="Nova base"
                                    title="Nova base"
                                >
                                    +
                                </button>
                            </div>
                            <div className="grid gap-2">
                                {state.knowledgeBase.length === 0 ? (
                                    <p className="text-sm text-black/60">Nenhuma base criada.</p>
                                ) : (
                                    state.knowledgeBase.map((base) => (
                                        <button
                                            key={base.id}
                                            type="button"
                                            onClick={() => setSelectedKnowledgeBaseId(base.id)}
                                            className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                                selectedKnowledgeBaseId === base.id ? "border-io-purple bg-io-purple/10" : "border-black/10"
                                            }`}
                                        >
                                            <p className="truncate font-semibold text-io-dark">{base.name}</p>
                                            <p className="text-xs text-black/55">{base.files.length} arquivo(s)</p>
                                        </button>
                                    ))
                                )}
                            </div>
                        </aside>

                        <section className="rounded-2xl border border-black/10 bg-white p-4">
                            {!selectedKnowledgeBase ? (
                                <p className="text-sm text-black/60">Selecione uma base para gerenciar os arquivos.</p>
                            ) : (
                                <div className="grid gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            value={selectedKnowledgeBase.name}
                                            onChange={(e) => renameKnowledgeBase(selectedKnowledgeBase.id, e.target.value)}
                                            placeholder="Nome da base"
                                            className="h-10 flex-1 rounded-xl border px-3 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => deleteKnowledgeBase(selectedKnowledgeBase.id)}
                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                                        >
                                            Excluir base
                                        </button>
                                    </div>

                                    <label className="grid gap-2">
                                        <span className="text-sm text-black/65">Enviar arquivo(s) para esta base</span>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={(e) => void uploadKnowledgeFiles(e.target.files)}
                                            className="h-11 rounded-xl border border-black/15 bg-[#f8f9fb] px-3 py-2 text-sm"
                                        />
                                    </label>

                                    <div className="grid gap-2">
                                        {selectedKnowledgeBase.files.length === 0 ? (
                                            <p className="text-sm text-black/60">Nenhum arquivo nesta base.</p>
                                        ) : (
                                            selectedKnowledgeBase.files.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-io-dark">{item.sourceName || item.title}</p>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <p className="text-xs text-black/55">{item.type}</p>
                                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(item.processingStatus)}`}>
                                                                {statusLabel(item.processingStatus)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const next = state.knowledgeBase.map((base) => {
                                                                if (base.id !== selectedKnowledgeBase.id) return base;
                                                                return {
                                                                    ...base,
                                                                    files: base.files.filter((entry) => entry.id !== item.id),
                                                                    updatedAt: new Date().toISOString(),
                                                                };
                                                            });
                                                            setState({ ...state, knowledgeBase: next });
                                                        }}
                                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}

        </section>
    );
}
