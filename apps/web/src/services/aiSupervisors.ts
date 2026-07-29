"use client";

import { sanitizeAiAgentsState } from "@/modules/ai-agents/storage";

export type SupervisorAction = "ASSIGN_AGENT" | "ASK_CLARIFYING" | "HANDOFF_HUMAN" | "NO_ACTION";
export type SupervisorProvider = "openai" | "anthropic" | "google" | "meta" | "azure-openai" | "custom";

export type AiSupervisorDistributionAgentRule = {
    agentId: string;
    agentName: string;
    enabled: boolean;
    triageText: string;
    updatedAt: string;
};

export type AiSupervisorDistribution = {
    otherRules: string;
    agents: AiSupervisorDistributionAgentRule[];
};

export type AiSupervisor = {
    id: string;
    name: string;
    communicationStyle: string;
    profile: string;
    objective: string;
    reasoningModelVersion: string;
    provider: string;
    model: string;
    humanHandoffEnabled: boolean;
    notifyContactOnAgentTransfer: boolean;
    humanHandoffTeam: string;
    humanHandoffSendMessage: boolean;
    humanHandoffMessage: string;
    agentIssueHandoffTeam: string;
    agentIssueSendMessage: boolean;
    humanUserChoiceEnabled: boolean;
    humanChoiceOptions: string[];
    enabled: boolean;
    defaultForCompany: boolean;
    distribution: AiSupervisorDistribution;
    createdAt: string;
    updatedAt: string;
};

export type AiSupervisorUpsertPayload = {
    name: string;
    communicationStyle: string;
    profile: string;
    objective: string;
    reasoningModelVersion: string;
    provider: string;
    model: string;
    humanHandoffEnabled: boolean;
    notifyContactOnAgentTransfer: boolean;
    humanHandoffTeam: string;
    humanHandoffSendMessage: boolean;
    humanHandoffMessage: string;
    agentIssueHandoffTeam: string;
    agentIssueSendMessage: boolean;
    humanUserChoiceEnabled: boolean;
    humanChoiceOptions: string[];
    enabled: boolean;
    defaultForCompany: boolean;
};

export type AiSupervisorDistributionPayload = {
    otherRules: string;
    agents: Array<{
        agentId: string;
        enabled: boolean;
        triageText: string;
    }>;
};

export type DistributionAgentOption = {
    id: string;
    name: string;
    providerId: string;
    reasoningModel: string;
    modelVersion: string;
    isActive: boolean;
};

export type SupervisorSimulationDecision = {
    action: SupervisorAction;
    targetAgentId: string | null;
    targetAgentName: string | null;
    messageToSend: string | null;
    confidence: number;
    reason: string;
    humanQueue: string | null;
    evidence: string[];
};

export type SupervisorSimulationResponse =
    | {
        available: true;
        source: "backend" | "mock";
        result: SupervisorSimulationDecision;
    }
    | {
        available: false;
        source: "unavailable";
        message: string;
    };

export const SUPERVISOR_PROVIDER_OPTIONS: Array<{ value: SupervisorProvider; label: string }> = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google" },
    { value: "meta", label: "Meta" },
    { value: "azure-openai", label: "Azure OpenAI" },
    { value: "custom", label: "Custom" },
];

export const SUPERVISOR_REASONING_VERSION_OPTIONS = ["v0.5", "v0.6", "v0.7", "stable", "deterministic"];

const PROVIDER_MODELS: Record<string, string[]> = {
    openai: ["gpt-5-mini", "gpt-5", "gpt-4.1", "gpt-4o-mini"],
    anthropic: ["claude-3-7-sonnet", "claude-3-5-sonnet"],
    google: ["gemini-2.5-pro", "gemini-2.5-flash"],
    meta: ["llama-3.3-70b", "llama-3.1-70b"],
    "azure-openai": ["gpt-5-mini", "gpt-4.1", "gpt-4o-mini"],
    custom: [],
};

const MOCK_SUPERVISORS_STORAGE_KEY = "io.ai-supervisors.mock.supervisors";
const MOCK_AGENTS_STORAGE_KEY = "io.ai-supervisors.mock.agents";

class ServiceError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "ServiceError";
        this.status = status;
    }
}

