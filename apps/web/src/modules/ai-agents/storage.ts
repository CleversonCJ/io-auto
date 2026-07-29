"use client";

export type AiProviderType = "openai" | "anthropic" | "google" | "meta" | "azure-openai" | "custom";

export type AiProvider = {
    id: string;
    name: string;
    type: AiProviderType;
    apiBaseUrl: string;
    apiKey: string;
    modelFamily: string;
    modelVersion: string;
    reasoningModel: string;
    createdAt: string;
    updatedAt: string;
};

export type AiAgentStageBehavior = {
    id: string;
    stage: string;
    instruction: string;
};

export type AiAgentCapabilityConfigs = {
    kanbanMoveCardStagePrompts: Record<string, string>;
    crmFieldIdsToFill: string[];
};

export type AiAgent = {
    id: string;
    name: string;
    communicationStyle: string;
    profile: string;
    objective: string;
    stageBehaviors: AiAgentStageBehavior[];
    skills: string[];
    capabilityConfigs: AiAgentCapabilityConfigs;
    rules: string[];
    restrictions: string[];
    providerId: string;
    knowledgeBaseId: string;
    reasoningModel: string;
    modelVersion: string;
    temperature: number;
    transferUserId: string;
    maxTokensPerMessage: number;
    delayMessageSeconds: number;
    delayTypingSeconds: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type KnowledgeAssetType = "pdf" | "txt" | "spreadsheet" | "doc" | "url" | "other";
export type KnowledgeAssetProcessingStatus = "processing" | "ready" | "failed";

export type KnowledgeAsset = {
    id: string;
    title: string;
    type: KnowledgeAssetType;
    description: string;
    sourceName: string;
    content: string;
    tags: string[];
    processingStatus: KnowledgeAssetProcessingStatus;
    createdAt: string;
    updatedAt: string;
};

export type KnowledgeBase = {
    id: string;
    name: string;
    vectorStoreIds: string[];
    files: KnowledgeAsset[];
    createdAt: string;
    updatedAt: string;
};

export type AiAgentsState = {
    providers: AiProvider[];
    agents: AiAgent[];
    knowledgeBase: KnowledgeBase[];
};

export type OpenAiModelCatalog = {
    modelVersions: string[];
    reasoningModels: string[];
};

export type GoogleOAuthStatus = {
    companyId: string;
    googleUserEmail: string;
    scopes: string;
    status: "CONNECTED" | "DISCONNECTED" | "ERROR";
    updatedAt: string;
};

export type KnowledgeUploadResult = {
    knowledgeBaseId: string;
    vectorStoreIds: string[];
    uploadedFiles: Array<{
        fileName: string;
        openAiFileId: string;
        vectorStoreId: string;
        status: string;
    }>;
};

export const EMPTY_AI_AGENTS_STATE: AiAgentsState = {
    providers: [],
    agents: [],
    knowledgeBase: [],
};

function asString(value: unknown) {
    return String(value ?? "").trim();
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => asString(item)).filter(Boolean);
}

function asStringMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object") return {};
    const next: Record<string, string> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        const normalizedKey = asString(key);
        if (!normalizedKey) continue;
        next[normalizedKey] = asString(item);
    }
    return next;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeProviderType(value: unknown): AiProviderType {
    const normalized = asString(value).toLowerCase();
    if (["openai", "anthropic", "google", "meta", "azure-openai", "custom"].includes(normalized)) {
        return normalized as AiProviderType;
    }
    return "custom";
}

function normalizeKnowledgeType(value: unknown): KnowledgeAssetType {
    const normalized = asString(value).toLowerCase();
    if (["pdf", "txt", "spreadsheet", "doc", "url", "other"].includes(normalized)) {
        return normalized as KnowledgeAssetType;
    }
    return "other";
}

function normalizeStageBehavior(raw: unknown, index: number): AiAgentStageBehavior | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const stage = asString(source.stage);
    const instruction = asString(source.instruction);
    const id = asString(source.id) || `stage_behavior_${Date.now()}_${index}`;
    if (!stage && !instruction) return null;
    return { id, stage, instruction };
}

function normalizeProvider(raw: unknown, index: number): AiProvider | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const id = asString(source.id) || `provider_${Date.now()}_${index}`;
    const name = asString(source.name);
    if (!name) return null;
    const now = new Date().toISOString();
    return {
        id,
        name,
        type: normalizeProviderType(source.type),
        apiBaseUrl: asString(source.apiBaseUrl),
        apiKey: asString(source.apiKey),
        modelFamily: asString(source.modelFamily),
        modelVersion: asString(source.modelVersion),
        reasoningModel: asString(source.reasoningModel),
        createdAt: asString(source.createdAt) || now,
        updatedAt: asString(source.updatedAt) || now,
    };
}

