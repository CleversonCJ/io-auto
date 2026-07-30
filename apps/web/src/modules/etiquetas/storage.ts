"use client";

export type ContactLabel = {
    id: string;
    title: string;
    color: string;
    createdAt: string;
    updatedAt: string;
};

export type ContactLabelAssignments = Record<string, string[]>;

const LEGACY_LABELS_STORAGE_KEY = "io.contact.labels";
const LEGACY_ASSIGNMENTS_STORAGE_KEY = "io.contact.label.assignments";

function safeJsonParse<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function isHexColor(value: string) {
    return /^#([0-9a-fA-F]{6})$/.test(value);
}

export function normalizeHexColor(value: string) {
    const normalized = value.trim();
    if (!normalized) return "#64748b";
    if (isHexColor(normalized)) return normalized.toUpperCase();
    if (/^[0-9a-fA-F]{6}$/.test(normalized)) return `#${normalized.toUpperCase()}`;
    return "#64748b";
}

function normalizeLabel(raw: Partial<ContactLabel> | null | undefined): ContactLabel | null {
    if (!raw) return null;
    const id = String(raw.id ?? "").trim();
    const title = String(raw.title ?? "").trim();
    if (!id || !title) return null;
    const now = new Date().toISOString();
    return {
        id,
        title,
        color: normalizeHexColor(String(raw.color ?? "#64748b")),
        createdAt: String(raw.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? now),
    };
}

function normalizeLabels(raw: Partial<ContactLabel>[]) {
    return raw
        .map((item) => normalizeLabel(item))
        .filter((item): item is ContactLabel => Boolean(item));
}

function readLegacyContactLabels(): ContactLabel[] {
    if (typeof window === "undefined") return [];
    const parsed = safeJsonParse<Partial<ContactLabel>[]>(window.localStorage.getItem(LEGACY_LABELS_STORAGE_KEY), []);
    return normalizeLabels(parsed);
}

function clearLegacyContactLabels() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_LABELS_STORAGE_KEY);
}

async function readLabelsResponse(response: Response) {
    const data = (await response.json().catch(() => [])) as Partial<ContactLabel>[];
    if (!response.ok) {
        const message = data && !Array.isArray(data) && "message" in data
            ? String((data as { message?: unknown }).message ?? "")
            : "";
        throw new Error(message || "Não foi possível carregar as etiquetas.");
    }
    return normalizeLabels(Array.isArray(data) ? data : []);
}

export async function loadContactLabels(): Promise<ContactLabel[]> {
    const response = await fetch("/api/atendimentos/labels", { cache: "no-store" });
    const serverLabels = await readLabelsResponse(response);
    const legacyLabels = readLegacyContactLabels();

    if (serverLabels.length === 0 && legacyLabels.length > 0) {
        const migrated = await saveContactLabels(legacyLabels);
        clearLegacyContactLabels();
        return migrated;
    }

    clearLegacyContactLabels();
    return serverLabels;
}

export async function saveContactLabels(labels: ContactLabel[]): Promise<ContactLabel[]> {
    const normalized = normalizeLabels(labels);
    const response = await fetch("/api/atendimentos/labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            items: normalized.map((label) => ({
                id: label.id,
                title: label.title,
                color: label.color,
                createdAt: label.createdAt,
            })),
        }),
    });
    const saved = await readLabelsResponse(response);
    clearLegacyContactLabels();
    return saved;
}

export function readLegacyContactLabelAssignments(): ContactLabelAssignments {
    if (typeof window === "undefined") return {};
    const parsed = safeJsonParse<Record<string, unknown>>(window.localStorage.getItem(LEGACY_ASSIGNMENTS_STORAGE_KEY), {});
    const next: ContactLabelAssignments = {};
    for (const key of Object.keys(parsed)) {
        const value = parsed[key];
        if (!Array.isArray(value)) continue;
        const ids = value
            .map((item) => String(item ?? "").trim())
            .filter(Boolean);
        if (ids.length) next[key] = Array.from(new Set(ids));
    }
    return next;
}

export function clearLegacyContactLabelAssignments() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_ASSIGNMENTS_STORAGE_KEY);
}

export function getLabelTextColor(backgroundHex: string) {
    const color = normalizeHexColor(backgroundHex).slice(1);
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.65 ? "#111827" : "#FFFFFF";
}