function asString(value: unknown) {
    return String(value ?? "").trim();
}

function asBoolean(value: unknown, fallback = false) {
    if (typeof value === "boolean") return value;
    return fallback;
}

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => asString(item)).filter(Boolean);
}

function nowIso() {
    return new Date().toISOString();
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function normalizeSearchText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value: string) {
    return normalizeSearchText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);
}

function isMockModeEnabled() {
    if (process.env.NEXT_PUBLIC_USE_MOCK_AI_SUPERVISORS === "true") return true;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("mockSupervisors") === "1";
}

function ensureBrowserStorage() {
    return typeof window !== "undefined" && Boolean(window.localStorage);
}

function getSeedAgents(): DistributionAgentOption[] {
    return [
        {
            id: "agent_comercial",
            name: "Agente Comercial",
            providerId: "openai",
            reasoningModel: "sales-router",
            modelVersion: "gpt-5-mini",
            isActive: true,
        },
        {
            id: "agent_suporte",
            name: "Agente Suporte",
            providerId: "openai",
            reasoningModel: "support-router",
            modelVersion: "gpt-5-mini",
            isActive: true,
        },
        {
            id: "agent_financeiro",
            name: "Agente Financeiro",
            providerId: "openai",
            reasoningModel: "finance-router",
            modelVersion: "gpt-5-mini",
            isActive: true,
        },
        {
            id: "agent_retencao",
            name: "Agente Retenção",
            providerId: "openai",
            reasoningModel: "retention-router",
            modelVersion: "gpt-5-mini",
            isActive: true,
        },
    ];
}

function getSeedSupervisors(): AiSupervisor[] {
    const now = nowIso();
    return [
        {
            id: "supervisor_default",
            name: "Supervisor Padrão",
            communicationStyle: "Neutro e Equilibrado",
            profile: "Recepcionista",
            objective: "Identificar rapidamente o motivo do contato e encaminhar para o agente mais adequado.",
            reasoningModelVersion: "stable",
            provider: "openai",
            model: "gpt-5-mini",
            humanHandoffEnabled: true,
            notifyContactOnAgentTransfer: false,
            humanHandoffTeam: "Geral",
            humanHandoffSendMessage: true,
            humanHandoffMessage: "Estamos transferindo seu atendimento para um de nossos especialistas, por favor aguarde!",
            agentIssueHandoffTeam: "Geral",
            agentIssueSendMessage: false,
            humanUserChoiceEnabled: false,
            humanChoiceOptions: ["Geral"],
            enabled: true,
            defaultForCompany: true,
            distribution: {
                otherRules: "Nunca passar preço sem contexto. Reclamações agressivas devem ir para humano.",
                agents: [
                    {
                        agentId: "agent_comercial",
                        agentName: "Agente Comercial",
                        enabled: true,
                        triageText: "Indicado para novos leads, dúvidas sobre produto, proposta, demonstração e comercial.",
                        updatedAt: now,
                    },
                    {
                        agentId: "agent_suporte",
                        agentName: "Agente Suporte",
                        enabled: true,
                        triageText: "Indicado para incidentes, erro técnico, acesso, integrações e configuração.",
                        updatedAt: now,
                    },
                    {
                        agentId: "agent_financeiro",
                        agentName: "Agente Financeiro",
                        enabled: true,
                        triageText: "Indicado para boleto, nota fiscal, segunda via, pagamento e cobrança.",
                        updatedAt: now,
                    },
                ],
            },
            createdAt: now,
            updatedAt: now,
        },
    ];
}

function readMockAgents() {
    if (!ensureBrowserStorage()) return getSeedAgents();
    const raw = window.localStorage.getItem(MOCK_AGENTS_STORAGE_KEY);
    if (!raw) {
        const seed = getSeedAgents();
        window.localStorage.setItem(MOCK_AGENTS_STORAGE_KEY, JSON.stringify(seed));
        return seed;
    }

    try {
        const parsed = JSON.parse(raw) as unknown[];
        const next = Array.isArray(parsed)
            ? parsed.map((item) => {
                const source = (item ?? {}) as Record<string, unknown>;
                return {
                    id: asString(source.id),
                    name: asString(source.name),
                    providerId: asString(source.providerId),
                    reasoningModel: asString(source.reasoningModel),
                    modelVersion: asString(source.modelVersion),
                    isActive: asBoolean(source.isActive, true),
                } satisfies DistributionAgentOption;
            }).filter((item) => item.id && item.name)
            : [];
        return next.length ? next : getSeedAgents();
    } catch {
        return getSeedAgents();
    }
}