function normalizeAgent(raw: unknown, index: number): AiAgent | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const id = asString(source.id) || `agent_${Date.now()}_${index}`;
    const name = asString(source.name);
    if (!name) return null;
    const now = new Date().toISOString();
    const stageBehaviorsRaw = Array.isArray(source.stageBehaviors) ? source.stageBehaviors : [];
    const stageBehaviors = stageBehaviorsRaw
        .map((item, itemIndex) => normalizeStageBehavior(item, itemIndex))
        .filter((item): item is AiAgentStageBehavior => Boolean(item));

    return {
        id,
        name,
        communicationStyle: asString(source.communicationStyle),
        profile: asString(source.profile),
        objective: asString(source.objective),
        stageBehaviors,
        skills: asStringArray(source.skills),
        capabilityConfigs: {
            kanbanMoveCardStagePrompts: asStringMap(source.capabilityConfigs && typeof source.capabilityConfigs === "object"
                ? (source.capabilityConfigs as Record<string, unknown>).kanbanMoveCardStagePrompts
                : undefined),
            crmFieldIdsToFill: asStringArray(source.capabilityConfigs && typeof source.capabilityConfigs === "object"
                ? (source.capabilityConfigs as Record<string, unknown>).crmFieldIdsToFill
                : undefined),
        },
        rules: asStringArray(source.rules),
        restrictions: asStringArray(source.restrictions),
        providerId: asString(source.providerId),
        knowledgeBaseId: asString(source.knowledgeBaseId),
        reasoningModel: asString(source.reasoningModel),
        modelVersion: asString(source.modelVersion),
        temperature: clampNumber(source.temperature, 1, 0, 2),
        transferUserId: asString(source.transferUserId),
        maxTokensPerMessage: Math.round(clampNumber(source.maxTokensPerMessage, 1200, 100, 20000)),
        delayMessageSeconds: Math.round(clampNumber(source.delayMessageSeconds, 2, 0, 30)),
        delayTypingSeconds: Math.round(clampNumber(source.delayTypingSeconds ?? source.typingSimulationSeconds, 2, 0, 30)),
        isActive: Boolean(source.isActive ?? true),
        createdAt: asString(source.createdAt) || now,
        updatedAt: asString(source.updatedAt) || now,
    };
}

function normalizeKnowledge(raw: unknown, index: number): KnowledgeAsset | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const id = asString(source.id) || `knowledge_${Date.now()}_${index}`;
    const title = asString(source.title);
    if (!title) return null;
    const now = new Date().toISOString();
    const rawStatus = asString(source.processingStatus).toLowerCase();
    const processingStatus: KnowledgeAssetProcessingStatus =
        rawStatus === "processing" || rawStatus === "failed" ? rawStatus : "ready";
    return {
        id,
        title,
        type: normalizeKnowledgeType(source.type),
        description: asString(source.description),
        sourceName: asString(source.sourceName),
        content: asString(source.content),
        tags: asStringArray(source.tags),
        processingStatus,
        createdAt: asString(source.createdAt) || now,
        updatedAt: asString(source.updatedAt) || now,
    };
}

function normalizeKnowledgeBase(raw: unknown, index: number): KnowledgeBase | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const now = new Date().toISOString();
    const id = asString(source.id) || `knowledge_base_${Date.now()}_${index}`;
    const name = asString(source.name) || `Base ${index + 1}`;
    const filesRaw = Array.isArray(source.files) ? source.files : [];
    const files = filesRaw
        .map((item, itemIndex) => normalizeKnowledge(item, itemIndex))
        .filter((item): item is KnowledgeAsset => Boolean(item));
    return {
        id,
        name,
        vectorStoreIds: (() => {
            const ids = asStringArray(source.vectorStoreIds);
            if (ids.length) return ids;
            const legacyId = asString(source.vectorStoreId);
            return legacyId ? [legacyId] : [];
        })(),
        files,
        createdAt: asString(source.createdAt) || now,
        updatedAt: asString(source.updatedAt) || now,
    };
}

