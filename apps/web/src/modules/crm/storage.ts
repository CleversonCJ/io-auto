"use client";

export type CrmStageKind = "initial" | "intermediate" | "final";

export type CrmStage = {
    id: string;
    title: string;
    kind: CrmStageKind;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type CrmCustomFieldType = "text" | "textarea" | "number" | "date";

export type CrmCustomField = {
    id: string;
    label: string;
    type: CrmCustomFieldType;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type CrmLeadStageMap = Record<string, string>;
export type CrmLeadCustomFieldValueMap = Record<string, Record<string, string>>;
export type CrmLeadFieldOrder = string[];

export type CrmState = {
    stages: CrmStage[];
    leadStageMap: CrmLeadStageMap;
    customFields: CrmCustomField[];
    leadFieldValues: CrmLeadCustomFieldValueMap;
    leadFieldOrder: CrmLeadFieldOrder;
};

const LEGACY_CRM_STORAGE_KEYS = [
    "io.crm.stages",
    "io.crm.lead.stage",
    "io.crm.customFields",
    "io.crm.lead.fieldValues",
    "io.crm.lead.fieldsOrder",
    "io.crm.followUps",
    "io.crm.followUpNotifications",
];
const CRM_STAGE_COLOR = "#6b00e3";
export const CRM_VALUE_FIELD_ID = "crm_field_value";
export const CRM_VALUE_FIELD_KEY = `custom:${CRM_VALUE_FIELD_ID}`;
export const CRM_VALUE_FIELD_LABEL = "Valor";
const CRM_VALUE_FIELD_TYPE: CrmCustomFieldType = "number";

export const EMPTY_CRM_STATE: CrmState = {
    stages: [],
    leadStageMap: {},
    customFields: [],
    leadFieldValues: {},
    leadFieldOrder: [],
};

function clearLegacyCrmStorage() {
    if (typeof window === "undefined") return;
    for (const key of LEGACY_CRM_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
    }
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function resolveStageKind(value: unknown): CrmStageKind {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "initial" || normalized === "intermediate" || normalized === "final") return normalized;
    return "intermediate";
}

function resolveFieldType(value: unknown): CrmCustomFieldType {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "text" || normalized === "textarea" || normalized === "number" || normalized === "date") return normalized;
    return "text";
}

function normalizeFieldLabelKey(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function normalizeStage(raw: Partial<CrmStage> | null | undefined, index = 0): CrmStage | null {
    if (!raw) return null;
    const id = String(raw.id ?? "").trim();
    const title = String(raw.title ?? "").trim();
    if (!id || !title) return null;
    const now = new Date().toISOString();
    const parsedOrder = Number(raw.order);
    return {
        id,
        title,
        kind: resolveStageKind(raw.kind),
        order: Number.isFinite(parsedOrder) ? parsedOrder : index,
        createdAt: String(raw.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? now),
    };
}

function normalizeCustomField(raw: Partial<CrmCustomField> | null | undefined, index = 0): CrmCustomField | null {
    if (!raw) return null;
    const id = String(raw.id ?? "").trim();
    const label = String(raw.label ?? "").trim();
    if (!id || !label) return null;
    const now = new Date().toISOString();
    return {
        id,
        label,
        type: resolveFieldType(raw.type),
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
        createdAt: String(raw.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? now),
    };
}

function ensureValueFieldState(
    fields: CrmCustomField[],
    order: CrmLeadFieldOrder,
    leadFieldValues: CrmLeadCustomFieldValueMap
): Pick<CrmState, "customFields" | "leadFieldOrder" | "leadFieldValues"> {
    const now = new Date().toISOString();
    const hasDefaultValueField = fields.some((field) => field.id === CRM_VALUE_FIELD_ID);
    const legacyValueFieldId = hasDefaultValueField
        ? null
        : fields.find((field) => normalizeFieldLabelKey(field.label) === normalizeFieldLabelKey(CRM_VALUE_FIELD_LABEL))?.id ?? null;

    const fieldById = new Map<string, CrmCustomField>();
    for (const field of fields) {
        const normalizedId = field.id === legacyValueFieldId ? CRM_VALUE_FIELD_ID : field.id;
        fieldById.set(normalizedId, normalizedId === CRM_VALUE_FIELD_ID
            ? {
                ...field,
                id: CRM_VALUE_FIELD_ID,
                label: CRM_VALUE_FIELD_LABEL,
                type: CRM_VALUE_FIELD_TYPE,
            }
            : field);
    }

    if (!fieldById.has(CRM_VALUE_FIELD_ID)) {
        fieldById.set(CRM_VALUE_FIELD_ID, {
            id: CRM_VALUE_FIELD_ID,
            label: CRM_VALUE_FIELD_LABEL,
            type: CRM_VALUE_FIELD_TYPE,
            order: 0,
            createdAt: now,
            updatedAt: now,
        });
    }

    const nextLeadFieldValues: CrmLeadCustomFieldValueMap = {};
    for (const leadId of Object.keys(leadFieldValues)) {
        const currentValues = leadFieldValues[leadId] ?? {};
        const nextValues: Record<string, string> = {};
        for (const fieldId of Object.keys(currentValues)) {
            const normalizedFieldId = fieldId === legacyValueFieldId ? CRM_VALUE_FIELD_ID : fieldId;
            nextValues[normalizedFieldId] = String(currentValues[fieldId] ?? "");
        }
        nextLeadFieldValues[leadId] = nextValues;
    }

    const validKeys = new Set(Array.from(fieldById.keys()).map((fieldId) => `custom:${fieldId}`));
    const migratedOrder = order
        .map((item) => item === `custom:${legacyValueFieldId}` ? CRM_VALUE_FIELD_KEY : item)
        .filter((item, index, items) => validKeys.has(item) && items.indexOf(item) === index);
    const nextOrder = [CRM_VALUE_FIELD_KEY, ...migratedOrder.filter((item) => item !== CRM_VALUE_FIELD_KEY)];

    const orderedIds = [
        ...nextOrder
            .map((item) => item.replace(/^custom:/, ""))
            .filter((fieldId, index, items) => fieldById.has(fieldId) && items.indexOf(fieldId) === index),
        ...Array.from(fieldById.keys()).filter((fieldId) => !nextOrder.includes(`custom:${fieldId}`)),
    ];
    const nextFields = orderedIds.map((fieldId, index) => {
        const field = fieldById.get(fieldId)!;
        return {
            ...field,
            label: fieldId === CRM_VALUE_FIELD_ID ? CRM_VALUE_FIELD_LABEL : field.label,
            type: fieldId === CRM_VALUE_FIELD_ID ? CRM_VALUE_FIELD_TYPE : field.type,
            order: index,
        };
    });

    return {
        customFields: nextFields,
        leadFieldOrder: nextOrder,
        leadFieldValues: nextLeadFieldValues,
    };
}

export function sanitizeCrmState(raw: unknown): CrmState {
    const source = (raw ?? {}) as Record<string, unknown>;
    const rawStages = Array.isArray(source.stages) ? source.stages as Partial<CrmStage>[] : [];
    const rawCustomFields = Array.isArray(source.customFields) ? source.customFields as Partial<CrmCustomField>[] : [];
    const stages = rawStages
        .map((item, index) => normalizeStage(item, index))
        .filter((item): item is CrmStage => Boolean(item))
        .sort((a, b) => a.order - b.order);
    const customFields = rawCustomFields
        .map((item, index) => normalizeCustomField(item, index))
        .filter((item): item is CrmCustomField => Boolean(item))
        .sort((a, b) => a.order - b.order);

    const leadStageMap = safeJsonParse<Record<string, unknown>>(JSON.stringify(source.leadStageMap ?? {}), {});
    const leadFieldValuesRaw = safeJsonParse<Record<string, unknown>>(JSON.stringify(source.leadFieldValues ?? {}), {});
    const leadFieldOrderRaw = Array.isArray(source.leadFieldOrder) ? source.leadFieldOrder : [];

    const normalizedStageMap: CrmLeadStageMap = {};
    for (const key of Object.keys(leadStageMap)) {
        const leadId = key.trim();
        const stageId = String(leadStageMap[key] ?? "").trim();
        if (!leadId || !stageId) continue;
        normalizedStageMap[leadId] = stageId;
    }

    const normalizedFieldValues: CrmLeadCustomFieldValueMap = {};
    for (const leadId of Object.keys(leadFieldValuesRaw)) {
        const normalizedLeadId = leadId.trim();
        if (!normalizedLeadId) continue;
        const valuesRaw = leadFieldValuesRaw[leadId];
        if (!valuesRaw || typeof valuesRaw !== "object") continue;
        const valuesObj = valuesRaw as Record<string, unknown>;
        const values: Record<string, string> = {};
        for (const fieldId of Object.keys(valuesObj)) {
            const normalizedFieldId = fieldId.trim();
            if (!normalizedFieldId) continue;
            values[normalizedFieldId] = String(valuesObj[fieldId] ?? "");
        }
        normalizedFieldValues[normalizedLeadId] = values;
    }

    const normalizedOrder = leadFieldOrderRaw
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    const ensuredState = ensureValueFieldState(customFields, normalizedOrder, normalizedFieldValues);

    return {
        stages,
        leadStageMap: normalizedStageMap,
        customFields: ensuredState.customFields,
        leadFieldValues: ensuredState.leadFieldValues,
        leadFieldOrder: ensuredState.leadFieldOrder,
    };
}

export function getCrmStageColor() {
    return CRM_STAGE_COLOR;
}

export async function loadCrmStateFromApi(): Promise<CrmState> {
    const res = await fetch("/api/crm/state", { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar estado do CRM.");
    const data = await res.json().catch(() => ({}));
    clearLegacyCrmStorage();
    return sanitizeCrmState(data);
}

export async function saveCrmStateToApi(state: CrmState): Promise<CrmState> {
    const sanitized = sanitizeCrmState(state);
    const res = await fetch("/api/crm/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitized),
    });
    if (!res.ok) throw new Error("Falha ao salvar estado do CRM.");
    const data = await res.json().catch(() => sanitized);
    clearLegacyCrmStorage();
    return sanitizeCrmState(data);
}

export async function mergeCrmStatePatchToApi(patch: Partial<CrmState>): Promise<CrmState> {
    const current = await loadCrmStateFromApi();
    return saveCrmStateToApi({
        ...current,
        ...patch,
    });
}