function sanitizeSupervisor(raw: unknown): AiSupervisor {
    const source = (raw ?? {}) as Record<string, unknown>;
    const distributionSource =
        source.distribution && typeof source.distribution === "object"
            ? (source.distribution as Record<string, unknown>)
            : {};
    const now = nowIso();

    const agents = Array.isArray(distributionSource.agents)
        ? distributionSource.agents
            .map((item) => {
                const rule = (item ?? {}) as Record<string, unknown>;
                const agentId = asString(rule.agentId);
                if (!agentId) return null;
                return {
                    agentId,
                    agentName: asString(rule.agentName) || agentId,
                    enabled: asBoolean(rule.enabled, true),
                    triageText: asString(rule.triageText),
                    updatedAt: asString(rule.updatedAt) || now,
                } satisfies AiSupervisorDistributionAgentRule;
            })
            .filter((item): item is AiSupervisorDistributionAgentRule => Boolean(item))
        : [];
    const legacyHumanChoiceOptions = asStringArray(source.humanChoiceOptions);
    const humanHandoffTeam = asString(source.humanHandoffTeam) || legacyHumanChoiceOptions[0] || "Geral";
    const agentIssueHandoffTeam =
        asString(source.agentIssueHandoffTeam)
        || asString(source.humanHandoffTeam)
        || legacyHumanChoiceOptions[1]
        || humanHandoffTeam
        || "Geral";
    const normalizedHumanChoiceOptions = Array.from(new Set(
        [humanHandoffTeam, agentIssueHandoffTeam, ...legacyHumanChoiceOptions]
            .map((item) => asString(item))
            .filter(Boolean),
    ));

    return {
        id: asString(source.id),
        name: asString(source.name),
        communicationStyle: asString(source.communicationStyle),
        profile: asString(source.profile),
        objective: asString(source.objective),
        reasoningModelVersion: asString(source.reasoningModelVersion),
        provider: asString(source.provider) || "openai",
        model: asString(source.model),
        humanHandoffEnabled: asBoolean(source.humanHandoffEnabled),
        notifyContactOnAgentTransfer: asBoolean(source.notifyContactOnAgentTransfer),
        humanHandoffTeam,
        humanHandoffSendMessage: asBoolean(source.humanHandoffSendMessage),
        humanHandoffMessage: asString(source.humanHandoffMessage),
        agentIssueHandoffTeam,
        agentIssueSendMessage: asBoolean(source.agentIssueSendMessage),
        humanUserChoiceEnabled: asBoolean(source.humanUserChoiceEnabled),
        humanChoiceOptions: normalizedHumanChoiceOptions,
        enabled: asBoolean(source.enabled, true),
        defaultForCompany: asBoolean(source.defaultForCompany),
        distribution: {
            otherRules: asString(distributionSource.otherRules),
            agents,
        },
        createdAt: asString(source.createdAt) || now,
        updatedAt: asString(source.updatedAt) || now,
    };
}

function readMockSupervisors(): AiSupervisor[] {
    if (!ensureBrowserStorage()) return getSeedSupervisors();
    const raw = window.localStorage.getItem(MOCK_SUPERVISORS_STORAGE_KEY);
    if (!raw) {
        const seed = getSeedSupervisors();
        window.localStorage.setItem(MOCK_SUPERVISORS_STORAGE_KEY, JSON.stringify(seed));
        return seed;
    }

    try {
        const parsed = JSON.parse(raw) as unknown[];
        const next = Array.isArray(parsed) ? parsed.map(sanitizeSupervisor).filter((item) => item.id) : [];
        return next.length ? next : getSeedSupervisors();
    } catch {
        return getSeedSupervisors();
    }
}

function writeMockSupervisors(supervisors: AiSupervisor[]) {
    if (!ensureBrowserStorage()) return;
    window.localStorage.setItem(MOCK_SUPERVISORS_STORAGE_KEY, JSON.stringify(supervisors));
}

