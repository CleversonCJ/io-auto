"use client";

export type AtendimentoClassification = {
    id: string;
    title: string;
    categoryId: AtendimentoClassificationCategoryId;
    hasValue: boolean;
    value: number | null;
    system: boolean;
    createdAt: string;
    updatedAt: string;
};

export type AtendimentoClassificationCategoryId = "achieved" | "lost" | "questions" | "other";

export type AtendimentoClassificationCategory = {
    id: AtendimentoClassificationCategoryId;
    label: string;
};

export type ContactConclusion = {
    classificationIds: string[];
    concludedAt: string;
};

export type ContactConclusionMap = Record<string, ContactConclusion>;

const LEGACY_CUSTOM_CLASSIFICATIONS_STORAGE_KEY = "io.atendimento.classifications.custom";
const LEGACY_CONCLUSIONS_STORAGE_KEY = "io.atendimento.conclusions";

const CLASSIFICATION_CATEGORIES: AtendimentoClassificationCategory[] = [
    { id: "achieved", label: "Objetivo atingido" },
    { id: "lost", label: "Objetivo perdido" },
    { id: "questions", label: "Dúvidas" },
    { id: "other", label: "Outro" },
];

const DEFAULT_CLASSIFICATIONS: AtendimentoClassification[] = [
    { id: "default-objective-achieved", title: "Objetivo atingido", categoryId: "achieved", hasValue: false, value: null, system: true, createdAt: "system", updatedAt: "system" },
    { id: "default-objective-lost", title: "Objetivo perdido", categoryId: "lost", hasValue: false, value: null, system: true, createdAt: "system", updatedAt: "system" },
    { id: "default-questions", title: "Dúvidas", categoryId: "questions", hasValue: false, value: null, system: true, createdAt: "system", updatedAt: "system" },
    { id: "default-other", title: "Outro", categoryId: "other", hasValue: false, value: null, system: true, createdAt: "system", updatedAt: "system" },
];

function safeJsonParse<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function resolveCategoryId(value: unknown): AtendimentoClassificationCategoryId {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "achieved" || normalized === "lost" || normalized === "questions" || normalized === "other") {
        return normalized;
    }
    return "other";
}

function normalizeClassification(raw: Partial<AtendimentoClassification> | null | undefined): AtendimentoClassification | null {
    if (!raw) return null;
    const id = String(raw.id ?? "").trim();
    const title = String(raw.title ?? "").trim();
    if (!id || !title) return null;
    const now = new Date().toISOString();
    const hasValue = Boolean(raw.hasValue);
    const parsedValue = Number(raw.value);
    const value = hasValue && Number.isFinite(parsedValue) ? parsedValue : null;
    return {
        id,
        title,
        categoryId: resolveCategoryId(raw.categoryId),
        hasValue,
        value,
        system: Boolean(raw.system),
        createdAt: String(raw.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? now),
    };
}

function normalizeClassifications(raw: Partial<AtendimentoClassification>[]) {
    return raw
        .map((item) => normalizeClassification(item))
        .filter((item): item is AtendimentoClassification => Boolean(item))
        .map((item) => ({ ...item, system: false }));
}

function readLegacyClassifications() {
    if (typeof window === "undefined") return [];
    const parsed = safeJsonParse<Partial<AtendimentoClassification>[]>(
        window.localStorage.getItem(LEGACY_CUSTOM_CLASSIFICATIONS_STORAGE_KEY),
        []
    );
    return normalizeClassifications(parsed);
}

function clearLegacyClassificationStorage() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_CUSTOM_CLASSIFICATIONS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CONCLUSIONS_STORAGE_KEY);
}

async function readClassificationsResponse(response: Response) {
    const data = await response.json().catch(() => []);
    if (!response.ok) {
        const message = data && typeof data === "object" && !Array.isArray(data) && "message" in data
            ? String((data as { message?: unknown }).message ?? "")
            : "";
        throw new Error(message || "Não foi possível carregar as classificações.");
    }
    return normalizeClassifications(Array.isArray(data) ? data : []);
}

export function listAtendimentoClassificationCategories() {
    return CLASSIFICATION_CATEGORIES;
}

export function listDefaultAtendimentoClassifications() {
    return DEFAULT_CLASSIFICATIONS;
}

export async function loadCustomAtendimentoClassifications(): Promise<AtendimentoClassification[]> {
    const response = await fetch("/api/atendimentos/classifications", { cache: "no-store" });
    const serverClassifications = await readClassificationsResponse(response);
    const legacyClassifications = readLegacyClassifications();

    if (serverClassifications.length === 0 && legacyClassifications.length > 0) {
        const migrated = await saveCustomAtendimentoClassifications(legacyClassifications);
        clearLegacyClassificationStorage();
        return migrated;
    }

    clearLegacyClassificationStorage();
    return serverClassifications;
}

export async function saveCustomAtendimentoClassifications(
    classifications: AtendimentoClassification[]
): Promise<AtendimentoClassification[]> {
    const normalized = normalizeClassifications(classifications);
    const response = await fetch("/api/atendimentos/classifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            items: normalized.map((item) => ({
                id: item.id,
                title: item.title,
                categoryId: item.categoryId,
                hasValue: item.hasValue,
                value: item.value,
                createdAt: item.createdAt,
            })),
        }),
    });
    const saved = await readClassificationsResponse(response);
    clearLegacyClassificationStorage();
    return saved;
}

export function listAllAtendimentoClassifications(
    customClassifications: AtendimentoClassification[] = []
): AtendimentoClassification[] {
    return [...listDefaultAtendimentoClassifications(), ...customClassifications];
}
