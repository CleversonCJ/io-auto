"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, MessageCircleMore, Search, Trash2, X } from "lucide-react";
import {
    CRM_VALUE_FIELD_ID,
    CRM_VALUE_FIELD_KEY,
    CRM_VALUE_FIELD_LABEL,
    EMPTY_CRM_STATE,
    loadCrmStateFromApi,
    mergeCrmStatePatchToApi,
    type CrmCustomField,
    type CrmCustomFieldType,
    type CrmFollowUp,
    type CrmFollowUpNotification,
    type CrmLeadFieldOrder,
    type CrmLeadCustomFieldValueMap,
    type CrmLeadStageMap,
    type CrmState,
    type CrmStage,
} from "@/modules/crm/storage";
import type { PublicCatalogLeadList } from "@/modules/ioauto/types";
import {
    getLabelTextColor,
    listContactLabelAssignments,
    listContactLabels,
    type ContactLabel,
} from "@/modules/etiquetas/storage";
import { subscribeRealtime } from "@/core/realtime/client";

type ApiConversation = {
    id: string;
    phone: string;
    displayName: string | null;
    photoUrl?: string | null;
    assignedUserId?: string | null;
    assignedUserName: string | null;
    lastMessage: string | null;
    status: "NEW" | "IN_PROGRESS";
    lastAt: string | null;
    startedAt?: string | null;
    unreadCount?: number | null;
    lastMessageFromMe?: boolean | null;
};

type AtendimentoUser = {
    id: string;
    fullName: string;
    email: string;
};

type LeadCard = {
    id: string;
    kind: "conversation" | "public_catalog";
    name: string;
    phone: string;
    photoUrl?: string | null;
    description: string;
    interestLabel?: string | null;
    sourceLabel?: string | null;
    fallbackValueCents?: number | null;
    ownerId: string | null;
    owner: string;
    status: string;
    lastAt: string;
    lastAtRaw?: string | null;
    unreadCount: number;
    createdAtRaw?: string | null;
};

type PublicCatalogLead = PublicCatalogLeadList["leads"][number];

type ConfigFieldDraft = {
    key: string;
    source: "custom";
    customId?: string;
    label: string;
    type: CrmCustomFieldType;
};

const FIELD_TYPE_OPTIONS: Array<{ value: CrmCustomFieldType; label: string }> = [
    { value: "text", label: "Texto curto" },
    { value: "textarea", label: "Texto longo" },
    { value: "number", label: "Numero" },
    { value: "date", label: "Data" },
];
const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const COMPACT_CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
});

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toInitials(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "LD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
}

function sourceTypeLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "CAMPAIGN") return "Campanha";
    if (normalized === "INFLUENCER") return "Influenciador";
    if (normalized === "DIRECT") return "Direto";
    if (!normalized) return "Catálogo público";
    return normalized.replaceAll("_", " ");
}

function parseCurrencyAmount(value?: string | null) {
    const input = String(value ?? "").trim();
    if (!input) return 0;

    const sanitized = input
        .replace(/\s/g, "")
        .replace(/^R\$\s?/i, "")
        .replace(/[^\d,.-]/g, "");
    if (!sanitized) return 0;

    const normalized = sanitized.includes(",")
        ? sanitized.replace(/\./g, "").replace(",", ".")
        : /^\-?\d{1,3}(\.\d{3})+$/.test(sanitized)
            ? sanitized.replace(/\./g, "")
            : sanitized;
    const amount = Number(normalized);
    if (Number.isFinite(amount)) return amount;

    const digits = sanitized.replace(/\D/g, "");
    if (!digits) return 0;
    return Number(digits) / 100;
}

function formatCurrencyAmount(value?: string | null, fallback = "-") {
    const input = String(value ?? "").trim();
    if (!input) return fallback;
    return CURRENCY_FORMATTER.format(parseCurrencyAmount(input));
}

function formatCurrencyTotal(amount: number) {
    return CURRENCY_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

function formatCompactCurrencyTotal(amount: number) {
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;
    if (Math.abs(normalizedAmount) < 1_000_000) {
        return formatCurrencyTotal(normalizedAmount);
    }
    return COMPACT_CURRENCY_FORMATTER.format(normalizedAmount);
}

function formatCurrencyInput(value: string) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return CURRENCY_FORMATTER.format(Number(digits) / 100);
}

function formatCurrencyFromCents(value?: number | null, fallback = "-") {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return CURRENCY_FORMATTER.format(value / 100);
}

function normalizeCurrencyStorageValue(value: string) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return (Number(digits) / 100).toFixed(2);
}

function ensureValueFieldDrafts(drafts: ConfigFieldDraft[]) {
    const valueDraft: ConfigFieldDraft = {
        key: CRM_VALUE_FIELD_KEY,
        source: "custom",
        customId: CRM_VALUE_FIELD_ID,
        label: CRM_VALUE_FIELD_LABEL,
        type: "number" as const,
    };

    let hasValueField = false;
    const next = drafts.map((draft) => {
        if (draft.customId !== CRM_VALUE_FIELD_ID) return draft;
        hasValueField = true;
        return {
            ...draft,
            key: CRM_VALUE_FIELD_KEY,
            customId: CRM_VALUE_FIELD_ID,
            label: CRM_VALUE_FIELD_LABEL,
            type: "number" as const,
        };
    });

    return hasValueField ? next : [valueDraft, ...next];
}

function LabelBadge({ label }: { label: ContactLabel }) {
    return (
        <span
            className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
        >
            {label.title}
        </span>
    );
}

type FilterSelectOption = {
    value: string;
    label: string;
    chipStyle?: CSSProperties;
};

type CompactMultiSelectProps = {
    title: string;
    placeholder: string;
    selectedValues: string[];
    options: FilterSelectOption[];
    emptyOptionsMessage: string;
    emptySelectionMessage: string;
    helperText?: string;
    onChange: (nextValues: string[]) => void;
};

function toggleFilterValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function resolveLeadPipelineValue(lead: LeadCard, leadFieldValues: CrmLeadCustomFieldValueMap) {
    const manualValue = parseCurrencyAmount(leadFieldValues[lead.id]?.[CRM_VALUE_FIELD_ID] ?? "");
    if (manualValue > 0) return manualValue;
    if (lead.kind === "public_catalog" && typeof lead.fallbackValueCents === "number" && lead.fallbackValueCents > 0) {
        return lead.fallbackValueCents / 100;
    }
    return 0;
}