async function readJsonResponse<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
    let res: Response;
    try {
        res = await fetch(path, init);
    } catch {
        throw new ServiceError("Não foi possível conectar com o servidor.", 0);
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const message =
            data && typeof data === "object" && "message" in data
                ? String((data as { message?: unknown }).message ?? fallbackMessage)
                : fallbackMessage;
        throw new ServiceError(message, res.status);
    }

    return data as T;
}

function buildSupervisorPayload(payload: AiSupervisorUpsertPayload) {
    const humanHandoffTeam = asString(payload.humanHandoffTeam) || "Geral";
    const agentIssueHandoffTeam = asString(payload.agentIssueHandoffTeam) || humanHandoffTeam;
    const humanChoiceOptions = Array.from(new Set(
        [
            humanHandoffTeam,
            agentIssueHandoffTeam,
            ...(payload.humanChoiceOptions ?? []),
        ]
            .map((item) => asString(item))
            .filter(Boolean),
    ));

    return {
        name: asString(payload.name),
        communicationStyle: asString(payload.communicationStyle),
        profile: asString(payload.profile),
        objective: asString(payload.objective),
        reasoningModelVersion: asString(payload.reasoningModelVersion),
        provider: asString(payload.provider) || "openai",
        model: asString(payload.model),
        humanHandoffEnabled: Boolean(payload.humanHandoffEnabled),
        notifyContactOnAgentTransfer: Boolean(payload.notifyContactOnAgentTransfer),
        humanHandoffTeam,
        humanHandoffSendMessage: Boolean(payload.humanHandoffSendMessage),
        humanHandoffMessage: asString(payload.humanHandoffMessage),
        agentIssueHandoffTeam,
        agentIssueSendMessage: Boolean(payload.agentIssueSendMessage),
        humanUserChoiceEnabled: Boolean(payload.humanUserChoiceEnabled),
        humanChoiceOptions,
        enabled: Boolean(payload.enabled),
        defaultForCompany: Boolean(payload.defaultForCompany),
    };
}

function buildDistributionPayload(payload: AiSupervisorDistributionPayload) {
    return {
        otherRules: asString(payload.otherRules),
        agents: (payload.agents ?? [])
            .map((item) => ({
                agentId: asString(item.agentId),
                enabled: Boolean(item.enabled),
                triageText: asString(item.triageText),
            }))
            .filter((item) => item.agentId),
    };
}

function ensureSingleDefault(supervisors: AiSupervisor[], targetId?: string) {
    const resolvedTargetId = targetId ?? supervisors.find((item) => item.defaultForCompany)?.id ?? supervisors[0]?.id ?? "";
    return supervisors.map((item) => ({
        ...item,
        defaultForCompany: item.id === resolvedTargetId,
    }));
}

function createMockSupervisorFromPayload(payload: AiSupervisorUpsertPayload): AiSupervisor {
    const now = nowIso();
    return sanitizeSupervisor({
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `sup_${Date.now()}`,
        ...buildSupervisorPayload(payload),
        distribution: {
            otherRules: "",
            agents: [],
        },
        createdAt: now,
        updatedAt: now,
    });
}