export function sanitizeAiAgentsState(raw: unknown): AiAgentsState {
    const source = (raw ?? {}) as Record<string, unknown>;
    const providersRaw = Array.isArray(source.providers) ? source.providers : [];
    const agentsRaw = Array.isArray(source.agents) ? source.agents : [];
    const knowledgeRaw = Array.isArray(source.knowledgeBase) ? source.knowledgeBase : [];
    const hasBucketShape = knowledgeRaw.some((item) => {
        if (!item || typeof item !== "object") return false;
        return Array.isArray((item as Record<string, unknown>).files);
    });
    const knowledgeBase = hasBucketShape
        ? knowledgeRaw
            .map((item, index) => normalizeKnowledgeBase(item, index))
            .filter((item): item is KnowledgeBase => Boolean(item))
        : (() => {
            const files = knowledgeRaw
                .map((item, index) => normalizeKnowledge(item, index))
                .filter((item): item is KnowledgeAsset => Boolean(item));
            if (files.length === 0) return [] as KnowledgeBase[];
            return [
                {
                    id: "knowledge_base_default",
                    name: "Base principal",
                    vectorStoreIds: [],
                    files,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ];
        })();

    return {
        providers: providersRaw
            .map((item, index) => normalizeProvider(item, index))
            .filter((item): item is AiProvider => Boolean(item)),
        agents: agentsRaw
            .map((item, index) => normalizeAgent(item, index))
            .filter((item): item is AiAgent => Boolean(item)),
        knowledgeBase,
    };
}

export async function loadAiAgentsStateFromApi(): Promise<AiAgentsState> {
    const res = await fetch("/api/ai-agents/state", { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar configurações de agentes IA.");
    const data = await res.json().catch(() => ({}));
    return sanitizeAiAgentsState(data);
}

export async function saveAiAgentsStateToApi(state: AiAgentsState): Promise<AiAgentsState> {
    const sanitized = sanitizeAiAgentsState(state);
    const res = await fetch("/api/ai-agents/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitized),
    });
    if (!res.ok) throw new Error("Falha ao salvar configurações de agentes IA.");
    const data = await res.json().catch(() => sanitized);
    return sanitizeAiAgentsState(data);
}

export async function loadOpenAiModelCatalogFromApi(): Promise<OpenAiModelCatalog> {
    const res = await fetch("/api/ai-agents/openai-models", { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar catálogo de modelos OpenAI.");
    const data = (await res.json().catch(() => ({}))) as {
        modelVersions?: unknown;
        reasoningModels?: unknown;
    };
    return {
        modelVersions: asStringArray(data.modelVersions),
        reasoningModels: asStringArray(data.reasoningModels),
    };
}

export async function loadGoogleOAuthStatusFromApi(): Promise<GoogleOAuthStatus> {
    const res = await fetch("/api/integrations/google/oauth/status", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(asString(data.message) || "Falha ao carregar status da integração Google.");
    const rawStatus = asString(data.status).toUpperCase();
    const status: GoogleOAuthStatus["status"] =
        rawStatus === "CONNECTED" || rawStatus === "ERROR" ? rawStatus : "DISCONNECTED";
    return {
        companyId: asString(data.companyId),
        googleUserEmail: asString(data.googleUserEmail),
        scopes: asString(data.scopes),
        status,
        updatedAt: asString(data.updatedAt),
    };
}

export async function disconnectGoogleOAuthFromApi(): Promise<void> {
    const res = await fetch("/api/integrations/google/oauth/disconnect", {
        method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(asString(data.message) || "Falha ao desconectar a integração Google.");
}

export async function uploadKnowledgeFilesToApi(knowledgeBaseId: string, knowledgeBaseName: string, files: File[]): Promise<KnowledgeUploadResult> {
    if (!knowledgeBaseId.trim()) throw new Error("Base de conhecimento inválida.");
    if (!files.length) throw new Error("Selecione ao menos um arquivo.");

    const form = new FormData();
    form.append("knowledgeBaseId", knowledgeBaseId.trim());
    if (knowledgeBaseName.trim()) form.append("knowledgeBaseName", knowledgeBaseName.trim());
    for (const file of files) form.append("files", file);

    const res = await fetch("/api/ai-agents/knowledge-upload", {
        method: "POST",
        body: form,
    });

    const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        knowledgeBaseId?: unknown;
        vectorStoreIds?: unknown;
        uploadedFiles?: unknown;
    };
    if (!res.ok) throw new Error(asString(data.message) || "Falha ao enviar arquivos para OpenAI.");

    const uploadedRaw = Array.isArray(data.uploadedFiles) ? data.uploadedFiles : [];
    const uploadedFiles = uploadedRaw
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const source = item as Record<string, unknown>;
            return {
                fileName: asString(source.fileName),
                openAiFileId: asString(source.openAiFileId),
                vectorStoreId: asString(source.vectorStoreId),
                status: asString(source.status) || "in_progress",
            };
        })
        .filter((item): item is KnowledgeUploadResult["uploadedFiles"][number] => Boolean(item));

    return {
        knowledgeBaseId: asString(data.knowledgeBaseId),
        vectorStoreIds: asStringArray(data.vectorStoreIds),
        uploadedFiles,
    };
}

export function buildMegaPrompt(agent: AiAgent, provider: AiProvider | null, knowledgeBase: KnowledgeBase[]): string {
    const lines: string[] = [];

    lines.push("# IDENTIDADE DO AGENTE");
    lines.push(`Nome: ${agent.name || "Não informado"}`);
    lines.push(`Perfil: ${agent.profile || "Não informado"}`);
    lines.push(`Objetivo principal: ${agent.objective || "Não informado"}`);
    lines.push(`Forma de comunicação: ${agent.communicationStyle || "Não informado"}`);

    lines.push("\n# PROVEDOR E MODELO");
    lines.push(`Provedor: ${provider?.name || "Não definido"}`);
    lines.push(`Tipo de provedor: ${provider?.type || "Não definido"}`);
    lines.push(`Modelo de raciocínio: ${agent.reasoningModel || provider?.reasoningModel || "Não definido"}`);
    lines.push(`Versão de modelo: ${agent.modelVersion || provider?.modelVersion || "Não definida"}`);
    lines.push(`Temperatura (treinamento/criatividade): ${agent.temperature}`);
    lines.push(`Limite de tokens por mensagem: ${agent.maxTokensPerMessage}`);
    lines.push(`Delay para agrupar mensagens do contato (segundos): ${agent.delayMessageSeconds}`);
    lines.push(`Tempo de digitação antes de enviar (segundos): ${agent.delayTypingSeconds}`);

    lines.push("\n# HABILIDADES");
    if (agent.skills.length === 0) {
        lines.push("- Sem habilidades configuradas.");
    } else {
        for (const skill of agent.skills) lines.push(`- ${skill}`);
    }

    lines.push("\n# REGRAS E RESTRIÇÕES");
    const mergedRules = Array.from(new Set([...(agent.rules ?? []), ...(agent.restrictions ?? [])]));
    if (mergedRules.length === 0) {
        lines.push("- Sem regras e restrições configuradas.");
    } else {
        for (const item of mergedRules) lines.push(`- ${item}`);
    }

    lines.push("\n# COMPORTAMENTO POR ETAPAS DA CONVERSA");
    if (agent.stageBehaviors.length === 0) {
        lines.push("- Sem etapas configuradas.");
    } else {
        for (const stage of agent.stageBehaviors) {
            lines.push(`- Etapa: ${stage.stage || "Sem nome"}`);
            lines.push(`  Instrução: ${stage.instruction || "Sem instrução"}`);
        }
    }

    lines.push("\n# TRANSFERÊNCIA HUMANA");
    lines.push(`Em caso de erro ou solicitação do contato, transferir para usuário ID: ${agent.transferUserId || "Não definido"}.`);
    lines.push(`Base de conhecimento vinculada ao agente: ${agent.knowledgeBaseId || "Não definida"}.`);

    lines.push("\n# BASE DE CONHECIMENTO DISPONÍVEL");
    if (knowledgeBase.length === 0) {
        lines.push("- Nenhum material cadastrado.");
    } else {
        for (const base of knowledgeBase) {
            lines.push(`- Base: ${base.name}`);
            if (!base.files.length) {
                lines.push("  - Sem arquivos.");
                continue;
            }
            for (const item of base.files) {
                lines.push(`  - [${item.type.toUpperCase()}] ${item.title}`);
                if (item.description) lines.push(`    Contexto: ${item.description}`);
                if (item.sourceName) lines.push(`    Origem: ${item.sourceName}`);
                if (item.tags.length) lines.push(`    Tags: ${item.tags.join(", ")}`);
                if (item.content) lines.push(`    Conteúdo para consulta: ${item.content}`);
            }
        }
    }

    lines.push("\n# INSTRUÇÃO FINAL DE OPERAÇÃO");
    lines.push("Use este contexto para responder com precisão, empatia e objetividade, respeitando regras e restrições. Consulte a base de conhecimento antes de responder dúvidas específicas do negócio.");

    return lines.join("\n");
}