function CompactMultiSelect({
    title,
    placeholder,
    selectedValues,
    options,
    emptyOptionsMessage,
    emptySelectionMessage,
    helperText,
    onChange,
}: CompactMultiSelectProps) {
    const optionsByValue = new Map(options.map((option) => [option.value, option]));
    const selectedOptions = selectedValues
        .map((value) => optionsByValue.get(value))
        .filter((option): option is FilterSelectOption => Boolean(option));
    const placeholderLabel = selectedOptions.length === 0
        ? placeholder
        : `${selectedOptions.length} selecionado${selectedOptions.length > 1 ? "s" : ""}`;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-black/70">{title}</label>
                <div className="flex items-center gap-2">
                    {helperText ? (
                        <span className="rounded-lg border border-black/10 px-2 py-1 text-[11px] text-black/55">{helperText}</span>
                    ) : null}
                    {selectedOptions.length > 0 ? (
                        <span className="rounded-full bg-io-purple px-2 py-0.5 text-[10px] font-semibold text-white">
                            {selectedOptions.length}
                        </span>
                    ) : null}
                </div>
            </div>
            {options.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/10 px-3 py-2 text-xs text-black/55">{emptyOptionsMessage}</p>
            ) : (
                <>
                    <div className="relative">
                        <select
                            value=""
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                if (!nextValue) return;
                                onChange(toggleFilterValue(selectedValues, nextValue));
                                event.target.value = "";
                            }}
                            className="h-10 w-full appearance-none rounded-xl border border-black/12 bg-white px-3 pr-9 text-sm text-io-dark outline-none transition focus:border-black/35"
                        >
                            <option value="">{placeholderLabel}</option>
                            {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {selectedValues.includes(option.value) ? "[x] " : ""}
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" strokeWidth={2} />
                    </div>
                    <div className="min-h-11 rounded-xl border border-dashed border-black/10 bg-black/[0.02] px-2.5 py-2">
                        {selectedOptions.length === 0 ? (
                            <p className="text-xs text-black/50">{emptySelectionMessage}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {selectedOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange(selectedValues.filter((value) => value !== option.value))}
                                        className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${option.chipStyle ? "border border-transparent" : "border border-black/10 bg-white text-io-dark"}`}
                                        style={option.chipStyle}
                                        title={`Remover filtro ${option.label}`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        <X className="h-3 w-3 shrink-0" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export function CrmKanban() {
    const router = useRouter();
    const stageColor = "#18181b";
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stages, setStages] = useState<CrmStage[]>([]);
    const [leadStageMap, setLeadStageMap] = useState<CrmLeadStageMap>({});
    const [customFields, setCustomFields] = useState<CrmCustomField[]>([]);
    const [leadFieldOrder, setLeadFieldOrder] = useState<CrmLeadFieldOrder>([]);
    const [leadFieldValues, setLeadFieldValues] = useState<CrmLeadCustomFieldValueMap>({});
    const [followUps, setFollowUps] = useState<CrmFollowUp[]>([]);
    const [followUpNotifications, setFollowUpNotifications] = useState<CrmFollowUpNotification[]>([]);
    const [conversations, setConversations] = useState<ApiConversation[]>([]);
    const [publicCatalogLeads, setPublicCatalogLeads] = useState<PublicCatalogLead[]>([]);
    const [availableUsers, setAvailableUsers] = useState<AtendimentoUser[]>([]);
    const [availableLabels, setAvailableLabels] = useState<ContactLabel[]>([]);
    const [labelsByContact, setLabelsByContact] = useState<Record<string, string[]>>({});
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
    const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

    const [isConfigureFieldsOpen, setIsConfigureFieldsOpen] = useState(false);
    const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
    const [fieldDrafts, setFieldDrafts] = useState<ConfigFieldDraft[]>([]);
    const [newFieldLabel, setNewFieldLabel] = useState("");
    const [newFieldType, setNewFieldType] = useState<CrmCustomFieldType>("text");
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [activeEditor, setActiveEditor] = useState<string | null>(null);
    const [editorValue, setEditorValue] = useState("");
    const [dragFieldKey, setDragFieldKey] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]);
    const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
    const [createdFrom, setCreatedFrom] = useState("");
    const [createdTo, setCreatedTo] = useState("");
    const [isOpeningAtendimento, setIsOpeningAtendimento] = useState(false);
    const crmStateRef = useRef<CrmState>(EMPTY_CRM_STATE);
    const filterPanelRef = useRef<HTMLDivElement | null>(null);

    const orderedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);
    const orderedCustomFields = useMemo(() => [...customFields].sort((a, b) => a.order - b.order), [customFields]);
    const allLeadFields = useMemo(() => {
        const combined = orderedCustomFields.map((field) => ({
            key: `custom:${field.id}`,
            source: "custom" as const,
            customId: field.id,
            label: field.label,
            type: field.type,
        }));
        const byKey = new Map(combined.map((field) => [field.key, field]));
        const orderedKeys = [
            ...leadFieldOrder.filter((key) => byKey.has(key)),
            ...combined.map((field) => field.key).filter((key) => !leadFieldOrder.includes(key)),
        ];
        return orderedKeys
            .map((key) => byKey.get(key))
            .filter(Boolean) as ConfigFieldDraft[];
    }, [orderedCustomFields, leadFieldOrder]);
    const leads = useMemo<LeadCard[]>(
        () => {
            const conversationLeads = conversations.map((item) => {
                const fallbackUnread = item.lastMessageFromMe !== true && Boolean(item.lastAt) ? 1 : 0;
                const unreadCount = Math.max(0, Number(item.unreadCount ?? fallbackUnread) || 0);
                return {
                    id: item.id,
                    kind: "conversation" as const,
                    name: (item.displayName ?? "").trim() || item.phone,
                    phone: item.phone,
                    photoUrl: item.photoUrl ?? null,
                    description: (item.lastMessage ?? "").trim() || "Sem descrição.",
                    interestLabel: null,
                    sourceLabel: null,
                    fallbackValueCents: null,
                    owner: (item.assignedUserName ?? "").trim() || "Não atribuído",
                    ownerId: item.assignedUserId?.trim() || null,
                    status: item.status,
                    lastAt: formatDateTime(item.lastAt),
                    lastAtRaw: item.lastAt ?? item.startedAt ?? null,
                    unreadCount,
                    createdAtRaw: item.startedAt ?? null,
                };
            });

            const catalogLeads = publicCatalogLeads.map((item) => {
                const vehicleLabel = (item.vehicleTitle ?? "").trim();
                const sourceLabel = sourceTypeLabel(item.sourceType);
                const description = vehicleLabel
                    ? `Interesse em ${vehicleLabel}. Origem: ${sourceLabel}.`
                    : `Lead captado pelo catálogo público. Origem: ${sourceLabel}.`;
                return {
                    id: item.id,
                    kind: "public_catalog" as const,
                    name: item.customerName.trim() || item.customerPhone,
                    phone: item.customerPhone,
                    photoUrl: null,
                    description,
                    interestLabel: vehicleLabel || "Catálogo geral",
                    sourceLabel,
                    fallbackValueCents: item.vehiclePriceCents ?? null,
                    owner: "Catálogo público",
                    ownerId: null,
                    status: "NEW",
                    lastAt: formatDateTime(item.createdAt),
                    lastAtRaw: item.createdAt ?? null,
                    unreadCount: 0,
                    createdAtRaw: item.createdAt ?? null,
                };
            });

            return [...conversationLeads, ...catalogLeads].sort((left, right) => {
                const rightTime = new Date(right.lastAtRaw ?? right.createdAtRaw ?? 0).getTime();
                const leftTime = new Date(left.lastAtRaw ?? left.createdAtRaw ?? 0).getTime();
                return rightTime - leftTime;
            });
        },
        [conversations, publicCatalogLeads]
    );
    const ownerOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const user of availableUsers) {
            map.set(user.id, user.fullName);
        }
        for (const lead of leads) {
            if (lead.ownerId && lead.owner && !map.has(lead.ownerId)) {
                map.set(lead.ownerId, lead.owner);
            }
        }
        return [
            { id: "__unassigned__", name: "Não atribuído" },
            ...Array.from(map.entries())
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        ];
    }, [availableUsers, leads]);
    const responsibleFilterOptions = useMemo<FilterSelectOption[]>(
        () => ownerOptions.map((owner) => ({ value: owner.id, label: owner.name })),
        [ownerOptions]
    );
    const labelFilterOptions = useMemo<FilterSelectOption[]>(
        () =>
            [...availableLabels]
                .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
                .map((label) => ({
                    value: label.id,
                    label: label.title,
                    chipStyle: { backgroundColor: label.color, color: getLabelTextColor(label.color) },
                })),
        [availableLabels]
    );
    const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedLeadId) ?? null, [leads, selectedLeadId]);
    const selectedLeadLabels = useMemo(() => {
        if (!selectedLead) return [] as ContactLabel[];
        const key = normalizePhone(selectedLead.phone);
        const ids = labelsByContact[key] ?? [];
        return availableLabels.filter((label) => ids.includes(label.id));
    }, [selectedLead, labelsByContact, availableLabels]);
    const selectedLeadStage = useMemo(
        () => orderedStages.find((stage) => stage.id === (selectedLead ? leadStageMap[selectedLead.id] : "")) ?? orderedStages[0] ?? null,
        [orderedStages, selectedLead, leadStageMap]
    );
    const activeFilterCount = useMemo(() => {
        let total = 0;
        if (selectedResponsibleIds.length > 0) total += 1;
        if (selectedLabelIds.length > 0) total += 1;
        if (createdFrom || createdTo) total += 1;
        if (searchTerm.trim()) total += 1;
        return total;
    }, [createdFrom, createdTo, searchTerm, selectedLabelIds.length, selectedResponsibleIds.length]);
    const filteredLeads = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return leads.filter((lead) => {
            if (selectedResponsibleIds.length > 0) {
                const matchesUnassigned = !lead.ownerId && selectedResponsibleIds.includes("__unassigned__");
                const matchesAssigned = !!lead.ownerId && selectedResponsibleIds.includes(lead.ownerId);
                if (!matchesUnassigned && !matchesAssigned) {
                    return false;
                }
            }
            if (selectedLabelIds.length > 0) {
                const contactKey = normalizePhone(lead.phone);
                const leadLabels = labelsByContact[contactKey] ?? [];
                if (!selectedLabelIds.every((id) => leadLabels.includes(id))) return false;
            }
            if (createdFrom || createdTo) {
                const createdAt = lead.createdAtRaw ? new Date(lead.createdAtRaw) : null;
                if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
                if (createdFrom) {
                    const from = new Date(`${createdFrom}T00:00:00`);
                    if (createdAt < from) return false;
                }
                if (createdTo) {
                    const to = new Date(`${createdTo}T23:59:59`);
                    if (createdAt > to) return false;
                }
            }
            if (!term) return true;
            const haystack = `${lead.name} ${lead.phone} ${lead.description} ${lead.owner}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [leads, searchTerm, selectedResponsibleIds, selectedLabelIds, createdFrom, createdTo, labelsByContact]);
    const totalPipelineValue = useMemo(
        () =>
            filteredLeads.reduce(
                (sum, lead) => sum + resolveLeadPipelineValue(lead, leadFieldValues),
                0
            ),
        [filteredLeads, leadFieldValues]
    );

    function applyCrmState(next: CrmState) {
        crmStateRef.current = next;
        setStages(next.stages);
        setLeadStageMap(next.leadStageMap);
        setCustomFields(next.customFields);
        setLeadFieldOrder(next.leadFieldOrder);
        setLeadFieldValues(next.leadFieldValues);
        setFollowUps(next.followUps);
        setFollowUpNotifications(next.followUpNotifications);
    }

    function persistCrmStatePatch(patch: Partial<CrmState>) {
        const next: CrmState = {
            ...crmStateRef.current,
            ...patch,
        };
        crmStateRef.current = next;
        void mergeCrmStatePatchToApi(patch)
            .then((savedState) => {
                applyCrmState(savedState);
            })
            .catch(() => {
                setError("Não foi possível salvar os dados do CRM no servidor.");
            });
    }

    async function refreshConversations() {
        const res = await fetch("/api/atendimentos/conversations", { cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar atendimentos.");
        const data = (await res.json().catch(() => [])) as ApiConversation[];
        setConversations(Array.isArray(data) ? data : []);
    }

    async function refreshUsers() {
        const res = await fetch("/api/atendimentos/users", { cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar usuários.");
        const data = (await res.json().catch(() => [])) as AtendimentoUser[];
        setAvailableUsers(Array.isArray(data) ? data : []);
    }

    async function refreshPublicCatalogLeads() {
        const res = await fetch("/api/ioauto/public-catalog-leads?preset=LAST_30_DAYS", { cache: "no-store" });
        if (!res.ok) {
            if (res.status === 403 || res.status === 404) {
                setPublicCatalogLeads([]);
                return;
            }
            throw new Error("Falha ao carregar leads do catálogo público.");
        }
        const data = (await res.json().catch(() => ({ leads: [] }))) as PublicCatalogLeadList;
        setPublicCatalogLeads(Array.isArray(data?.leads) ? data.leads : []);
    }

    async function refreshCrmState() {
        const crmState = await loadCrmStateFromApi();
        applyCrmState(crmState);
    }

    useEffect(() => {
        closeEditor();
    }, [selectedLeadId]);

    useEffect(() => {
        if (!isFilterOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (!filterPanelRef.current) return;
            if (event.target instanceof Node && !filterPanelRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFilterOpen]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            try {
                await Promise.all([refreshConversations(), refreshCrmState(), refreshUsers(), refreshPublicCatalogLeads()]);
                setAvailableLabels(listContactLabels());
                setLabelsByContact(listContactLabelAssignments());
            } catch {
                setError("Não foi possível carregar os dados do CRM.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    useEffect(() => {
        let isRefreshingConversations = false;
        let isRefreshingCrmState = false;
        let isRefreshingPublicCatalogLeads = false;
        const unsubscribe = subscribeRealtime((event) => {
            if (event.type === "conversation.changed" || event.type === "message.changed") {
                if (isRefreshingConversations) return;
                isRefreshingConversations = true;
                window.setTimeout(async () => {
                    try {
                        await refreshConversations();
                    } catch {
                        // ignora erro momentaneo realtime
                    } finally {
                        isRefreshingConversations = false;
                    }
                }, 120);
            }
            if (event.type === "public.catalog.lead.created") {
                if (isRefreshingPublicCatalogLeads) return;
                isRefreshingPublicCatalogLeads = true;
                window.setTimeout(async () => {
                    try {
                        await refreshPublicCatalogLeads();
                    } catch {
                        // ignora erro momentaneo realtime
                    } finally {
                        isRefreshingPublicCatalogLeads = false;
                    }
                }, 120);
            }
            if (event.type === "crm.state.changed") {
                if (isRefreshingCrmState) return;
                isRefreshingCrmState = true;
                window.setTimeout(async () => {
                    try {
                        await refreshCrmState();
                    } catch {
                        // ignora erro momentaneo realtime
                    } finally {
                        isRefreshingCrmState = false;
                    }
                }, 120);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!orderedStages.length || !leads.length) return;
        const validStageIds = new Set(orderedStages.map((stage) => stage.id));
        const defaultStageId = orderedStages[0].id;
        setLeadStageMap((previous) => {
            let changed = false;
            const next = { ...previous };
            for (const lead of leads) {
                const currentStageId = next[lead.id];
                if (!currentStageId || !validStageIds.has(currentStageId)) {
                    next[lead.id] = defaultStageId;
                    changed = true;
                }
            }
            if (changed) persistCrmStatePatch({ leadStageMap: next });
            return changed ? next : previous;
        });
    }, [orderedStages, leads]);

    function updateLeadStage(leadId: string, stageId: string) {
        setLeadStageMap((previous) => {
            const next = { ...previous, [leadId]: stageId };
            persistCrmStatePatch({ leadStageMap: next });
            return next;
        });
    }

    function updateLeadFieldValue(leadId: string, fieldId: string, value: string) {
        setLeadFieldValues((previous) => {
            const next = { ...previous, [leadId]: { ...(previous[leadId] ?? {}), [fieldId]: value } };
            persistCrmStatePatch({ leadFieldValues: next });
            return next;
        });
    }

    function prefetchAtendimento(conversationId: string) {
        router.prefetch(`/protected/atendimentos/${conversationId}?tab=auto`);
    }

    function openAtendimento(conversationId: string) {
        const path = `/protected/atendimentos/${conversationId}?tab=auto`;
        setIsOpeningAtendimento(true);
        router.prefetch(path);
        router.push(path);
    }

    function openPublicLeadDesk() {
        const path = "/protected/leads";
        router.prefetch(path);
        router.push(path);
    }

    function exportCrmCsv() {
        const toCsvCell = (value: unknown) => {
            const normalized = String(value ?? "")
                .normalize("NFC")
                .replace(/\r?\n/g, " ")
                .trim();
            return `"${normalized.replace(/"/g, '""')}"`;
        };
        const toExcelTextCell = (value: unknown) => {
            const normalized = String(value ?? "")
                .normalize("NFC")
                .replace(/\r?\n/g, " ")
                .trim();
            return `"=""${normalized.replace(/"/g, '""')}"""`;
        };

        const customFieldColumns = allLeadFields.map((field) => ({
            id: String(field.customId ?? ""),
            label: field.label,
        })).filter((field) => field.id);

        const header = [
            "Nome",
            "Telefone",
            "Responsável",
            "Etapa",
            "Descrição",
            "Etiquetas",
            "Não lidas",
            "Última atividade",
            "Data de criação",
            ...customFieldColumns.map((field) => field.label),
        ];

        const labelById = new Map(availableLabels.map((label) => [label.id, label.title]));
        const rows = filteredLeads.map((lead) => {
            const stageTitle = orderedStages.find((stage) => stage.id === leadStageMap[lead.id])?.title ?? "";
            const contactKey = normalizePhone(lead.phone);
            const labelTitles = (labelsByContact[contactKey] ?? [])
                .map((id) => labelById.get(id) ?? "")
                .filter(Boolean)
                .join(" | ");
            const customValues = customFieldColumns.map((field) => leadFieldValues[lead.id]?.[field.id] ?? "");
            return [
                lead.name,
                lead.phone,
                lead.owner,
                stageTitle,
                lead.description,
                labelTitles,
                String(lead.unreadCount),
                lead.lastAt,
                lead.createdAtRaw ? formatDateTime(lead.createdAtRaw) : "-",
                ...customValues,
            ];
        });

        const csvLines = [
            "sep=;",
            ["\uFEFF" + header[0], ...header.slice(1)].map((cell) => toCsvCell(cell)).join(";"),
            ...rows.map((row) =>
                row.map((cell, index) => (index === 1 ? toExcelTextCell(cell) : toCsvCell(cell))).join(";")
            ),
        ];
        const csv = csvLines.join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `crm_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function openEditor(key: string, value: string) {
        setActiveEditor(key);
        setEditorValue(key === CRM_VALUE_FIELD_KEY ? formatCurrencyInput(value) : value);
    }

    function closeEditor() {
        setActiveEditor(null);
        setEditorValue("");
    }

    function saveEditorValue() {
        if (!selectedLead || !activeEditor) return;
        if (activeEditor.startsWith("custom:")) {
            const fieldId = activeEditor.replace("custom:", "");
            updateLeadFieldValue(
                selectedLead.id,
                fieldId,
                fieldId === CRM_VALUE_FIELD_ID ? normalizeCurrencyStorageValue(editorValue) : editorValue
            );
            closeEditor();
        }
    }

    function openConfigureFields() {
        setFieldDrafts(ensureValueFieldDrafts(allLeadFields.map((field) => ({ ...field }))));
        setFieldError(null);
        setIsConfigureFieldsOpen(true);
    }

    function handleFieldDrop(targetIndex: number) {
        if (!dragFieldKey) return;
        setFieldDrafts((previous) => {
            const fromIndex = previous.findIndex((item) => item.key === dragFieldKey);
            if (fromIndex < 0 || fromIndex === targetIndex) return previous;
            const next = [...previous];
            const [item] = next.splice(fromIndex, 1);
            next.splice(targetIndex, 0, item);
            return next;
        });
        setDragFieldKey(null);
    }

    function createFieldInConfigModal() {
        const label = newFieldLabel.trim();
        if (!label) return setFieldError("Informe o nome do campo.");
        if (fieldDrafts.some((field) => field.label.toLowerCase() === label.toLowerCase())) return setFieldError("Já existe um campo com esse nome.");
        const id = `crm_field_${Date.now()}`;
        setFieldDrafts((previous) => [...previous, { key: `custom:${id}`, source: "custom", customId: id, label, type: newFieldType }]);
        setNewFieldLabel("");
        setNewFieldType("text");
        setFieldError(null);
        setIsCreateFieldOpen(false);
    }

    function saveFieldConfiguration() {
        const safeFieldDrafts = ensureValueFieldDrafts(fieldDrafts);
        const now = new Date().toISOString();
        if (safeFieldDrafts.some((field) => !field.label.trim())) return setFieldError("Preencha o nome de todos os campos.");
        const existingById = new Map(customFields.map((field) => [field.id, field]));
        const nextFields: CrmCustomField[] = safeFieldDrafts.map((field, index) => ({
            id: String(field.customId),
            label: field.customId === CRM_VALUE_FIELD_ID ? CRM_VALUE_FIELD_LABEL : field.label.trim(),
            type: field.customId === CRM_VALUE_FIELD_ID ? ("number" as const) : field.type,
            order: index,
            createdAt: existingById.get(String(field.customId))?.createdAt ?? now,
            updatedAt: now,
        }));
        const validIds = new Set(nextFields.map((field) => field.id));
        setLeadFieldValues((previous) => {
            const next: CrmLeadCustomFieldValueMap = {};
            for (const leadId of Object.keys(previous)) {
                const leadValues = previous[leadId] ?? {};
                const cleaned: Record<string, string> = {};
                for (const fieldId of Object.keys(leadValues)) if (validIds.has(fieldId)) cleaned[fieldId] = leadValues[fieldId];
                next[leadId] = cleaned;
            }
            return next;
        });
        const nextOrder = safeFieldDrafts.map((field) => field.key);
        setLeadFieldOrder(nextOrder);
        setCustomFields(nextFields);
        const nextLeadFieldValues: CrmLeadCustomFieldValueMap = {};
        for (const leadId of Object.keys(leadFieldValues)) {
            const leadValues = leadFieldValues[leadId] ?? {};
            const cleaned: Record<string, string> = {};
            for (const fieldId of Object.keys(leadValues)) if (validIds.has(fieldId)) cleaned[fieldId] = leadValues[fieldId];
            nextLeadFieldValues[leadId] = cleaned;
        }
        persistCrmStatePatch({
            customFields: nextFields,
            leadFieldOrder: nextOrder,
            leadFieldValues: nextLeadFieldValues,
        });
        setIsConfigureFieldsOpen(false);
    }

    if (loading) {
        return (
            <section className="flex h-full w-full items-center justify-center bg-io-light p-6">
                <div className="rounded-[28px] border border-black/10 bg-white px-6 py-4 text-sm font-medium text-black/60 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                    Carregando CRM...
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="flex h-full w-full items-center justify-center bg-io-light p-6">
                <div className="rounded-[28px] border border-red-200 bg-white px-6 py-4 text-sm font-medium text-red-700 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                    {error}
                </div>
            </section>
        );
    }

    if (orderedStages.length === 0) {
        return (
            <section className="flex h-full w-full flex-col bg-io-light pt-4 md:pt-6">
                <div className="px-4 md:px-6">
                    <div className="rounded-[32px] border border-black/10 bg-white px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">CRM</p>
                        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-io-dark">Kanban de atendimentos</h1>
                        <p className="mt-2 text-sm text-black/58">Estruture suas etapas comerciais e acompanhe os leads por coluna.</p>
                    </div>
                </div>
                <div className="mx-4 mt-4 grid flex-1 place-items-center rounded-[32px] border border-dashed border-black/15 bg-white p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.04)] md:mx-6">
                    <div>
                        <p className="text-base font-semibold text-io-dark">Nenhuma etapa de atendimento cadastrada.</p>
                        <button
                            type="button"
                            onClick={() => router.push("/protected/configuracoes?view=stages")}
                            className="mt-5 rounded-full bg-io-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
                        >
                            Gerenciar etapas de atendimento
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="flex h-full w-full flex-col bg-io-light pt-4 md:pt-6">
            <div className="mb-4 px-4 md:px-6">
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Módulo CRM</p>
                    <h2 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-io-dark">Kanban de atendimentos</h2>
                    <p className="mt-1.5 text-sm text-black/55">Visualize seus atendimentos em tempo real, com etapas personalizáveis, filtros e movimentação dos leads entre colunas.</p>
                </div>
                <div className="rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-6">
                    {/* Linha superior: busca, filtros e botões */}
                    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
                        <div ref={filterPanelRef} className="relative flex flex-1 flex-wrap items-center gap-3">
                            <label className="flex h-14 flex-1 items-center gap-3 rounded-full border border-black/10 bg-[#fafafa] px-5">
                                <Search className="h-5 w-5 shrink-0 text-black/40" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Pesquisar por nome, telefone, responsável ou contexto"
                                    className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/35"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => setIsFilterOpen((value) => !value)}
                                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-5 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]"
                            >
                                Filtros
                                {activeFilterCount > 0 && (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-io-purple text-[10px] font-bold text-white">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            {isFilterOpen && (
                                <div className="absolute left-0 top-16 z-20 w-[460px] max-w-[92vw] rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
                                    <div className="space-y-4">
                                        <CompactMultiSelect
                                            title="Responsáveis"
                                            placeholder="Adicionar responsáveis"
                                            selectedValues={selectedResponsibleIds}
                                            options={responsibleFilterOptions}
                                            emptyOptionsMessage="Nenhum responsável encontrado."
                                            emptySelectionMessage="Todos os responsáveis."
                                            onChange={setSelectedResponsibleIds}
                                        />
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-black/70">Data de criação</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={createdFrom}
                                                    onChange={(event) => setCreatedFrom(event.target.value)}
                                                    className="h-10 w-full rounded-xl border border-black/12 px-3 text-sm text-io-dark outline-none focus:border-black/35"
                                                />
                                                <span className="text-sm text-black/60">a</span>
                                                <input
                                                    type="date"
                                                    value={createdTo}
                                                    onChange={(event) => setCreatedTo(event.target.value)}
                                                    className="h-10 w-full rounded-xl border border-black/12 px-3 text-sm text-io-dark outline-none focus:border-black/35"
                                                />
                                            </div>
                                        </div>
                                        <CompactMultiSelect
                                            title="Etiquetas"
                                            placeholder="Adicionar etiquetas"
                                            selectedValues={selectedLabelIds}
                                            options={labelFilterOptions}
                                            emptyOptionsMessage="Sem etiquetas cadastradas."
                                            emptySelectionMessage="Nenhuma etiqueta selecionada."
                                            helperText="Contêm estas etiquetas"
                                            onChange={setSelectedLabelIds}
                                        />
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedResponsibleIds([]);
                                                    setSelectedLabelIds([]);
                                                    setCreatedFrom("");
                                                    setCreatedTo("");
                                                }}
                                                className="rounded-xl border border-black/15 px-3 py-2 text-sm text-black/65"
                                            >
                                                Limpar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterOpen(false)}
                                                className="rounded-full bg-io-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={exportCrmCsv} className="inline-flex h-14 items-center gap-2 rounded-full border border-black/12 bg-white px-5 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]">Exportar</button>
                            <button type="button" onClick={() => router.push("/protected/configuracoes?view=stages")} className="inline-flex h-14 items-center gap-2 rounded-full border border-black/12 bg-white px-5 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]">Gerenciar etapas</button>
                        </div>
                    </div>

                    {/* Metric cards abaixo */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[24px] border border-black/8 bg-[#fafafa] px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">Leads visíveis</p>
                            <p className="mt-2 text-3xl font-bold tracking-tight text-io-dark">{filteredLeads.length}</p>
                            <p className="mt-2 text-sm text-black/52">{orderedStages.length} etapas configuradas</p>
                        </div>
                        <div
                            className="rounded-[24px] border border-black/8 bg-[#fafafa] px-4 py-4"
                            title={formatCurrencyTotal(totalPipelineValue)}
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">Pipeline</p>
                            <p className="mt-2 text-[clamp(1.8rem,3vw,2.4rem)] font-bold leading-none tracking-tight text-io-dark">
                                {formatCompactCurrencyTotal(totalPipelineValue)}
                            </p>
                            <p className="mt-2 text-sm text-black/52">Valor somado dos cards filtrados</p>
                        </div>
                    </div>
                </div>
            </div>


            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]">
                    <div className="flex h-full min-h-0 min-w-max gap-4 pb-4 pl-4 pr-4 md:pl-6 md:pr-6">
                    {orderedStages.map((stage) => {
                        const stageLeads = filteredLeads.filter((lead) => leadStageMap[lead.id] === stage.id);
                        const stageTotal = stageLeads.reduce(
                            (sum, lead) => sum + resolveLeadPipelineValue(lead, leadFieldValues),
                            0
                        );
                        return (
                            <section
                                key={stage.id}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    if (draggingLeadId) setDragOverStageId(stage.id);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    if (!draggingLeadId) return;
                                    updateLeadStage(draggingLeadId, stage.id);
                                    setDraggingLeadId(null);
                                    setDragOverStageId(null);
                                }}
                                className={`flex h-full min-h-0 w-[338px] shrink-0 flex-col rounded-[28px] border p-3 shadow-[0_18px_40px_rgba(15,23,42,0.05)] ${
                                    dragOverStageId === stage.id
                                        ? "border-black/35 bg-white"
                                        : "border-black/10 bg-white "
                                }`}
                            >
                                <header className="mb-3 flex items-center justify-between rounded-[22px] bg-white px-3 py-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageColor }} /><h2 className="truncate text-sm font-semibold text-io-dark">{stage.title}</h2></div>
                                        <p className="mt-1 text-[11px] font-medium text-emerald-700">{formatCurrencyTotal(stageTotal)}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black/65 shadow-sm">{stageLeads.length}</span>
                                </header>
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                    {stageLeads.length === 0 ? <div className="rounded-[22px] border border-dashed border-black/15 bg-io-light px-3 py-5 text-center text-xs text-black/45">Nenhum lead nesta etapa.</div> : stageLeads.map((lead) => {
                                        return (
                                            <div
                                                key={lead.id}
                                                role="button"
                                                tabIndex={0}
                                                draggable
                                                onDragStart={() => setDraggingLeadId(lead.id)}
                                                onDragEnd={() => { setDraggingLeadId(null); setDragOverStageId(null); }}
                                                onClick={() => setSelectedLeadId(lead.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        setSelectedLeadId(lead.id);
                                                    }
                                                }}
                                                className={`relative w-full min-h-[132px] cursor-pointer rounded-[24px] border border-black/10 bg-white p-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_20px_36px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-black/10 ${draggingLeadId === lead.id ? "opacity-60" : ""}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="truncate text-sm font-semibold text-io-dark">{lead.name}</p>
                                                        <span className="max-w-[50%] truncate rounded-full bg-io-light px-2.5 py-1 text-[11px] font-medium text-black/62">{lead.owner}</span>
                                                    </div>
                                                    <p className="mt-2 pr-10 line-clamp-3 text-xs leading-5 text-black/58">{lead.description}</p>
                                                    <div className="mt-3 flex items-center gap-2 text-[11px] text-black/45">
                                                        <span className="rounded-full bg-black/[0.04] px-2.5 py-1">{lead.phone}</span>
                                                        <span className="rounded-full bg-black/[0.04] px-2.5 py-1">{lead.lastAt}</span>
                                                    </div>
                                                    {lead.kind === "conversation" ? (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openAtendimento(lead.id);
                                                            }}
                                                            onMouseEnter={() => prefetchAtendimento(lead.id)}
                                                            className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-black/12 bg-io-purple text-white transition hover:bg-io-purple"
                                                            aria-label={`Abrir atendimento${lead.unreadCount > 0 ? ` com ${lead.unreadCount} mensagens não lidas` : ""}`}
                                                            title="Abrir atendimento"
                                                        >
                                                            <MessageCircleMore className="h-3.5 w-3.5" strokeWidth={2} />
                                                            {lead.unreadCount > 0 && (
                                                                <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                                                                    {lead.unreadCount > 9 ? "9+" : lead.unreadCount}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openPublicLeadDesk();
                                                            }}
                                                            className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-black/12 bg-emerald-600 text-white transition hover:bg-emerald-700"
                                                            aria-label="Abrir lista de leads"
                                                            title="Abrir lista de leads"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                                                        </button>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                    </div>
                </div>
            </div>

            {selectedLead && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
                    <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/15 bg-io-light shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="border-b border-black/10 bg-white px-8 pb-5 pt-5">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Lead em foco</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-io-dark">{selectedLead.name}</h2>
                                        <p className="mt-1 text-sm text-black/60">{selectedLead.owner}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={openConfigureFields}
                                            className="rounded-full bg-io-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
                                        >
                                            Configurar campos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLeadId(null)}
                                            className="grid h-10 w-10 place-items-center rounded-full border border-black/12 text-black/65 transition hover:bg-black/[0.04]"
                                            aria-label="Fechar"
                                            title="Fechar"
                                            >
                                                <X className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <p className="text-xl font-semibold text-io-dark">Contatos</p>
                                    <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-io-dark shadow-sm">{selectedLeadStage?.title ?? "Etapa"}</span>
                                </div>
                                <div className="mb-7 flex items-center justify-between gap-4 rounded-[28px] border border-black/10 bg-white px-5 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                                    <div className="flex items-center gap-4">
                                        {selectedLead.photoUrl ? (
                                            <img src={selectedLead.photoUrl} alt={selectedLead.name} className="h-12 w-12 rounded-full object-cover" />
                                        ) : (
                                            <div className="grid h-12 w-12 place-items-center rounded-full bg-io-light text-xs font-semibold text-io-dark">{toInitials(selectedLead.name)}</div>
                                        )}
                                        <div>
                                            <p className="text-lg font-medium text-io-dark">{selectedLead.name}</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {selectedLead.kind === "public_catalog" ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Catálogo público</span>
                                                ) : null}
                                                {selectedLeadLabels.length > 0
                                                    ? selectedLeadLabels.map((label) => <LabelBadge key={label.id} label={label} />)
                                                    : <span className="text-xs text-black/50">Sem etiquetas</span>}
                                            </div>
                                            {selectedLead.kind === "public_catalog" ? (
                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">Veículo de interesse</p>
                                                        <p className="mt-1 text-sm font-semibold text-io-dark">{selectedLead.interestLabel ?? "Catálogo geral"}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-black/10 bg-io-light px-3 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">Origem</p>
                                                        <p className="mt-1 text-sm font-semibold text-io-dark">{selectedLead.sourceLabel ?? "Catálogo público"}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    {selectedLead.kind === "conversation" ? (
                                        <button
                                            type="button"
                                            onClick={() => openAtendimento(selectedLead.id)}
                                            onMouseEnter={() => prefetchAtendimento(selectedLead.id)}
                                            className="grid h-10 w-10 place-items-center rounded-full border border-black/12 bg-io-purple text-white transition hover:bg-io-purple"
                                            aria-label="Abrir atendimento"
                                            title="Abrir atendimento"
                                        >
                                            <MessageCircleMore className="h-5 w-5" strokeWidth={2} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={openPublicLeadDesk}
                                            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                        >
                                            <ExternalLink className="h-4 w-4" strokeWidth={2} />
                                            Abrir lista de leads
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-5">
                                    {allLeadFields.length === 0 ? (
                                        <div className="rounded-[24px] border border-dashed border-black/18 bg-white p-4 text-sm text-black/55">
                                            Nenhum campo cadastrado para este lead.
                                        </div>
                                    ) : allLeadFields.map((field) => {
                                        const key = field.key;
                                        const isValueField = field.customId === CRM_VALUE_FIELD_ID;
                                        const isEditing = activeEditor === key;
                                        const currentValue = leadFieldValues[selectedLead.id]?.[String(field.customId)] ?? "";
                                        const displayValue = isValueField
                                            ? (String(currentValue).trim()
                                                ? formatCurrencyAmount(currentValue)
                                                : selectedLead.kind === "public_catalog"
                                                    ? formatCurrencyFromCents(selectedLead.fallbackValueCents)
                                                    : "-")
                                            : (String(currentValue).trim() || "-");
                                        return (
                                            <div key={key}>
                                                <label className="mb-1 block text-base font-medium text-black/60">{field.label}</label>
                                                {isEditing ? (
                                                    field.type === "textarea" ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                value={editorValue}
                                                                autoFocus
                                                                rows={3}
                                                                onChange={(event) => setEditorValue(event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Escape") closeEditor();
                                                                }}
                                                                className="w-full rounded-xl border border-black/12 px-3 py-2 text-sm text-io-dark outline-none focus:border-black/35"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <button type="button" onClick={saveEditorValue} className="rounded-full bg-io-purple px-3 py-1.5 text-xs font-semibold text-white">Salvar</button>
                                                                <button type="button" onClick={closeEditor} className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold text-black/70">Cancelar</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <input
                                                                value={editorValue}
                                                                autoFocus
                                                                onChange={(event) => setEditorValue(isValueField ? formatCurrencyInput(event.target.value) : event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Escape") closeEditor();
                                                                    if (event.key === "Enter") saveEditorValue();
                                                                }}
                                                                type={isValueField ? "text" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                                                inputMode={isValueField ? "numeric" : undefined}
                                                                placeholder={isValueField ? "R$ 0,00" : undefined}
                                                                className="h-10 w-full rounded-xl border border-black/12 px-3 text-sm text-io-dark outline-none focus:border-black/35"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <button type="button" onClick={saveEditorValue} className="rounded-full bg-io-purple px-3 py-1.5 text-xs font-semibold text-white">Salvar</button>
                                                                <button type="button" onClick={closeEditor} className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold text-black/70">Cancelar</button>
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditor(key, currentValue)}
                                                        className="text-left text-base text-io-dark"
                                                    >
                                                        {displayValue}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="h-4 border-t border-black/10" />
                        </div>
                    </div>
                </div>
            )}

            {isOpeningAtendimento && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-black/25">
                    <div className="rounded-[24px] border border-black/10 bg-white px-5 py-4 text-sm font-medium text-io-dark shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                        Abrindo atendimento...
                    </div>
                </div>
            )}

            {isConfigureFieldsOpen && (
                <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-3xl rounded-[30px] border border-white/15 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h3 className="text-xl font-semibold text-io-dark">Configurar campos do lead</h3>
                            <button
                                type="button"
                                onClick={() => setIsConfigureFieldsOpen(false)}
                                className="grid h-10 w-10 place-items-center rounded-full border border-black/12 text-black/65 transition hover:bg-black/[0.04]"
                                aria-label="Fechar"
                                title="Fechar"
                            >
                                <X className="h-4 w-4" strokeWidth={2} />
                            </button>
                        </div>
                        <div className="mb-3 space-y-2">
                            {fieldDrafts.length === 0 ? <div className="rounded-[24px] border border-dashed border-black/20 bg-io-light p-4 text-sm text-black/55">Nenhum campo cadastrado.</div> : fieldDrafts.map((field, index) => (
                                <div
                                    key={field.key}
                                    draggable
                                    onDragStart={() => setDragFieldKey(field.key)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => handleFieldDrop(index)}
                                    onDragEnd={() => setDragFieldKey(null)}
                                    className={`grid grid-cols-[40px_1fr_auto] items-center gap-2 rounded-[22px] border border-black/10 bg-io-light p-2 ${dragFieldKey === field.key ? "opacity-60" : ""}`}
                                >
                                    <div className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 text-black/60">::</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={field.label}
                                            readOnly={field.customId === CRM_VALUE_FIELD_ID}
                                            onChange={(event) => setFieldDrafts((prev) => prev.map((it, i) => (i === index ? { ...it, label: event.target.value } : it)))}
                                            className={`h-10 w-full rounded-xl border border-black/15 px-3 text-sm ${field.customId === CRM_VALUE_FIELD_ID ? "bg-black/5 text-black/55" : ""}`}
                                        />
                                        {field.customId === CRM_VALUE_FIELD_ID && (
                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Padrao</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFieldDrafts((prev) => prev.filter((it) => it.key !== field.key))}
                                        disabled={field.customId === CRM_VALUE_FIELD_ID}
                                        className={`grid h-9 w-9 place-items-center rounded-lg ${field.customId === CRM_VALUE_FIELD_ID ? "cursor-not-allowed border border-black/10 bg-black/5 text-black/25" : "border border-red-200 bg-red-50 text-red-700"}`}
                                        aria-label="Excluir campo"
                                        title="Excluir campo"
                                    >
                                        <Trash2 className="h-5 w-5" strokeWidth={1.9} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {fieldError && <p className="mb-3 text-sm text-red-600">{fieldError}</p>}
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    setFieldError(null);
                                    setIsCreateFieldOpen(true);
                                }}
                                className="rounded-full border border-black/12 px-4 py-2.5 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]"
                            >
                                Adicionar novo campo
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsConfigureFieldsOpen(false)}
                                    className="rounded-full border border-black/12 px-4 py-2.5 text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={saveFieldConfiguration}
                                    className="rounded-full bg-io-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCreateFieldOpen && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-xl rounded-[30px] border border-white/15 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                        <h3 className="mb-5 text-3xl font-semibold text-io-dark">Adicionar novo campo personalizado</h3>
                        <div className="space-y-4">
                            <div><label className="mb-1 block text-sm font-medium text-io-dark">Tipo *</label><select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as CrmCustomFieldType)} className="h-10 w-full rounded-xl border border-black/15 px-3 text-sm">{FIELD_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                            <div><label className="mb-1 block text-sm font-medium text-io-dark">Nome *</label><input value={newFieldLabel} onChange={(event) => setNewFieldLabel(event.target.value)} className="h-10 w-full rounded-xl border border-black/15 px-3 text-sm" /></div>
                            <div className="rounded-[24px] bg-io-light p-4"><p className="mb-2 text-sm font-semibold text-io-dark">Nome do campo</p><input value={newFieldLabel} readOnly placeholder="Texto" className="h-10 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black/60" /></div>
                        </div>
                        {fieldError && <p className="mt-3 text-sm text-red-600">{fieldError}</p>}
                        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setIsCreateFieldOpen(false)} className="rounded-full border border-black/15 px-7 py-2 text-base text-black/60">Cancelar</button><button type="button" onClick={createFieldInConfigModal} className="rounded-full bg-io-purple px-7 py-2 text-base font-semibold text-white transition hover:bg-black/85">Salvar</button></div>
                    </div>
                </div>
            )}
        </section>
    );
}