function simulateMockRouting(
    supervisor: AiSupervisor,
    message: string,
    distributionOverride?: AiSupervisorDistributionPayload,
): SupervisorSimulationResponse {
    const distribution = distributionOverride
        ? {
            otherRules: asString(distributionOverride.otherRules),
            agents: distributionOverride.agents.map((item) => {
                const existing = supervisor.distribution.agents.find((rule) => rule.agentId === item.agentId);
                return {
                    agentId: item.agentId,
                    agentName: existing?.agentName ?? item.agentId,
                    enabled: item.enabled,
                    triageText: item.triageText,
                    updatedAt: nowIso(),
                } satisfies AiSupervisorDistributionAgentRule;
            }),
        }
        : supervisor.distribution;

    const enabledRules = distribution.agents.filter((item) => item.enabled);
    const normalizedMessage = normalizeSearchText(message);
    const tokens = tokenize(message);

    if (!normalizedMessage) {
        return {
            available: true,
            source: "mock",
            result: {
                action: "ASK_CLARIFYING",
                targetAgentId: null,
                targetAgentName: null,
                messageToSend: "Para eu te direcionar melhor, você precisa de ajuda com comercial, suporte ou financeiro?",
                confidence: 0.24,
                reason: "Mensagem vazia ou curta demais para decidir.",
                humanQueue: null,
                evidence: ["lead sem contexto suficiente"],
            },
        };
    }

    const humanKeywords = ["humano", "atendente", "pessoa", "reclamacao", "cancelamento", "procon", "advogado"];
    if (supervisor.humanHandoffEnabled && humanKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
        const handoffMessage = supervisor.humanHandoffSendMessage
            ? (asString(supervisor.humanHandoffMessage) || "Estamos transferindo seu atendimento para um de nossos especialistas, por favor aguarde!")
            : null;
        return {
            available: true,
            source: "mock",
            result: {
                action: "HANDOFF_HUMAN",
                targetAgentId: null,
                targetAgentName: null,
                messageToSend: handoffMessage,
                confidence: 0.86,
                reason: "Palavras-chave de handoff humano encontradas.",
                humanQueue: asString(supervisor.humanHandoffTeam) || null,
                evidence: humanKeywords.filter((keyword) => normalizedMessage.includes(keyword)).slice(0, 3),
            },
        };
    }

    const ranked = enabledRules
        .map((rule) => {
            const haystack = `${rule.agentName} ${rule.triageText}`;
            const haystackNormalized = normalizeSearchText(haystack);
            const score = tokens.reduce((total, token) => total + (haystackNormalized.includes(token) ? 1 : 0), 0);
            return { rule, score };
        })
        .sort((left, right) => right.score - left.score);

    const winner = ranked[0];
    const runnerUp = ranked[1];

    if (winner && winner.score > 0.9 && (!runnerUp || winner.score - runnerUp.score >= 0.5)) {
        return {
            available: true,
            source: "mock",
            result: {
                action: "ASSIGN_AGENT",
                targetAgentId: winner.rule.agentId,
                targetAgentName: winner.rule.agentName,
                messageToSend: null,
                confidence: clamp(0.55 + winner.score / 10, 0.55, 0.96),
                reason: "Melhor aderência entre a mensagem e o texto de triagem.",
                humanQueue: null,
                evidence: tokens.filter((token) => normalizeSearchText(`${winner.rule.agentName} ${winner.rule.triageText}`).includes(token)).slice(0, 3),
            },
        };
    }

    return {
        available: true,
        source: "mock",
        result: {
            action: "ASK_CLARIFYING",
            targetAgentId: null,
            targetAgentName: null,
            messageToSend: "Qual é o principal objetivo do seu contato hoje?",
            confidence: 0.42,
            reason: "Não houve diferença suficiente entre os candidatos.",
            humanQueue: null,
            evidence: ranked.slice(0, 2).map((item) => item.rule.agentName),
        },
    };
}

export function getSupervisorModelSuggestions(provider: string) {
    return PROVIDER_MODELS[asString(provider).toLowerCase()] ?? [];
}

export function getEmptySupervisorPayload(): AiSupervisorUpsertPayload {
    return {
        name: "",
        communicationStyle: "",
        profile: "",
        objective: "",
        reasoningModelVersion: "stable",
        provider: "openai",
        model: "gpt-5-mini",
        humanHandoffEnabled: true,
        notifyContactOnAgentTransfer: false,
        humanHandoffTeam: "Geral",
        humanHandoffSendMessage: true,
        humanHandoffMessage: "Estamos transferindo seu atendimento para um de nossos especialistas, por favor aguarde!",
        agentIssueHandoffTeam: "Geral",
        agentIssueSendMessage: false,
        humanUserChoiceEnabled: false,
        humanChoiceOptions: ["Geral"],
        enabled: true,
        defaultForCompany: false,
    };
}

export function getFriendlyHttpErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação.") {
    if (error instanceof ServiceError) return error.message || fallback;
    if (error instanceof Error) return error.message || fallback;
    return fallback;
}

export async function listSupervisors(): Promise<AiSupervisor[]> {
    if (isMockModeEnabled()) {
        return readMockSupervisors().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }

    const data = await readJsonResponse<unknown[]>("/api/ai-supervisors", { cache: "no-store" }, "Falha ao carregar supervisores.");
    return (Array.isArray(data) ? data : []).map(sanitizeSupervisor).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getSupervisor(id: string): Promise<AiSupervisor> {
    if (isMockModeEnabled()) {
        const item = readMockSupervisors().find((supervisor) => supervisor.id === id);
        if (!item) throw new ServiceError("Supervisor não encontrado.", 404);
        return item;
    }

    const data = await readJsonResponse<unknown>(`/api/ai-supervisors/${id}`, { cache: "no-store" }, "Falha ao carregar supervisor.");
    return sanitizeSupervisor(data);
}

export async function createSupervisor(payload: AiSupervisorUpsertPayload): Promise<AiSupervisor> {
    if (isMockModeEnabled()) {
        const next = createMockSupervisorFromPayload(payload);
        const current = readMockSupervisors();
        const withDefault = ensureSingleDefault([...current, next], payload.defaultForCompany ? next.id : current.find((item) => item.defaultForCompany)?.id ?? next.id);
        writeMockSupervisors(withDefault);
        return withDefault.find((item) => item.id === next.id)!;
    }

    const data = await readJsonResponse<unknown>(
        "/api/ai-supervisors",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildSupervisorPayload(payload)),
        },
        "Falha ao criar supervisor.",
    );
    return sanitizeSupervisor(data);
}

export async function updateSupervisor(id: string, payload: AiSupervisorUpsertPayload): Promise<AiSupervisor> {
    if (isMockModeEnabled()) {
        const supervisors = readMockSupervisors();
        const next = supervisors.map((item) => item.id === id
            ? sanitizeSupervisor({
                ...item,
                ...buildSupervisorPayload(payload),
                updatedAt: nowIso(),
            })
            : item);
        const normalized = ensureSingleDefault(next, payload.defaultForCompany ? id : next.find((item) => item.defaultForCompany)?.id ?? id);
        writeMockSupervisors(normalized);
        const updated = normalized.find((item) => item.id === id);
        if (!updated) throw new ServiceError("Supervisor não encontrado.", 404);
        return updated;
    }

    const data = await readJsonResponse<unknown>(
        `/api/ai-supervisors/${id}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildSupervisorPayload(payload)),
        },
        "Falha ao atualizar supervisor.",
    );
    return sanitizeSupervisor(data);
}

export async function toggleSupervisorEnabled(id: string, enabled: boolean): Promise<AiSupervisor> {
    const supervisor = await getSupervisor(id);
    return updateSupervisor(id, {
        name: supervisor.name,
        communicationStyle: supervisor.communicationStyle,
        profile: supervisor.profile,
        objective: supervisor.objective,
        reasoningModelVersion: supervisor.reasoningModelVersion,
        provider: supervisor.provider,
        model: supervisor.model,
        humanHandoffEnabled: supervisor.humanHandoffEnabled,
        notifyContactOnAgentTransfer: supervisor.notifyContactOnAgentTransfer,
        humanHandoffTeam: supervisor.humanHandoffTeam,
        humanHandoffSendMessage: supervisor.humanHandoffSendMessage,
        humanHandoffMessage: supervisor.humanHandoffMessage,
        agentIssueHandoffTeam: supervisor.agentIssueHandoffTeam,
        agentIssueSendMessage: supervisor.agentIssueSendMessage,
        humanUserChoiceEnabled: supervisor.humanUserChoiceEnabled,
        humanChoiceOptions: supervisor.humanChoiceOptions,
        enabled,
        defaultForCompany: supervisor.defaultForCompany,
    });
}

export async function getSupervisorDistribution(id: string): Promise<AiSupervisorDistribution> {
    if (isMockModeEnabled()) {
        return (await getSupervisor(id)).distribution;
    }

    const data = await readJsonResponse<unknown>(
        `/api/ai-supervisors/${id}/distribution`,
        { cache: "no-store" },
        "Falha ao carregar distribuição do supervisor.",
    );
    const source = (data ?? {}) as Record<string, unknown>;
    return {
        otherRules: asString(source.otherRules),
        agents: Array.isArray(source.agents)
            ? source.agents.map((item) => {
                const rule = (item ?? {}) as Record<string, unknown>;
                return {
                    agentId: asString(rule.agentId),
                    agentName: asString(rule.agentName) || asString(rule.agentId),
                    enabled: asBoolean(rule.enabled, true),
                    triageText: asString(rule.triageText),
                    updatedAt: asString(rule.updatedAt) || nowIso(),
                } satisfies AiSupervisorDistributionAgentRule;
            }).filter((item) => item.agentId)
            : [],
    };
}

export async function updateSupervisorDistribution(id: string, payload: AiSupervisorDistributionPayload): Promise<AiSupervisorDistribution> {
    if (isMockModeEnabled()) {
        const agentsById = new Map(readMockAgents().map((item) => [item.id, item.name]));
        const supervisors = readMockSupervisors().map((item) => {
            if (item.id !== id) return item;
            return sanitizeSupervisor({
                ...item,
                distribution: {
                    otherRules: asString(payload.otherRules),
                    agents: payload.agents.map((rule) => ({
                        agentId: rule.agentId,
                        agentName: agentsById.get(rule.agentId) ?? rule.agentId,
                        enabled: rule.enabled,
                        triageText: rule.triageText,
                        updatedAt: nowIso(),
                    })),
                },
                updatedAt: nowIso(),
            });
        });
        writeMockSupervisors(supervisors);
        const updated = supervisors.find((item) => item.id === id);
        if (!updated) throw new ServiceError("Supervisor não encontrado.", 404);
        return updated.distribution;
    }

    const data = await readJsonResponse<unknown>(
        `/api/ai-supervisors/${id}/distribution`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildDistributionPayload(payload)),
        },
        "Falha ao salvar distribuição do supervisor.",
    );
    return sanitizeSupervisor(data).distribution;
}

export async function listAgentsForDistribution(): Promise<DistributionAgentOption[]> {
    if (isMockModeEnabled()) {
        return readMockAgents().sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name));
    }

    const raw = await readJsonResponse<unknown>("/api/ai-agents/state", { cache: "no-store" }, "Falha ao carregar agentes disponíveis.");
    const state = sanitizeAiAgentsState(raw);
    return state.agents
        .map((agent) => ({
            id: agent.id,
            name: agent.name,
            providerId: agent.providerId,
            reasoningModel: agent.reasoningModel,
            modelVersion: agent.modelVersion,
            isActive: Boolean(agent.isActive),
        }))
        .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name));
}

export async function simulateSupervisorRouting(
    id: string,
    message: string,
    options?: {
        distribution?: AiSupervisorDistributionPayload;
    },
): Promise<SupervisorSimulationResponse> {
    if (isMockModeEnabled()) {
        const supervisor = await getSupervisor(id);
        return simulateMockRouting(supervisor, message, options?.distribution);
    }

    try {
        const data = await readJsonResponse<{
            action?: unknown;
            targetAgentId?: unknown;
            targetAgentName?: unknown;
            messageToSend?: unknown;
            confidence?: unknown;
            reason?: unknown;
            humanQueue?: unknown;
            evidence?: unknown;
        }>(
            `/api/ai-supervisors/${id}/simulate`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: asString(message),
                    distribution: options?.distribution ? buildDistributionPayload(options.distribution) : null,
                }),
            },
            "Simulação indisponível.",
        );

        return {
            available: true,
            source: "backend",
            result: {
                action: (["ASSIGN_AGENT", "ASK_CLARIFYING", "HANDOFF_HUMAN", "NO_ACTION"].includes(asString(data.action))
                    ? asString(data.action)
                    : "NO_ACTION") as SupervisorAction,
                targetAgentId: asString(data.targetAgentId) || null,
                targetAgentName: asString(data.targetAgentName) || null,
                messageToSend: asString(data.messageToSend) || null,
                confidence: clamp(asNumber(data.confidence, 0), 0, 1),
                reason: asString(data.reason),
                humanQueue: asString(data.humanQueue) || null,
                evidence: asStringArray(data.evidence).slice(0, 3),
            },
        };
    } catch (error) {
        const message = getFriendlyHttpErrorMessage(error, "Simulação indisponível.");
        return {
            available: false,
            source: "unavailable",
            message,
        };
    }
}
