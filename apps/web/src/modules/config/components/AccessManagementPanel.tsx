"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Pencil,
    Trash2,
} from "lucide-react";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";
import {
    listAtendimentoClassificationCategories,
    loadCustomAtendimentoClassifications,
    saveCustomAtendimentoClassifications,
    type AtendimentoClassificationCategoryId,
    type AtendimentoClassification,
} from "@/modules/classificacoes/storage";
import { AtendimentoClassificationCategoryIcon } from "@/modules/classificacoes/icons";
import {
    getLabelTextColor,
    loadContactLabels,
    normalizeHexColor,
    saveContactLabels,
    type ContactLabel,
} from "@/modules/etiquetas/storage";
import {
    loadCrmStateFromApi,
    saveCrmStateToApi,
    type CrmStage,
    type CrmStageKind,
} from "@/modules/crm/storage";

type Me = { userId: string; companyId: string; email: string; roles: string[] };
type BusinessWeekDayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
type BusinessHoursDay = {
    active: boolean;
    start: string;
    lunchStart: string;
    lunchEnd: string;
    end: string;
};
type BusinessHoursWeekly = Record<BusinessWeekDayKey, BusinessHoursDay>;

const BUSINESS_WEEK_DAYS: Array<{ key: BusinessWeekDayKey; label: string }> = [
    { key: "sunday", label: "Domingo" },
    { key: "monday", label: "Segunda-feira" },
    { key: "tuesday", label: "Terça-feira" },
    { key: "wednesday", label: "Quarta-feira" },
    { key: "thursday", label: "Quinta-feira" },
    { key: "friday", label: "Sexta-feira" },
    { key: "saturday", label: "Sábado" },
];

type User = {
    id: string;
    companyId?: string;
    email: string;
    fullName: string;
    profileImageUrl?: string | null;
    jobTitle?: string | null;
    birthDate?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    teamId?: string | null;
    teamName?: string | null;
    createdAt: string;
    roles: string[];
};
type Team = {
    id: string;
    companyId?: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};
type Company = {
    id: string;
    name: string;
    profileImageUrl?: string | null;
    email?: string | null;
    contractEndDate?: string | null;
    cnpj?: string | null;
    openedAt?: string | null;
    whatsappNumber?: string | null;
    businessHoursStart?: string | null;
    businessHoursEnd?: string | null;
    businessHoursWeekly?: Partial<Record<BusinessWeekDayKey, Partial<BusinessHoursDay>>> | null;
    createdAt: string;
};

type CompanyCreateForm = {
    profileImageUrl: string;
    companyName: string;
    companyEmail: string;
    contractEndDate: string;
    cnpj: string;
    openedAt: string;
    whatsappNumber: string;
    password: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessHoursWeekly: BusinessHoursWeekly;
};

type UserPermissionPreset = "admin" | "default" | "custom";
type UserModulePermissions = {
    manageCampaigns: boolean;
    manageCollaborators: boolean;
    manageProducts: boolean;
    atendimentos: boolean;
    reports: boolean;
    crm: boolean;
};
type UserCreateForm = {
    profileImageUrl: string;
    fullName: string;
    email: string;
    jobTitle: string;
    birthDate: string;
    teamId: string;
    password: string;
    permissionPreset: UserPermissionPreset;
    modules: UserModulePermissions;
};

type Toast = {
    id: number;
    message: string;
    type: "success" | "error" | "info";
};

function getInitialUserModules(): UserModulePermissions {
    return {
        manageCampaigns: false,
        manageCollaborators: false,
        manageProducts: false,
        atendimentos: false,
        reports: false,
        crm: false,
    };
}

function getInitialUserCreateForm(): UserCreateForm {
    return {
        profileImageUrl: "",
        fullName: "",
        email: "",
        jobTitle: "",
        birthDate: "",
        teamId: "",
        password: "",
        permissionPreset: "default",
        modules: getInitialUserModules(),
    };
}

function modulesFromKeys(keys?: string[] | null): UserModulePermissions {
    const set = new Set((keys ?? []).map((k) => k.trim()));
    return {
        manageCampaigns: set.has("manageCampaigns"),
        manageCollaborators: set.has("manageCollaborators"),
        manageProducts: set.has("manageProducts"),
        atendimentos: set.has("atendimentos"),
        reports: set.has("reports"),
        crm: set.has("crm"),
    };
}

function inferPresetFromUser(user: User): UserPermissionPreset {
    const preset = (user.permissionPreset ?? "").toLowerCase();
    if (preset === "admin" || preset === "default" || preset === "custom") return preset;
    if ((user.roles ?? []).some((r) => r.toUpperCase() === "ADMIN")) return "admin";
    if ((user.roles ?? []).some((r) => r.toUpperCase() === "MANAGER")) return "default";
    return "custom";
}

function isValidEmailFormat(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidBusinessHour(value: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function toInitials(name: string) {
    const parts = (name ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return "US";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getInitialCompanyCreateForm(): CompanyCreateForm {
    return {
        profileImageUrl: "",
        companyName: "",
        companyEmail: "",
        contractEndDate: "",
        cnpj: "",
        openedAt: "",
        whatsappNumber: "",
        password: "",
        businessHoursStart: "09:00",
        businessHoursEnd: "18:00",
        businessHoursWeekly: getDefaultBusinessHoursWeekly(),
    };
}

function getDefaultBusinessHoursWeekly(): BusinessHoursWeekly {
    return {
        sunday: { active: false, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        monday: { active: true, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        tuesday: { active: true, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        wednesday: { active: true, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        thursday: { active: true, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        friday: { active: true, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
        saturday: { active: false, start: "08:00", lunchStart: "12:00", lunchEnd: "13:15", end: "18:00" },
    };
}

function normalizeBusinessHoursWeekly(raw?: Partial<Record<BusinessWeekDayKey, Partial<BusinessHoursDay>>> | null): BusinessHoursWeekly {
    const defaults = getDefaultBusinessHoursWeekly();
    const next = { ...defaults } as BusinessHoursWeekly;
    for (const day of BUSINESS_WEEK_DAYS) {
        const current = raw?.[day.key];
        if (!current) continue;
        next[day.key] = {
            active: typeof current.active === "boolean" ? current.active : defaults[day.key].active,
            start: current.start ?? defaults[day.key].start,
            lunchStart: current.lunchStart ?? defaults[day.key].lunchStart,
            lunchEnd: current.lunchEnd ?? defaults[day.key].lunchEnd,
            end: current.end ?? defaults[day.key].end,
        };
    }
    return next;
}

function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
}

function formatPhoneInput(value: string) {
    const digits = normalizePhone(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toDateInputValue(value?: string | null) {
    if (!value) return "";
    return value.includes("T") ? value.split("T")[0] : value;
}

function getStageKindLabel(kind: CrmStageKind) {
    if (kind === "initial") return "Fase inicial";
    if (kind === "final") return "Fase final";
    return "Fase intermediária";
}

type View = "home" | "users" | "teams" | "companies" | "labels" | "classifications" | "stages";
type Modal =
    | { type: "none" }
    | { type: "create-user" }
    | { type: "edit-user"; item: User }
    | { type: "delete-user"; item: User }
    | { type: "create-team" }
    | { type: "edit-team"; item: Team }
    | { type: "delete-team"; item: Team }
    | { type: "create-company" }
    | { type: "edit-company"; item: Company }
    | { type: "delete-company"; item: Company };
type LabelModal =
    | { type: "none" }
    | { type: "create" }
    | { type: "edit"; item: ContactLabel }
    | { type: "delete"; item: ContactLabel };
type ClassificationModal =
    | { type: "none" }
    | { type: "create" }
    | { type: "edit"; item: AtendimentoClassification }
    | { type: "delete"; item: AtendimentoClassification };

type CrmStageDraft = {
    id: string;
    title: string;
    kind: CrmStageKind;
};

function ModalWrap({ title, onClose, children, panelClassName }: { title: string; onClose: () => void; children: React.ReactNode; panelClassName?: string }) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
            <div className={`w-full rounded-2xl border border-black/10 bg-white p-5 shadow-soft ${panelClassName ?? "max-w-lg"}`}>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-io-dark">{title}</h3>
                    <button type="button" onClick={onClose} className="text-sm text-black/60">Fechar</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function AccessManagementPanel() {
    const searchParams = useSearchParams();
    const [me, setMe] = useState<Me | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [view, setView] = useState<View>("home");
    const [modal, setModal] = useState<Modal>({ type: "none" });
    const [labelModal, setLabelModal] = useState<LabelModal>({ type: "none" });
    const [classificationModal, setClassificationModal] = useState<ClassificationModal>({ type: "none" });
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [companyModalMsg, setCompanyModalMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [userCreateForm, setUserCreateForm] = useState<UserCreateForm>(getInitialUserCreateForm);
    const [userCreateStep, setUserCreateStep] = useState<1 | 2>(1);
    const [showUserCreatePassword, setShowUserCreatePassword] = useState(false);
    const [userCreateModalMsg, setUserCreateModalMsg] = useState<string | null>(null);
    const [userEditForm, setUserEditForm] = useState<UserCreateForm>(getInitialUserCreateForm);
    const [userEditStep, setUserEditStep] = useState<1 | 2>(1);
    const [showUserEditPassword, setShowUserEditPassword] = useState(false);
    const [userEditModalMsg, setUserEditModalMsg] = useState<string | null>(null);
    const [teamModalMsg, setTeamModalMsg] = useState<string | null>(null);
    const [teamFormName, setTeamFormName] = useState("");
    const [companyCreateForm, setCompanyCreateForm] = useState<CompanyCreateForm>(getInitialCompanyCreateForm);
    const [companyCreateStep, setCompanyCreateStep] = useState<1 | 2>(1);
    const [showCompanyPassword, setShowCompanyPassword] = useState(false);
    const [companyEditForm, setCompanyEditForm] = useState<CompanyCreateForm>(getInitialCompanyCreateForm);
    const [companyEditStep, setCompanyEditStep] = useState<1 | 2>(1);
    const [showCompanyEditPassword, setShowCompanyEditPassword] = useState(false);
    const [companyEditModalMsg, setCompanyEditModalMsg] = useState<string | null>(null);
    const [contactLabels, setContactLabels] = useState<ContactLabel[]>([]);
    const [labelForm, setLabelForm] = useState({ title: "", color: "#7C3AED" });
    const [labelModalMsg, setLabelModalMsg] = useState<string | null>(null);
    const [customClassifications, setCustomClassifications] = useState<AtendimentoClassification[]>([]);
    const [classificationFormTitle, setClassificationFormTitle] = useState("");
    const [classificationFormCategoryId, setClassificationFormCategoryId] = useState<AtendimentoClassificationCategoryId>("other");
    const [classificationFormHasValue, setClassificationFormHasValue] = useState(false);
    const [classificationFormValue, setClassificationFormValue] = useState("");
    const [classificationModalMsg, setClassificationModalMsg] = useState<string | null>(null);
    const [crmStages, setCrmStages] = useState<CrmStage[]>([]);
    const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);
    const [crmStageDrafts, setCrmStageDrafts] = useState<CrmStageDraft[]>([]);
    const [crmStageModalMsg, setCrmStageModalMsg] = useState<string | null>(null);

    const isAdmin = useMemo(() => me?.roles.some((r) => r.toUpperCase() === "ADMIN") ?? false, [me]);
    const isSuperAdmin = useMemo(() => me?.roles.some((r) => r.toUpperCase() === "SUPERADMIN") ?? false, [me]);
    const canManageUsers = isAdmin || isSuperAdmin;
    const roleOptions = useMemo(() => roles.filter((r) => isSuperAdmin || r.toUpperCase() !== "SUPERADMIN"), [roles, isSuperAdmin]);
    const classificationCategories = useMemo(() => listAtendimentoClassificationCategories(), []);
    useEffect(() => {
        const initialView = searchParams?.get("view");
        if (initialView === "stages") {
            setView("stages");
        }
    }, [searchParams]);

    function pushToast(message: string, type: Toast["type"]) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
    }

    function removeToast(id: number) {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }

    useEffect(() => {
        async function boot() {
            setLoading(true);
            setToasts([]);
            const [meRes, rolesRes] = await Promise.all([
                fetch("/api/auth/me"),
                fetch("/api/auth/roles"),
                loadTeams().catch(() => setTeams([])),
                loadLabels().catch(() => setContactLabels([])),
                loadCustomClassifications().catch(() => setCustomClassifications([])),
                loadCrmStages(),
            ]);
            if (!meRes.ok) {
                pushToast("Falha ao carregar usuário", "error");
                setLoading(false);
                return;
            }
            const meData = (await meRes.json()) as Me;
            const rolesData = rolesRes.ok ? ((await rolesRes.json()) as string[]) : ["ADMIN", "MANAGER", "AGENT"];
            setMe(meData);
            setRoles(rolesData);
            setLoading(false);
        }
        boot();
    }, []);

    async function loadUsers() {
        const res = await fetch("/api/auth/users");
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error((data as { message?: string }).message ?? "Falha ao listar colaboradores");
        setUsers(data as User[]);
    }

    async function loadTeams() {
        const res = await fetch("/api/auth/teams");
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error((data as { message?: string }).message ?? "Falha ao listar equipes");
        setTeams(data as Team[]);
    }

    async function loadCompanies() {
        const res = await fetch("/api/auth/companies");
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error((data as { message?: string }).message ?? "Falha ao listar empresas");
        setCompanies(data as Company[]);
    }

    async function loadLabels() {
        setContactLabels(await loadContactLabels());
    }

    async function loadCustomClassifications() {
        setCustomClassifications(await loadCustomAtendimentoClassifications());
    }

    async function loadCrmStages() {
        try {
            const state = await loadCrmStateFromApi();
            setCrmStages(state.stages);
        } catch {
            setCrmStages([]);
        }
    }

    function openStagesModal() {
        const source = crmStages;
        setCrmStageDrafts(
            source.map((stage) => ({
                id: stage.id,
                title: stage.title,
                kind: stage.kind,
            }))
        );
        setCrmStageModalMsg(null);
        setIsStagesModalOpen(true);
    }

    function closeStagesModal() {
        setIsStagesModalOpen(false);
        setCrmStageModalMsg(null);
    }

    function addStageDraft() {
        setCrmStageDrafts((previous) => [
            ...previous,
            {
                id: `crm_stage_${Date.now()}`,
                title: "",
                kind: previous.length === 0 ? "initial" : "intermediate",
            },
        ]);
    }

    function moveStageDraft(index: number, direction: -1 | 1) {
        setCrmStageDrafts((previous) => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= previous.length) return previous;
            const next = [...previous];
            const [item] = next.splice(index, 1);
            next.splice(targetIndex, 0, item);
            return next;
        });
    }

    async function saveStageDrafts() {
        setCrmStageModalMsg(null);
        if (crmStageDrafts.length === 0) {
            setCrmStageModalMsg("Adicione pelo menos uma etapa.");
            return;
        }
        const now = new Date().toISOString();
        const normalized: CrmStage[] = [];
        for (let index = 0; index < crmStageDrafts.length; index += 1) {
            const item = crmStageDrafts[index];
            const title = item.title.trim();
            if (!title) {
                setCrmStageModalMsg("Preencha o nome de todas as etapas.");
                return;
            }
            normalized.push({
                id: item.id,
                title,
                kind: item.kind,
                order: index,
                createdAt: now,
                updatedAt: now,
            });
        }
        const hasInitial = normalized.some((item) => item.kind === "initial");
        if (!hasInitial) {
            setCrmStageModalMsg("Defina ao menos uma etapa como fase inicial.");
            return;
        }
        try {
            const current = await loadCrmStateFromApi();
            await saveCrmStateToApi({
                ...current,
                stages: normalized,
            });
            await loadCrmStages();
            pushToast("Etapas de atendimento atualizadas.", "success");
            closeStagesModal();
        } catch {
            setCrmStageModalMsg("Não foi possível salvar as etapas no servidor.");
        }
    }

    function closeLabelModal() {
        setLabelModal({ type: "none" });
        setLabelModalMsg(null);
        setLabelForm({ title: "", color: "#7C3AED" });
    }

    function closeClassificationModal() {
        setClassificationModal({ type: "none" });
        setClassificationModalMsg(null);
        setClassificationFormTitle("");
        setClassificationFormCategoryId("other");
        setClassificationFormHasValue(false);
        setClassificationFormValue("");
    }

    function isLabelFormValid() {
        return labelForm.title.trim().length > 0;
    }

    function isClassificationFormValid() {
        if (classificationFormTitle.trim().length === 0) return false;
        if (!classificationFormHasValue) return true;
        const parsed = Number(classificationFormValue);
        return Number.isFinite(parsed);
    }

    async function upsertLabel(action: "create" | "edit", current?: ContactLabel) {
        setLabelModalMsg(null);
        if (!isLabelFormValid()) {
            setLabelModalMsg("Informe o título da etiqueta.");
            return;
        }
        const now = new Date().toISOString();
        const cleanTitle = labelForm.title.trim();
        const cleanColor = normalizeHexColor(labelForm.color);
        const duplicate = contactLabels.some((item) => item.id !== current?.id && item.title.trim().toLowerCase() === cleanTitle.toLowerCase());
        if (duplicate) {
            setLabelModalMsg("Já existe uma etiqueta com esse título.");
            return;
        }

        const next = action === "create"
            ? [...contactLabels, { id: `label_${Date.now()}`, title: cleanTitle, color: cleanColor, createdAt: now, updatedAt: now }]
            : contactLabels.map((item) => (item.id === current?.id ? { ...item, title: cleanTitle, color: cleanColor, updatedAt: now } : item));
        try {
            const saved = await saveContactLabels(next);
            setContactLabels(saved);
            pushToast(action === "create" ? "Etiqueta criada com sucesso." : "Etiqueta atualizada com sucesso.", "success");
            closeLabelModal();
        } catch (error) {
            setLabelModalMsg(error instanceof Error ? error.message : "Não foi possível salvar a etiqueta.");
        }
    }

    async function removeLabel(item: ContactLabel) {
        const nextLabels = contactLabels.filter((label) => label.id !== item.id);
        try {
            const saved = await saveContactLabels(nextLabels);
            setContactLabels(saved);
            pushToast("Etiqueta excluída com sucesso.", "success");
            closeLabelModal();
        } catch (error) {
            setLabelModalMsg(error instanceof Error ? error.message : "Não foi possível excluir a etiqueta.");
        }
    }

    async function upsertClassification(action: "create" | "edit", current?: AtendimentoClassification) {
        setClassificationModalMsg(null);
        if (!isClassificationFormValid()) {
            setClassificationModalMsg(classificationFormHasValue ? "Informe um valor numérico válido." : "Informe o título da classificação.");
            return;
        }
        const cleanTitle = classificationFormTitle.trim();
        const duplicate = customClassifications.some((item) => item.id !== current?.id && item.title.trim().toLowerCase() === cleanTitle.toLowerCase());
        if (duplicate) {
            setClassificationModalMsg("Já existe uma classificação com esse título.");
            return;
        }
        const parsedValue = Number(classificationFormValue);
        const normalizedValue = classificationFormHasValue && Number.isFinite(parsedValue) ? parsedValue : null;
        const now = new Date().toISOString();
        const next = action === "create"
            ? [...customClassifications, { id: `classification_${Date.now()}`, title: cleanTitle, categoryId: classificationFormCategoryId, hasValue: classificationFormHasValue, value: normalizedValue, system: false, createdAt: now, updatedAt: now }]
            : customClassifications.map((item) => (item.id === current?.id ? { ...item, title: cleanTitle, categoryId: classificationFormCategoryId, hasValue: classificationFormHasValue, value: normalizedValue, updatedAt: now } : item));

        try {
            const saved = await saveCustomAtendimentoClassifications(next);
            setCustomClassifications(saved);
            pushToast(action === "create" ? "Classificação criada com sucesso." : "Classificação atualizada com sucesso.", "success");
            closeClassificationModal();
        } catch (error) {
            setClassificationModalMsg(error instanceof Error ? error.message : "Não foi possível salvar a classificação.");
        }
    }

    async function removeClassification(item: AtendimentoClassification) {
        const next = customClassifications.filter((classification) => classification.id !== item.id);
        try {
            const saved = await saveCustomAtendimentoClassifications(next);
            setCustomClassifications(saved);
            pushToast("Classificação excluída com sucesso.", "success");
            closeClassificationModal();
        } catch (error) {
            setClassificationModalMsg(error instanceof Error ? error.message : "Não foi possível excluir a classificação.");
        }
    }

    async function hasEmailConflict(
        email: string,
        options: {
            entity: "user" | "company";
            editingId?: string;
            originalEmail?: string;
        },
    ) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return false;
        if (options.originalEmail && normalizedEmail === options.originalEmail.trim().toLowerCase()) return false;

        const usersRes = await fetch("/api/auth/users", { cache: "no-store" });
        const companiesRes = isSuperAdmin
            ? await fetch("/api/auth/companies", { cache: "no-store" })
            : null;

        const usersData = (usersRes.ok ? ((await usersRes.json()) as User[]) : users) ?? [];
        const companiesData = companiesRes && companiesRes.ok ? ((await companiesRes.json()) as Company[]) : companies;

        const userConflict = usersData.some((u) => {
            if (u.email.trim().toLowerCase() !== normalizedEmail) return false;
            if (options.entity === "user" && options.editingId && u.id === options.editingId) return false;
            if (options.entity === "company" && options.editingId && u.companyId === options.editingId) return false;
            return true;
        });
        if (userConflict) return true;

        const companyConflict = companiesData.some((c) => {
            if ((c.email ?? "").trim().toLowerCase() !== normalizedEmail) return false;
            if (options.entity === "company" && options.editingId && c.id === options.editingId) return false;
            return true;
        });
        return companyConflict;
    }

    function closeModal() {
        setModal({ type: "none" });
        setSubmitting(false);
        setUserCreateStep(1);
        setShowUserCreatePassword(false);
        setUserCreateModalMsg(null);
        setUserEditStep(1);
        setShowUserEditPassword(false);
        setUserEditModalMsg(null);
        setTeamModalMsg(null);
        setTeamFormName("");
        setCompanyCreateStep(1);
        setShowCompanyPassword(false);
        setCompanyModalMsg(null);
        setCompanyEditStep(1);
        setShowCompanyEditPassword(false);
        setCompanyEditModalMsg(null);
    }

    function isCompanyStepOneValid() {
        return (
            companyCreateForm.companyName.trim().length > 0 &&
            companyCreateForm.companyEmail.trim().length > 0 &&
            companyCreateForm.contractEndDate.trim().length > 0 &&
            companyCreateForm.cnpj.replace(/\D/g, "").length === 14 &&
            companyCreateForm.openedAt.trim().length > 0 &&
            normalizePhone(companyCreateForm.whatsappNumber).length >= 10 &&
            normalizePhone(companyCreateForm.whatsappNumber).length <= 11 &&
            companyCreateForm.password.trim().length > 0
        );
    }

    function isUserCreateStepOneValid() {
        return (
            userCreateForm.fullName.trim().length > 0 &&
            userCreateForm.email.trim().length > 0 &&
            userCreateForm.jobTitle.trim().length > 0 &&
            userCreateForm.birthDate.trim().length > 0 &&
            userCreateForm.teamId.trim().length > 0 &&
            userCreateForm.password.trim().length > 0
        );
    }

    function isUserCreateStepTwoValid() {
        if (userCreateForm.permissionPreset !== "custom") return true;
        return Object.values(userCreateForm.modules).some(Boolean);
    }

    function isUserEditStepOneValid() {
        return (
            userEditForm.fullName.trim().length > 0 &&
            userEditForm.email.trim().length > 0 &&
            userEditForm.jobTitle.trim().length > 0 &&
            userEditForm.teamId.trim().length > 0 &&
            userEditForm.birthDate.trim().length > 0
        );
    }

    function isUserEditStepTwoValid() {
        if (userEditForm.permissionPreset !== "custom") return true;
        return Object.values(userEditForm.modules).some(Boolean);
    }

    function pickAvailableRole(preferred: string, fallback: string[]) {
        const candidates = [preferred, ...fallback].map((r) => r.toUpperCase());
        const found = candidates.find((candidate) => roleOptions.some((role) => role.toUpperCase() === candidate));
        return found ?? "AGENT";
    }

    function resolveUserRolesFromPreset(permissionPreset: UserPermissionPreset, modules: UserModulePermissions) {
        if (permissionPreset === "admin") {
            return [pickAvailableRole("ADMIN", ["MANAGER", "AGENT"])];
        }
        if (permissionPreset === "default") {
            return [pickAvailableRole("MANAGER", ["ADMIN", "AGENT"])];
        }

        if (modules.manageCollaborators) {
            return [pickAvailableRole("ADMIN", ["MANAGER", "AGENT"])];
        }
        const hasOperationalAccess = modules.manageCampaigns || modules.manageProducts || modules.atendimentos || modules.reports || modules.crm;
        if (hasOperationalAccess) {
            return [pickAvailableRole("MANAGER", ["ADMIN", "AGENT"])];
        }
        return [pickAvailableRole("AGENT", ["MANAGER", "ADMIN"])];
    }

    function isCompanyEditStepOneValid() {
        return (
            companyEditForm.companyName.trim().length > 0 &&
            companyEditForm.companyEmail.trim().length > 0 &&
            companyEditForm.contractEndDate.trim().length > 0 &&
            companyEditForm.cnpj.replace(/\D/g, "").length === 14 &&
            companyEditForm.openedAt.trim().length > 0 &&
            normalizePhone(companyEditForm.whatsappNumber).length >= 10 &&
            normalizePhone(companyEditForm.whatsappNumber).length <= 11
        );
    }

    function isCompanyStepTwoValid() {
        const activeDays = BUSINESS_WEEK_DAYS.filter((day) => companyCreateForm.businessHoursWeekly[day.key].active);
        if (activeDays.length === 0) return false;
        return activeDays.every((day) => {
            const item = companyCreateForm.businessHoursWeekly[day.key];
            return (
                isValidBusinessHour(item.start) &&
                isValidBusinessHour(item.lunchStart) &&
                isValidBusinessHour(item.lunchEnd) &&
                isValidBusinessHour(item.end) &&
                item.start < item.lunchStart &&
                item.lunchStart < item.lunchEnd &&
                item.lunchEnd < item.end
            );
        });
    }

    function isCompanyEditStepTwoValid() {
        const activeDays = BUSINESS_WEEK_DAYS.filter((day) => companyEditForm.businessHoursWeekly[day.key].active);
        if (activeDays.length === 0) return false;
        return activeDays.every((day) => {
            const item = companyEditForm.businessHoursWeekly[day.key];
            return (
                isValidBusinessHour(item.start) &&
                isValidBusinessHour(item.lunchStart) &&
                isValidBusinessHour(item.lunchEnd) &&
                isValidBusinessHour(item.end) &&
                item.start < item.lunchStart &&
                item.lunchStart < item.lunchEnd &&
                item.lunchEnd < item.end
            );
        });
    }

    function deriveLegacyBusinessRange(weekly: BusinessHoursWeekly) {
        const activeDays = BUSINESS_WEEK_DAYS
            .map((day) => weekly[day.key])
            .filter((item) => item.active);
        if (activeDays.length === 0) return { businessHoursStart: "09:00", businessHoursEnd: "18:00" };
        const businessHoursStart = activeDays.reduce((min, current) => current.start < min ? current.start : min, activeDays[0].start);
        const businessHoursEnd = activeDays.reduce((max, current) => current.end > max ? current.end : max, activeDays[0].end);
        return { businessHoursStart, businessHoursEnd };
    }

    async function handleCompanyProfileImage(file: File | null) {
        if (!file) {
            setCompanyCreateForm((p) => ({ ...p, profileImageUrl: "" }));
            return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao processar imagem"));
            reader.readAsDataURL(file);
        });

        setCompanyCreateForm((p) => ({ ...p, profileImageUrl: dataUrl }));
    }

    async function handleUserCreateProfileImage(file: File | null) {
        if (!file) {
            setUserCreateForm((p) => ({ ...p, profileImageUrl: "" }));
            return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao processar imagem"));
            reader.readAsDataURL(file);
        });

        setUserCreateForm((p) => ({ ...p, profileImageUrl: dataUrl }));
    }

    async function handleUserEditProfileImage(file: File | null) {
        if (!file) {
            setUserEditForm((p) => ({ ...p, profileImageUrl: "" }));
            return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao processar imagem"));
            reader.readAsDataURL(file);
        });

        setUserEditForm((p) => ({ ...p, profileImageUrl: dataUrl }));
    }

    async function handleCompanyEditProfileImage(file: File | null) {
        if (!file) {
            setCompanyEditForm((p) => ({ ...p, profileImageUrl: "" }));
            return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Falha ao processar imagem"));
            reader.readAsDataURL(file);
        });

        setCompanyEditForm((p) => ({ ...p, profileImageUrl: dataUrl }));
    }

    function toggleCompanyCreateWeekday(day: BusinessWeekDayKey, active: boolean) {
        setCompanyCreateForm((prev) => ({
            ...prev,
            businessHoursWeekly: {
                ...prev.businessHoursWeekly,
                [day]: { ...prev.businessHoursWeekly[day], active },
            },
        }));
    }

    function updateCompanyCreateWeekdayTime(day: BusinessWeekDayKey, field: keyof Omit<BusinessHoursDay, "active">, value: string) {
        setCompanyCreateForm((prev) => ({
            ...prev,
            businessHoursWeekly: {
                ...prev.businessHoursWeekly,
                [day]: { ...prev.businessHoursWeekly[day], [field]: value },
            },
        }));
    }

    function toggleCompanyEditWeekday(day: BusinessWeekDayKey, active: boolean) {
        setCompanyEditForm((prev) => ({
            ...prev,
            businessHoursWeekly: {
                ...prev.businessHoursWeekly,
                [day]: { ...prev.businessHoursWeekly[day], active },
            },
        }));
    }

    function updateCompanyEditWeekdayTime(day: BusinessWeekDayKey, field: keyof Omit<BusinessHoursDay, "active">, value: string) {
        setCompanyEditForm((prev) => ({
            ...prev,
            businessHoursWeekly: {
                ...prev.businessHoursWeekly,
                [day]: { ...prev.businessHoursWeekly[day], [field]: value },
            },
        }));
    }

    async function submitUserCreate() {
        setUserCreateModalMsg(null);
        if (!isUserCreateStepOneValid()) {
            setUserCreateStep(1);
            setUserCreateModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
            return;
        }
        if (userCreateStep !== 2) {
            setUserCreateModalMsg("Avance para a etapa 2 para concluir.");
            return;
        }
        if (!isUserCreateStepTwoValid()) {
            setUserCreateStep(2);
            setUserCreateModalMsg("Selecione pelo menos uma permissão no modo Personalizado.");
            return;
        }

        setSubmitting(true);
        const selectedRoles = resolveUserRolesFromPreset(userCreateForm.permissionPreset, userCreateForm.modules);
        const safeRoles = isSuperAdmin ? selectedRoles : selectedRoles.filter((r) => r.toUpperCase() !== "SUPERADMIN");
        const modulePermissions = userCreateForm.permissionPreset === "custom"
            ? Object.entries(userCreateForm.modules).filter(([, enabled]) => enabled).map(([key]) => key)
            : [];
        const payload = {
            fullName: userCreateForm.fullName,
            email: userCreateForm.email,
            profileImageUrl: userCreateForm.profileImageUrl || "",
            jobTitle: userCreateForm.jobTitle,
            birthDate: userCreateForm.birthDate,
            teamId: userCreateForm.teamId,
            password: userCreateForm.password,
            permissionPreset: userCreateForm.permissionPreset,
            modulePermissions,
            roles: safeRoles,
        };
        const res = await fetch("/api/auth/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({ message: "Falha ao criar colaborador" }));
        if (!res.ok) { setUserCreateModalMsg(data.message ?? "Falha ao criar colaborador"); setSubmitting(false); return; }
        await loadUsers();
        pushToast("Colaborador criado com sucesso.", "success");
        closeModal();
    }

    async function submitUserEdit(id: string) {
        setUserEditModalMsg(null);
        if (!isUserEditStepOneValid()) {
            setUserEditStep(1);
            setUserEditModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
            return;
        }
        if (userEditStep !== 2) {
            setUserEditModalMsg("Avance para a etapa 2 para concluir.");
            return;
        }
        if (!isUserEditStepTwoValid()) {
            setUserEditStep(2);
            setUserEditModalMsg("Selecione pelo menos uma permissão no modo Personalizado.");
            return;
        }

        setSubmitting(true);
        const selectedRoles = resolveUserRolesFromPreset(userEditForm.permissionPreset, userEditForm.modules);
        const safeRoles = isSuperAdmin ? selectedRoles : selectedRoles.filter((r) => r.toUpperCase() !== "SUPERADMIN");
        const modulePermissions = userEditForm.permissionPreset === "custom"
            ? Object.entries(userEditForm.modules).filter(([, enabled]) => enabled).map(([key]) => key)
            : [];
        const payload = {
            fullName: userEditForm.fullName,
            email: userEditForm.email,
            profileImageUrl: userEditForm.profileImageUrl || "",
            jobTitle: userEditForm.jobTitle,
            birthDate: userEditForm.birthDate,
            teamId: userEditForm.teamId,
            password: userEditForm.password || "",
            permissionPreset: userEditForm.permissionPreset,
            modulePermissions,
            roles: safeRoles,
        };
        const res = await fetch(`/api/auth/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar colaborador" }));
        if (!res.ok) { setUserEditModalMsg(data.message ?? "Falha ao atualizar colaborador"); setSubmitting(false); return; }
        await loadUsers();
        pushToast("Colaborador atualizado com sucesso.", "success");
        closeModal();
    }

    async function removeUser(id: string) {
        setSubmitting(true);
        const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({ message: "Falha ao excluir colaborador" }));
        if (!res.ok) { pushToast(data.message ?? "Falha ao excluir colaborador", "error"); setSubmitting(false); return; }
        await loadUsers();
        pushToast("Colaborador excluído com sucesso.", "success");
        closeModal();
    }

    async function submitTeamCreate() {
        const name = teamFormName.trim();
        if (!name) {
            setTeamModalMsg("Informe o nome da equipe.");
            return;
        }
        setSubmitting(true);
        const res = await fetch("/api/auth/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({ message: "Falha ao criar equipe" }));
        if (!res.ok) {
            setTeamModalMsg(data.message ?? "Falha ao criar equipe");
            setSubmitting(false);
            return;
        }
        await loadTeams();
        pushToast("Equipe criada com sucesso.", "success");
        closeModal();
    }

    async function submitTeamEdit(id: string) {
        const name = teamFormName.trim();
        if (!name) {
            setTeamModalMsg("Informe o nome da equipe.");
            return;
        }
        setSubmitting(true);
        const res = await fetch(`/api/auth/teams/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar equipe" }));
        if (!res.ok) {
            setTeamModalMsg(data.message ?? "Falha ao atualizar equipe");
            setSubmitting(false);
            return;
        }
        await loadTeams();
        await loadUsers();
        pushToast("Equipe atualizada com sucesso.", "success");
        closeModal();
    }

    async function removeTeam(id: string) {
        setSubmitting(true);
        const res = await fetch(`/api/auth/teams/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({ message: "Falha ao excluir equipe" }));
        if (!res.ok) {
            pushToast(data.message ?? "Falha ao excluir equipe", "error");
            setSubmitting(false);
            return;
        }
        await loadTeams();
        await loadUsers();
        pushToast("Equipe excluída com sucesso.", "success");
        closeModal();
    }

    async function submitCompanyCreate() {
        setCompanyModalMsg(null);
        if (companyCreateStep !== 2) {
            setCompanyModalMsg("Avance para a etapa 2 para concluir.");
            return;
        }
        if (!isCompanyStepOneValid()) {
            setCompanyCreateStep(1);
            setCompanyModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
            return;
        }
        if (!isCompanyStepTwoValid()) {
            setCompanyCreateStep(2);
            setCompanyModalMsg("Preencha todos os campos obrigatórios da etapa 2.");
            return;
        }
        if (!isCompanyStepTwoValid()) {
            setCompanyCreateStep(2);
            setCompanyModalMsg("Informe um horário de atendimento válido na etapa 2.");
            return;
        }

        setSubmitting(true);
        const legacyRange = deriveLegacyBusinessRange(companyCreateForm.businessHoursWeekly);
        const payload = {
            ...companyCreateForm,
            cnpj: companyCreateForm.cnpj.replace(/\D/g, ""),
            whatsappNumber: normalizePhone(companyCreateForm.whatsappNumber),
            businessHoursStart: legacyRange.businessHoursStart,
            businessHoursEnd: legacyRange.businessHoursEnd,
            businessHoursWeekly: companyCreateForm.businessHoursWeekly,
        };
        const res = await fetch("/api/auth/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({ message: "Falha ao criar empresa" }));
        if (!res.ok) { setCompanyModalMsg(data.message ?? "Falha ao criar empresa"); setSubmitting(false); return; }
        await loadCompanies();
        pushToast("Empresa criada com sucesso.", "success");
        closeModal();
    }

    async function submitCompanyEdit(id: string) {
        setCompanyEditModalMsg(null);
        if (companyEditStep !== 2) {
            setCompanyEditModalMsg("Avance para a etapa 2 para concluir.");
            return;
        }
        if (!isCompanyEditStepOneValid()) {
            setCompanyEditStep(1);
            setCompanyEditModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
            return;
        }
        if (!isCompanyEditStepTwoValid()) {
            setCompanyEditStep(2);
            setCompanyEditModalMsg("Preencha todos os campos obrigatórios da etapa 2.");
            return;
        }
        if (!isCompanyEditStepTwoValid()) {
            setCompanyEditStep(2);
            setCompanyEditModalMsg("Informe um horário de atendimento válido na etapa 2.");
            return;
        }

        setSubmitting(true);
        const legacyRange = deriveLegacyBusinessRange(companyEditForm.businessHoursWeekly);
        const payload = {
            profileImageUrl: companyEditForm.profileImageUrl || "",
            companyName: companyEditForm.companyName,
            companyEmail: companyEditForm.companyEmail,
            contractEndDate: companyEditForm.contractEndDate,
            cnpj: companyEditForm.cnpj.replace(/\D/g, ""),
            openedAt: companyEditForm.openedAt,
            whatsappNumber: normalizePhone(companyEditForm.whatsappNumber),
            businessHoursStart: legacyRange.businessHoursStart,
            businessHoursEnd: legacyRange.businessHoursEnd,
            businessHoursWeekly: companyEditForm.businessHoursWeekly,
        };
        const res = await fetch(`/api/auth/companies/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar empresa" }));
        if (!res.ok) { setCompanyEditModalMsg(data.message ?? "Falha ao atualizar empresa"); setSubmitting(false); return; }
        await loadCompanies();
        pushToast("Empresa atualizada com sucesso.", "success");
        closeModal();
    }

    async function removeCompany(id: string) {
        setSubmitting(true);
        const res = await fetch(`/api/auth/companies/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({ message: "Falha ao excluir empresa" }));
        if (!res.ok) { pushToast(data.message ?? "Falha ao excluir empresa", "error"); setSubmitting(false); return; }
        await loadCompanies();
        pushToast("Empresa excluída com sucesso.", "success");
        closeModal();
    }

    if (loading) return <SystemPageLoader label="Carregando configurações" description="Preparando usuários, equipes e permissões..." />;
    if (!canManageUsers) return <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-soft">Sem permissão.</section>;

    return (
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-soft">
            {view !== "home" && (
                <div className="flex justify-end">
                    <button type="button" onClick={() => setView("home")} className="rounded-xl border px-3 py-2 text-sm">
                        Voltar
                    </button>
                </div>
            )}
            {view === "home" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                        <h2 className="text-lg font-semibold text-io-dark">Gerenciar colaboradores</h2>
                        <button type="button" onClick={async () => { await Promise.all([loadUsers(), loadTeams()]); setView("users"); }} className="mt-3 rounded-xl bg-io-purple px-4 py-2 text-sm font-semibold text-white">Abrir gerenciamento</button>
                    </section>
                    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                        <h2 className="text-lg font-semibold text-io-dark">Gerenciar equipes</h2>
                        <button type="button" onClick={async () => { await loadTeams(); setView("teams"); }} className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Abrir gerenciamento</button>
                    </section>
                    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                        <h2 className="text-lg font-semibold text-io-dark">Gerenciar etapas de atendimento</h2>
                        <button type="button" onClick={() => { loadCrmStages(); setView("stages"); }} className="mt-3 rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Abrir gerenciamento</button>
                    </section>
                    {isSuperAdmin && (
                        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                            <h2 className="text-lg font-semibold text-io-dark">Gerenciar empresas</h2>
                            <button type="button" onClick={async () => { await loadCompanies(); setView("companies"); }} className="mt-3 rounded-xl bg-io-purple2 px-4 py-2 text-sm font-semibold text-white">Abrir gerenciamento</button>
                        </section>
                    )}
                </div>
            )}

            {view === "users" && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex justify-between">
                        <h2 className="font-semibold">Colaboradores</h2>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (teams.length === 0) {
                                        pushToast("Crie ao menos uma equipe antes de cadastrar colaboradores.", "info");
                                        return;
                                    }
                                    setUserCreateForm(getInitialUserCreateForm());
                                    setUserCreateStep(1);
                                    setShowUserCreatePassword(false);
                                    setUserCreateModalMsg(null);
                                    setModal({ type: "create-user" });
                                }}
                                className="rounded-xl bg-io-purple px-3 py-2 text-sm font-semibold text-white"
                            >
                                Novo
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        {users.map((u) => (
                            <div key={u.id} className="rounded-xl border border-black/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-black/5">
                                            {u.profileImageUrl ? (
                                                <img
                                                    src={u.profileImageUrl}
                                                    alt={u.fullName}
                                                    className="h-full w-full object-cover"
                                                    loading="eager"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-black/65">{toInitials(u.fullName)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{u.fullName}</p>
                                            <p className="truncate text-xs text-black/60">{u.email}</p>
                                            <p className="truncate text-xs text-black/50">{u.jobTitle ?? "Sem cargo definido"}</p>
                                            <p className="truncate text-xs text-sky-700">{u.teamName ?? "Sem equipe"}</p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const preset = inferPresetFromUser(u);
                                                    setUserEditForm({
                                                        profileImageUrl: u.profileImageUrl ?? "",
                                                        fullName: u.fullName ?? "",
                                                        email: u.email ?? "",
                                                        jobTitle: u.jobTitle ?? "",
                                                        birthDate: toDateInputValue(u.birthDate),
                                                        teamId: u.teamId ?? "",
                                                        password: "",
                                                        permissionPreset: preset,
                                                        modules: modulesFromKeys(u.modulePermissions),
                                                    });
                                                    setUserEditStep(1);
                                                    setShowUserEditPassword(false);
                                                    setUserEditModalMsg(null);
                                                    setModal({ type: "edit-user", item: u });
                                                }}
                                                className="grid h-8 w-8 place-items-center rounded-lg border text-black/70 hover:bg-black/5"
                                                aria-label="Editar colaborador"
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" strokeWidth={2} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModal({ type: "delete-user", item: u })}
                                                className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                                aria-label="Excluir colaborador"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {view === "teams" && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex justify-between">
                        <h2 className="font-semibold">Equipes</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setTeamFormName("");
                                setTeamModalMsg(null);
                                setModal({ type: "create-team" });
                            }}
                            className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                            Nova
                        </button>
                    </div>
                    <div className="grid gap-2">
                        {teams.length === 0 && (
                            <div className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-black/60">
                                Nenhuma equipe criada ainda.
                            </div>
                        )}
                        {teams.map((team) => (
                            <div key={team.id} className="rounded-xl border border-black/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-io-dark">{team.name}</p>
                                        <p className="text-xs text-black/50">Atualizada em {new Date(team.updatedAt).toLocaleString("pt-BR")}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTeamFormName(team.name);
                                                setTeamModalMsg(null);
                                                setModal({ type: "edit-team", item: team });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border text-black/70 hover:bg-black/5"
                                            aria-label="Editar equipe"
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTeamModalMsg(null);
                                                setModal({ type: "delete-team", item: team });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                            aria-label="Excluir equipe"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {view === "labels" && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex justify-between">
                        <h2 className="font-semibold">Etiquetas</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setLabelForm({ title: "", color: "#7C3AED" });
                                setLabelModalMsg(null);
                                setLabelModal({ type: "create" });
                            }}
                            className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                            Nova
                        </button>
                    </div>
                    <div className="grid gap-2">
                        {contactLabels.length === 0 && (
                            <div className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-black/60">
                                Nenhuma etiqueta criada ainda.
                            </div>
                        )}
                        {contactLabels.map((label) => (
                            <div key={label.id} className="rounded-xl border border-black/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <span
                                            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                                            style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
                                        >
                                            {label.title}
                                        </span>
                                        <p className="mt-1 text-xs text-black/50">{label.color}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLabelForm({ title: label.title, color: label.color });
                                                setLabelModalMsg(null);
                                                setLabelModal({ type: "edit", item: label });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border text-black/70 hover:bg-black/5"
                                            aria-label="Editar etiqueta"
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLabelModalMsg(null);
                                                setLabelModal({ type: "delete", item: label });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                            aria-label="Excluir etiqueta"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {view === "classifications" && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex justify-between">
                        <h2 className="font-semibold">Classificações personalizadas</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setClassificationFormTitle("");
                                setClassificationFormCategoryId("other");
                                setClassificationFormHasValue(false);
                                setClassificationFormValue("");
                                setClassificationModalMsg(null);
                                setClassificationModal({ type: "create" });
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                            Nova
                        </button>
                    </div>
                    <p className="mb-3 text-xs text-black/60">
                        Classificações padrão disponíveis no atendimento: Objetivo atingido, Objetivo perdido, Dúvidas e Outro.
                    </p>
                    <div className="grid gap-2">
                        {customClassifications.length === 0 && (
                            <div className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-black/60">
                                Nenhuma classificação personalizada criada ainda.
                            </div>
                        )}
                        {customClassifications.map((classification) => (
                            <div key={classification.id} className="rounded-xl border border-black/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-io-dark">{classification.title}</p>
                                        <p className="inline-flex items-center gap-1.5 text-xs text-black/55">
                                            <AtendimentoClassificationCategoryIcon categoryId={classification.categoryId} className="h-3.5 w-3.5" />
                                            {classificationCategories.find((item) => item.id === classification.categoryId)?.label ?? "Outro"}
                                        </p>
                                        {classification.hasValue && classification.value != null ? (
                                            <p className="text-xs text-black/55">Valor: {classification.value}</p>
                                        ) : null}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setClassificationFormTitle(classification.title);
                                                setClassificationFormCategoryId(classification.categoryId);
                                                setClassificationFormHasValue(Boolean(classification.hasValue));
                                                setClassificationFormValue(classification.value != null ? String(classification.value) : "");
                                                setClassificationModalMsg(null);
                                                setClassificationModal({ type: "edit", item: classification });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border text-black/70 hover:bg-black/5"
                                            aria-label="Editar classificação"
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setClassificationModalMsg(null);
                                                setClassificationModal({ type: "delete", item: classification });
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                            aria-label="Excluir classificação"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {view === "stages" && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-io-dark">Etapas do funil</h2>
                            <p className="text-xs text-black/60">Essas etapas organizam as colunas do quadro CRM.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openStagesModal}
                            className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold text-white"
                        >
                            Gerenciar etapas
                        </button>
                    </div>

                    <div className="grid gap-2">
                        {crmStages.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-black/60">
                                Nenhuma etapa cadastrada.
                            </div>
                        ) : (
                            crmStages
                                .slice()
                                .sort((a, b) => a.order - b.order)
                                .map((stage) => (
                                    <div key={stage.id} className="flex items-center justify-between rounded-xl border border-black/10 p-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="h-3 w-3 shrink-0 rounded-full bg-[#6b00e3]" />
                                            <p className="truncate text-sm font-medium text-io-dark">{stage.title}</p>
                                        </div>
                                        <p className="text-xs text-black/55">{getStageKindLabel(stage.kind)}</p>
                                    </div>
                                ))
                        )}
                    </div>
                </section>
            )}

            {view === "companies" && isSuperAdmin && (
                <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
                    <div className="mb-3 flex justify-between"><h2 className="font-semibold">Empresas</h2><div className="flex gap-2"><button type="button" onClick={() => { setCompanyCreateForm(getInitialCompanyCreateForm()); setCompanyCreateStep(1); setShowCompanyPassword(false); setCompanyModalMsg(null); setModal({ type: "create-company" }); }} className="rounded-xl bg-io-purple2 px-3 py-2 text-sm font-semibold text-white">Novo</button></div></div>
                    <div className="grid gap-2">{companies.map((c) => <div key={c.id} className="rounded-xl border border-black/10 p-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{c.name}</p><p className="text-xs text-black/60">{c.email ?? "sem-email@empresa.com"}</p><p className="text-xs text-black/50">{c.whatsappNumber ? formatPhoneInput(c.whatsappNumber) : "Telefone não informado"}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setCompanyEditForm({ profileImageUrl: c.profileImageUrl ?? "", companyName: c.name ?? "", companyEmail: c.email ?? "", contractEndDate: toDateInputValue(c.contractEndDate), cnpj: formatCnpj(c.cnpj ?? ""), openedAt: toDateInputValue(c.openedAt), whatsappNumber: formatPhoneInput(c.whatsappNumber ?? ""), password: "", businessHoursStart: c.businessHoursStart ?? "09:00", businessHoursEnd: c.businessHoursEnd ?? "18:00", businessHoursWeekly: normalizeBusinessHoursWeekly(c.businessHoursWeekly) }); setCompanyEditStep(1); setShowCompanyEditPassword(false); setCompanyEditModalMsg(null); setModal({ type: "edit-company", item: c }); }} className="rounded-lg border px-2 py-1 text-xs">Editar</button><button type="button" onClick={() => setModal({ type: "delete-company", item: c })} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">Excluir</button></div></div></div>)}</div>
                </section>
            )}

            {modal.type === "create-user" && (
                <ModalWrap title="Novo colaborador" onClose={closeModal}>
                    <form onSubmit={(e) => e.preventDefault()} className="grid gap-3">
                        {userCreateModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{userCreateModalMsg}</section>}
                        <div className="grid gap-2 rounded-xl border border-black/10 p-3">
                            <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${userCreateStep === 1 ? "bg-io-purple text-white" : "bg-black/10 text-black/60"}`}>1</div>
                                <div className="h-1 flex-1 rounded bg-black/10">
                                    <div className={`h-1 rounded bg-io-purple transition-all ${userCreateStep === 2 ? "w-full" : "w-0"}`} />
                                </div>
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${userCreateStep === 2 ? "bg-io-purple text-white" : "bg-black/10 text-black/60"}`}>2</div>
                            </div>
                            <p className="text-xs text-black/60">{userCreateStep === 1 ? "Etapa 1: Dados do colaborador" : "Etapa 2: Permissões"}</p>
                        </div>

                        {userCreateStep === 1 && (
                            <div className="grid gap-2">
                                <label className="text-xs text-black/70">Imagem (opcional)</label>
                                <input type="file" accept="image/*" className="h-10 rounded-xl border px-3 py-2 text-sm" onChange={async (e) => { try { await handleUserCreateProfileImage(e.target.files?.[0] ?? null); } catch { setUserCreateModalMsg("Falha ao carregar imagem."); } }} />
                                <input value={userCreateForm.fullName} onChange={(e) => setUserCreateForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Nome" className="h-10 rounded-xl border px-3" required />
                                <input value={userCreateForm.email} onChange={(e) => setUserCreateForm((p) => ({ ...p, email: e.target.value }))} placeholder="E-mail" type="email" className="h-10 rounded-xl border px-3" required />
                                <input value={userCreateForm.jobTitle} onChange={(e) => setUserCreateForm((p) => ({ ...p, jobTitle: e.target.value }))} placeholder="Cargo" className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Equipe</label>
                                <select value={userCreateForm.teamId} onChange={(e) => setUserCreateForm((p) => ({ ...p, teamId: e.target.value }))} className="h-10 rounded-xl border px-3 text-sm" required>
                                    <option value="">Selecione uma equipe</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                                <label className="text-xs text-black/70">Data de nascimento</label>
                                <input value={userCreateForm.birthDate} onChange={(e) => setUserCreateForm((p) => ({ ...p, birthDate: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <div className="relative">
                                    <input value={userCreateForm.password} onChange={(e) => setUserCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha" type={showUserCreatePassword ? "text" : "password"} className="h-10 w-full rounded-xl border px-3 pr-11" required />
                                    <button type="button" onClick={() => setShowUserCreatePassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/60 hover:bg-black/5" aria-label={showUserCreatePassword ? "Ocultar senha" : "Mostrar senha"} title={showUserCreatePassword ? "Ocultar senha" : "Mostrar senha"}>
                                        {showUserCreatePassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {userCreateStep === 2 && (
                            <div className="grid gap-2">
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-permission-preset" checked={userCreateForm.permissionPreset === "admin"} onChange={() => setUserCreateForm((p) => ({ ...p, permissionPreset: "admin", modules: getInitialUserModules() }))} />
                                        <span className="font-medium">Administrador</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Terá todas as permissões como a empresa.</p>
                                </label>
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-permission-preset" checked={userCreateForm.permissionPreset === "default"} onChange={() => setUserCreateForm((p) => ({ ...p, permissionPreset: "default", modules: getInitialUserModules() }))} />
                                        <span className="font-medium">Padrão</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Terá todas as permissões, menos a de criar colaboradores.</p>
                                </label>
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-permission-preset" checked={userCreateForm.permissionPreset === "custom"} onChange={() => setUserCreateForm((p) => ({ ...p, permissionPreset: "custom" }))} />
                                        <span className="font-medium">Personalizado</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Selecione exatamente os módulos que esse colaborador poderá acessar.</p>
                                </label>

                                {userCreateForm.permissionPreset === "custom" && (
                                    <div className="mt-1 grid gap-2 rounded-xl border border-black/10 bg-io-light/40 p-3">
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.manageCampaigns} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, manageCampaigns: e.target.checked } }))} />Gerenciar campanhas</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.manageCollaborators} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, manageCollaborators: e.target.checked } }))} />Gerenciar colaboradores</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.manageProducts} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, manageProducts: e.target.checked } }))} />Gerenciar produtos</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.atendimentos} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, atendimentos: e.target.checked } }))} />Atendimentos</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.reports} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, reports: e.target.checked } }))} />Relatórios</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userCreateForm.modules.crm} onChange={(e) => setUserCreateForm((p) => ({ ...p, modules: { ...p.modules, crm: e.target.checked } }))} />CRM</label>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-1 flex gap-2">
                            {userCreateStep === 2 && (
                                <button type="button" onClick={() => setUserCreateStep(1)} className="h-10 rounded-xl border px-4 text-sm">
                                    Voltar
                                </button>
                            )}
                            {userCreateStep === 1 ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!isUserCreateStepOneValid()) {
                                            setUserCreateModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
                                            return;
                                        }
                                        if (!isValidEmailFormat(userCreateForm.email)) {
                                            setUserCreateModalMsg("Informe um e-mail válido.");
                                            return;
                                        }
                                        const emailExists = await hasEmailConflict(userCreateForm.email, { entity: "user" });
                                        if (emailExists) {
                                            setUserCreateModalMsg("Já existe um cadastro com este e-mail.");
                                            return;
                                        }
                                        setUserCreateModalMsg(null);
                                        setUserCreateStep(2);
                                    }}
                                    className="h-10 flex-1 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white"
                                >
                                    Próxima etapa
                                </button>
                            ) : (
                                <button type="button" onClick={() => submitUserCreate()} disabled={submitting} className="h-10 flex-1 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white">
                                    {submitting ? "Salvando..." : "Criar"}
                                </button>
                            )}
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "edit-user" && (
                <ModalWrap title="Editar colaborador" onClose={closeModal}>
                    <form onSubmit={(e) => e.preventDefault()} className="grid gap-3">
                        {userEditModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{userEditModalMsg}</section>}
                        <div className="grid gap-2 rounded-xl border border-black/10 p-3">
                            <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${userEditStep === 1 ? "bg-io-purple text-white" : "bg-black/10 text-black/60"}`}>1</div>
                                <div className="h-1 flex-1 rounded bg-black/10">
                                    <div className={`h-1 rounded bg-io-purple transition-all ${userEditStep === 2 ? "w-full" : "w-0"}`} />
                                </div>
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${userEditStep === 2 ? "bg-io-purple text-white" : "bg-black/10 text-black/60"}`}>2</div>
                            </div>
                            <p className="text-xs text-black/60">{userEditStep === 1 ? "Etapa 1: Dados do colaborador" : "Etapa 2: Permissões"}</p>
                        </div>

                        {userEditStep === 1 && (
                            <div className="grid gap-2">
                                <label className="text-xs text-black/70">Imagem (opcional)</label>
                                <input type="file" accept="image/*" className="h-10 rounded-xl border px-3 py-2 text-sm" onChange={async (e) => { try { await handleUserEditProfileImage(e.target.files?.[0] ?? null); } catch { setUserEditModalMsg("Falha ao carregar imagem."); } }} />
                                <input value={userEditForm.fullName} onChange={(e) => setUserEditForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Nome" className="h-10 rounded-xl border px-3" required />
                                <input value={userEditForm.email} onChange={(e) => setUserEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="E-mail" type="email" className="h-10 rounded-xl border px-3" required />
                                <input value={userEditForm.jobTitle} onChange={(e) => setUserEditForm((p) => ({ ...p, jobTitle: e.target.value }))} placeholder="Cargo" className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Equipe</label>
                                <select value={userEditForm.teamId} onChange={(e) => setUserEditForm((p) => ({ ...p, teamId: e.target.value }))} className="h-10 rounded-xl border px-3 text-sm" required>
                                    <option value="">Selecione uma equipe</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                                <label className="text-xs text-black/70">Data de nascimento</label>
                                <input value={userEditForm.birthDate} onChange={(e) => setUserEditForm((p) => ({ ...p, birthDate: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <div className="relative">
                                    <input value={userEditForm.password} onChange={(e) => setUserEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="Nova senha (opcional)" type={showUserEditPassword ? "text" : "password"} className="h-10 w-full rounded-xl border px-3 pr-11" />
                                    <button type="button" onClick={() => setShowUserEditPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/60 hover:bg-black/5" aria-label={showUserEditPassword ? "Ocultar senha" : "Mostrar senha"} title={showUserEditPassword ? "Ocultar senha" : "Mostrar senha"}>
                                        {showUserEditPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {userEditStep === 2 && (
                            <div className="grid gap-2">
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-edit-permission-preset" checked={userEditForm.permissionPreset === "admin"} onChange={() => setUserEditForm((p) => ({ ...p, permissionPreset: "admin", modules: getInitialUserModules() }))} />
                                        <span className="font-medium">Administrador</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Terá todas as permissões como a empresa.</p>
                                </label>
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-edit-permission-preset" checked={userEditForm.permissionPreset === "default"} onChange={() => setUserEditForm((p) => ({ ...p, permissionPreset: "default", modules: getInitialUserModules() }))} />
                                        <span className="font-medium">Padrão</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Terá todas as permissões, menos a de criar colaboradores.</p>
                                </label>
                                <label className="rounded-xl border border-black/10 p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <input type="radio" name="user-edit-permission-preset" checked={userEditForm.permissionPreset === "custom"} onChange={() => setUserEditForm((p) => ({ ...p, permissionPreset: "custom" }))} />
                                        <span className="font-medium">Personalizado</span>
                                    </div>
                                    <p className="mt-1 text-xs text-black/60">Selecione exatamente os módulos que esse colaborador poderá acessar.</p>
                                </label>

                                {userEditForm.permissionPreset === "custom" && (
                                    <div className="mt-1 grid gap-2 rounded-xl border border-black/10 bg-io-light/40 p-3">
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.manageCampaigns} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, manageCampaigns: e.target.checked } }))} />Gerenciar campanhas</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.manageCollaborators} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, manageCollaborators: e.target.checked } }))} />Gerenciar colaboradores</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.manageProducts} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, manageProducts: e.target.checked } }))} />Gerenciar produtos</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.atendimentos} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, atendimentos: e.target.checked } }))} />Atendimentos</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.reports} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, reports: e.target.checked } }))} />Relatórios</label>
                                        <label className="text-sm"><input type="checkbox" className="mr-2" checked={userEditForm.modules.crm} onChange={(e) => setUserEditForm((p) => ({ ...p, modules: { ...p.modules, crm: e.target.checked } }))} />CRM</label>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-1 flex gap-2">
                            {userEditStep === 2 && (
                                <button type="button" onClick={() => setUserEditStep(1)} className="h-10 rounded-xl border px-4 text-sm">
                                    Voltar
                                </button>
                            )}
                            {userEditStep === 1 ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!isUserEditStepOneValid()) {
                                            setUserEditModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
                                            return;
                                        }
                                        if (!isValidEmailFormat(userEditForm.email)) {
                                            setUserEditModalMsg("Informe um e-mail válido.");
                                            return;
                                        }
                                        const emailExists = await hasEmailConflict(userEditForm.email, { entity: "user", editingId: modal.item.id, originalEmail: modal.item.email });
                                        if (emailExists) {
                                            setUserEditModalMsg("Já existe um cadastro com este e-mail.");
                                            return;
                                        }
                                        setUserEditModalMsg(null);
                                        setUserEditStep(2);
                                    }}
                                    className="h-10 flex-1 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white"
                                >
                                    Próxima etapa
                                </button>
                            ) : (
                                <button type="button" onClick={() => submitUserEdit(modal.item.id)} disabled={submitting} className="h-10 flex-1 rounded-xl bg-io-purple px-4 text-sm font-semibold text-white">
                                    {submitting ? "Salvando..." : "Salvar"}
                                </button>
                            )}
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "delete-user" && <ModalWrap title="Excluir colaborador" onClose={closeModal}><p className="text-sm">Excluir {modal.item.fullName}?</p><div className="mt-3 flex gap-2"><button type="button" onClick={closeModal} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button><button type="button" onClick={() => removeUser(modal.item.id)} disabled={submitting} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">{submitting ? "Excluindo..." : "Excluir"}</button></div></ModalWrap>}
            {modal.type === "create-team" && (
                <ModalWrap title="Nova equipe" onClose={closeModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitTeamCreate();
                        }}
                        className="grid gap-3"
                    >
                        {teamModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{teamModalMsg}</section>}
                        <input
                            value={teamFormName}
                            onChange={(event) => setTeamFormName(event.target.value)}
                            placeholder="Nome da equipe"
                            className="h-10 rounded-xl border px-3"
                            maxLength={120}
                            required
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={closeModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" disabled={submitting} className="h-10 flex-1 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white">
                                {submitting ? "Salvando..." : "Criar"}
                            </button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "edit-team" && (
                <ModalWrap title="Editar equipe" onClose={closeModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitTeamEdit(modal.item.id);
                        }}
                        className="grid gap-3"
                    >
                        {teamModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{teamModalMsg}</section>}
                        <input
                            value={teamFormName}
                            onChange={(event) => setTeamFormName(event.target.value)}
                            placeholder="Nome da equipe"
                            className="h-10 rounded-xl border px-3"
                            maxLength={120}
                            required
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={closeModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" disabled={submitting} className="h-10 flex-1 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white">
                                {submitting ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "delete-team" && (
                <ModalWrap title="Excluir equipe" onClose={closeModal}>
                    <p className="text-sm">Excluir a equipe {modal.item.name}?</p>
                    <p className="mt-1 text-xs text-black/60">A exclusão só será permitida quando não houver colaboradores nem atendimentos vinculados.</p>
                    <div className="mt-3 flex gap-2">
                        <button type="button" onClick={closeModal} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button>
                        <button type="button" onClick={() => removeTeam(modal.item.id)} disabled={submitting} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">
                            {submitting ? "Excluindo..." : "Excluir"}
                        </button>
                    </div>
                </ModalWrap>
            )}
            {modal.type === "create-company" && (
                <ModalWrap title="Nova empresa" onClose={closeModal} panelClassName="max-w-6xl">
                    <form onSubmit={(e) => e.preventDefault()} className="grid gap-3">
                        {companyModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{companyModalMsg}</section>}
                        <div className="grid gap-2 rounded-xl border border-black/10 p-3">
                            <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${companyCreateStep === 1 ? "bg-io-purple2 text-white" : "bg-black/10 text-black/60"}`}>1</div>
                                <div className="h-1 flex-1 rounded bg-black/10" />
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${companyCreateStep === 2 ? "bg-io-purple2 text-white" : "bg-black/10 text-black/60"}`}>2</div>
                                
                            </div>
                            <p className="text-xs text-black/60">{companyCreateStep === 1 ? "Etapa 1: Dados da empresa" : "Etapa 2: Horário de atendimento"}</p>
                        </div>

                        {companyCreateStep === 1 && (
                            <div className="grid gap-2">
                                <label className="text-xs text-black/70">Imagem de perfil (opcional)</label>
                                <input type="file" accept="image/*" className="h-10 rounded-xl border px-3 py-2 text-sm" onChange={async (e) => { try { await handleCompanyProfileImage(e.target.files?.[0] ?? null); } catch { setCompanyModalMsg("Falha ao carregar imagem."); } }} />
                                <input value={companyCreateForm.companyName} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, companyName: e.target.value }))} placeholder="Nome da empresa" className="h-10 rounded-xl border px-3" required />
                                <input value={companyCreateForm.companyEmail} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, companyEmail: e.target.value }))} placeholder="E-mail da empresa" type="email" className="h-10 rounded-xl border px-3" required />
                                <input value={companyCreateForm.whatsappNumber} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, whatsappNumber: formatPhoneInput(e.target.value) }))} placeholder="Telefone da empresa" inputMode="tel" maxLength={15} className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Data final do contrato</label>
                                <input value={companyCreateForm.contractEndDate} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, contractEndDate: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <input value={companyCreateForm.cnpj} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))} placeholder="CNPJ" inputMode="numeric" maxLength={18} className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Data de abertura</label>
                                <input value={companyCreateForm.openedAt} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, openedAt: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <div className="relative">
                                    <input value={companyCreateForm.password} onChange={(e) => setCompanyCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha" type={showCompanyPassword ? "text" : "password"} className="h-10 w-full rounded-xl border px-3 pr-11" required />
                                    <button
                                        type="button"
                                        onClick={() => setShowCompanyPassword((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/60 hover:bg-black/5"
                                        aria-label={showCompanyPassword ? "Ocultar senha" : "Mostrar senha"}
                                        title={showCompanyPassword ? "Ocultar senha" : "Mostrar senha"}
                                    >
                                        {showCompanyPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {companyCreateStep === 2 && (
                            <div className="grid gap-2">
                                <p className="text-sm font-semibold text-io-dark">Horários de atendimento</p>
                                <div className="rounded-xl border border-black/10">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/5 text-left">
                                            <tr>
                                                <th className="px-3 py-2">Dia da semana</th>
                                                <th className="px-3 py-2">Ativo</th>
                                                <th className="px-3 py-2">Horário início</th>
                                                <th className="px-3 py-2">Horário inicial do almoço</th>
                                                <th className="px-3 py-2">Horário final do almoço</th>
                                                <th className="px-3 py-2">Horário final</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {BUSINESS_WEEK_DAYS.map((day) => {
                                                const item = companyCreateForm.businessHoursWeekly[day.key];
                                                return (
                                                    <tr key={day.key} className="border-t border-black/10">
                                                        <td className="px-3 py-2">{day.label}</td>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={item.active} onChange={(e) => toggleCompanyCreateWeekday(day.key, e.target.checked)} />
                                                        </td>
                                                        <td className="px-3 py-2"><input type="time" value={item.start} onChange={(e) => updateCompanyCreateWeekdayTime(day.key, "start", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.lunchStart} onChange={(e) => updateCompanyCreateWeekdayTime(day.key, "lunchStart", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.lunchEnd} onChange={(e) => updateCompanyCreateWeekdayTime(day.key, "lunchEnd", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.end} onChange={(e) => updateCompanyCreateWeekdayTime(day.key, "end", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-black/60">Para dias ativos: início &lt; início almoço &lt; final almoço &lt; fim.</p>
                            </div>
                        )}

                        <div className="mt-1 flex gap-2">
                            {companyCreateStep > 1 && (
                                <button type="button" onClick={() => setCompanyCreateStep(1)} className="h-10 rounded-xl border px-4 text-sm">
                                    Voltar
                                </button>
                            )}
                            {companyCreateStep === 1 ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!isCompanyStepOneValid()) {
                                            setCompanyModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
                                            return;
                                        }
                                        if (!isValidEmailFormat(companyCreateForm.companyEmail)) {
                                            setCompanyModalMsg("Informe um e-mail válido.");
                                            return;
                                        }
                                        const emailExists = await hasEmailConflict(companyCreateForm.companyEmail, { entity: "company" });
                                        if (emailExists) {
                                            setCompanyModalMsg("Já existe um cadastro com este e-mail.");
                                            return;
                                        }
                                        setCompanyModalMsg(null);
                                        setCompanyCreateStep(2);
                                    }}
                                    className="h-10 flex-1 rounded-xl bg-io-purple2 px-4 text-sm font-semibold text-white"
                                >
                                    Próxima etapa
                                </button>
                            ) : (
                                <button type="button" onClick={submitCompanyCreate} disabled={submitting} className="h-10 flex-1 rounded-xl bg-io-purple2 px-4 text-sm font-semibold text-white">
                                    {submitting ? "Salvando..." : "Criar"}
                                </button>
                            )}
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "edit-company" && (
                <ModalWrap title="Editar empresa" onClose={closeModal} panelClassName="max-w-6xl">
                    <form onSubmit={(e) => e.preventDefault()} className="grid gap-3">
                        {companyEditModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{companyEditModalMsg}</section>}
                        <div className="grid gap-2 rounded-xl border border-black/10 p-3">
                            <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${companyEditStep === 1 ? "bg-io-purple2 text-white" : "bg-black/10 text-black/60"}`}>1</div>
                                <div className="h-1 flex-1 rounded bg-black/10" />
                                <div className={`h-8 w-8 rounded-full text-center text-sm leading-8 ${companyEditStep === 2 ? "bg-io-purple2 text-white" : "bg-black/10 text-black/60"}`}>2</div>
                                
                            </div>
                            <p className="text-xs text-black/60">{companyEditStep === 1 ? "Etapa 1: Dados da empresa" : "Etapa 2: Horário de atendimento"}</p>
                        </div>

                        {companyEditStep === 1 && (
                            <div className="grid gap-2">
                                <label className="text-xs text-black/70">Imagem de perfil (opcional)</label>
                                <input type="file" accept="image/*" className="h-10 rounded-xl border px-3 py-2 text-sm" onChange={async (e) => { try { await handleCompanyEditProfileImage(e.target.files?.[0] ?? null); } catch { setCompanyEditModalMsg("Falha ao carregar imagem."); } }} />
                                <input value={companyEditForm.companyName} onChange={(e) => setCompanyEditForm((p) => ({ ...p, companyName: e.target.value }))} placeholder="Nome da empresa" className="h-10 rounded-xl border px-3" required />
                                <input value={companyEditForm.companyEmail} onChange={(e) => setCompanyEditForm((p) => ({ ...p, companyEmail: e.target.value }))} placeholder="E-mail da empresa" type="email" className="h-10 rounded-xl border px-3" required />
                                <input value={companyEditForm.whatsappNumber} onChange={(e) => setCompanyEditForm((p) => ({ ...p, whatsappNumber: formatPhoneInput(e.target.value) }))} placeholder="Telefone da empresa" inputMode="tel" maxLength={15} className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Data final do contrato</label>
                                <input value={companyEditForm.contractEndDate} onChange={(e) => setCompanyEditForm((p) => ({ ...p, contractEndDate: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <input value={companyEditForm.cnpj} onChange={(e) => setCompanyEditForm((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))} placeholder="CNPJ" inputMode="numeric" maxLength={18} className="h-10 rounded-xl border px-3" required />
                                <label className="text-xs text-black/70">Data de abertura</label>
                                <input value={companyEditForm.openedAt} onChange={(e) => setCompanyEditForm((p) => ({ ...p, openedAt: e.target.value }))} type="date" className="h-10 rounded-xl border px-3" required />
                                <div className="relative">
                                    <input value={companyEditForm.password} onChange={(e) => setCompanyEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha (não alterada na edição)" type={showCompanyEditPassword ? "text" : "password"} className="h-10 w-full rounded-xl border px-3 pr-11" />
                                    <button
                                        type="button"
                                        onClick={() => setShowCompanyEditPassword((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/60 hover:bg-black/5"
                                        aria-label={showCompanyEditPassword ? "Ocultar senha" : "Mostrar senha"}
                                        title={showCompanyEditPassword ? "Ocultar senha" : "Mostrar senha"}
                                    >
                                        {showCompanyEditPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {companyEditStep === 2 && (
                            <div className="grid gap-2">
                                <p className="text-sm font-semibold text-io-dark">Horários de atendimento</p>
                                <div className="rounded-xl border border-black/10">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/5 text-left">
                                            <tr>
                                                <th className="px-3 py-2">Dia da semana</th>
                                                <th className="px-3 py-2">Ativo</th>
                                                <th className="px-3 py-2">Horário início</th>
                                                <th className="px-3 py-2">Horário inicial do almoço</th>
                                                <th className="px-3 py-2">Horário final do almoço</th>
                                                <th className="px-3 py-2">Horário final</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {BUSINESS_WEEK_DAYS.map((day) => {
                                                const item = companyEditForm.businessHoursWeekly[day.key];
                                                return (
                                                    <tr key={day.key} className="border-t border-black/10">
                                                        <td className="px-3 py-2">{day.label}</td>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={item.active} onChange={(e) => toggleCompanyEditWeekday(day.key, e.target.checked)} />
                                                        </td>
                                                        <td className="px-3 py-2"><input type="time" value={item.start} onChange={(e) => updateCompanyEditWeekdayTime(day.key, "start", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.lunchStart} onChange={(e) => updateCompanyEditWeekdayTime(day.key, "lunchStart", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.lunchEnd} onChange={(e) => updateCompanyEditWeekdayTime(day.key, "lunchEnd", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                        <td className="px-3 py-2"><input type="time" value={item.end} onChange={(e) => updateCompanyEditWeekdayTime(day.key, "end", e.target.value)} disabled={!item.active} className="h-10 w-full rounded-xl border px-3 disabled:bg-black/5" /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-black/60">Para dias ativos: início &lt; início almoço &lt; final almoço &lt; fim.</p>
                            </div>
                        )}

                        <div className="mt-1 flex gap-2">
                            {companyEditStep > 1 && (
                                <button type="button" onClick={() => setCompanyEditStep(1)} className="h-10 rounded-xl border px-4 text-sm">
                                    Voltar
                                </button>
                            )}
                            {companyEditStep === 1 ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!isCompanyEditStepOneValid()) {
                                            setCompanyEditModalMsg("Preencha todos os campos obrigatórios da etapa 1.");
                                            return;
                                        }
                                        if (!isValidEmailFormat(companyEditForm.companyEmail)) {
                                            setCompanyEditModalMsg("Informe um e-mail válido.");
                                            return;
                                        }
                                        const emailExists = await hasEmailConflict(companyEditForm.companyEmail, { entity: "company", editingId: modal.item.id, originalEmail: modal.item.email ?? "" });
                                        if (emailExists) {
                                            setCompanyEditModalMsg("Já existe um cadastro com este e-mail.");
                                            return;
                                        }
                                        setCompanyEditModalMsg(null);
                                        setCompanyEditStep(2);
                                    }}
                                    className="h-10 flex-1 rounded-xl bg-io-purple2 px-4 text-sm font-semibold text-white"
                                >
                                    Próxima etapa
                                </button>
                            ) : (
                                <button type="button" onClick={() => submitCompanyEdit(modal.item.id)} disabled={submitting} className="h-10 flex-1 rounded-xl bg-io-purple2 px-4 text-sm font-semibold text-white">
                                    {submitting ? "Salvando..." : "Salvar"}
                                </button>
                            )}
                        </div>
                    </form>
                </ModalWrap>
            )}
            {modal.type === "delete-company" && <ModalWrap title="Excluir empresa" onClose={closeModal}><p className="text-sm">Excluir {modal.item.name}? Isso também removerá os colaboradores da empresa.</p><div className="mt-3 flex gap-2"><button type="button" onClick={closeModal} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button><button type="button" onClick={() => removeCompany(modal.item.id)} disabled={submitting} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">{submitting ? "Excluindo..." : "Excluir"}</button></div></ModalWrap>}
            {labelModal.type === "create" && (
                <ModalWrap title="Nova etiqueta" onClose={closeLabelModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            upsertLabel("create");
                        }}
                        className="grid gap-3"
                    >
                        {labelModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{labelModalMsg}</section>}
                        <div className="grid gap-2">
                            <input
                                value={labelForm.title}
                                onChange={(event) => setLabelForm((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Título da etiqueta"
                                className="h-10 rounded-xl border px-3"
                                maxLength={40}
                                required
                            />
                            <label className="text-xs text-black/70">Cor</label>
                            <input
                                type="color"
                                value={normalizeHexColor(labelForm.color)}
                                onChange={(event) => setLabelForm((prev) => ({ ...prev, color: event.target.value }))}
                                className="h-10 w-full rounded-xl border p-1"
                            />
                            <div className="rounded-xl border border-black/10 p-3">
                                <p className="mb-2 text-xs text-black/60">Preview</p>
                                <span
                                    className="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: normalizeHexColor(labelForm.color), color: getLabelTextColor(labelForm.color) }}
                                >
                                    {labelForm.title.trim() || "Etiqueta"}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={closeLabelModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" className="h-10 flex-1 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">Criar</button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {labelModal.type === "edit" && (
                <ModalWrap title="Editar etiqueta" onClose={closeLabelModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            upsertLabel("edit", labelModal.item);
                        }}
                        className="grid gap-3"
                    >
                        {labelModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{labelModalMsg}</section>}
                        <div className="grid gap-2">
                            <input
                                value={labelForm.title}
                                onChange={(event) => setLabelForm((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Título da etiqueta"
                                className="h-10 rounded-xl border px-3"
                                maxLength={40}
                                required
                            />
                            <label className="text-xs text-black/70">Cor</label>
                            <input
                                type="color"
                                value={normalizeHexColor(labelForm.color)}
                                onChange={(event) => setLabelForm((prev) => ({ ...prev, color: event.target.value }))}
                                className="h-10 w-full rounded-xl border p-1"
                            />
                            <div className="rounded-xl border border-black/10 p-3">
                                <p className="mb-2 text-xs text-black/60">Preview</p>
                                <span
                                    className="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: normalizeHexColor(labelForm.color), color: getLabelTextColor(labelForm.color) }}
                                >
                                    {labelForm.title.trim() || "Etiqueta"}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={closeLabelModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" className="h-10 flex-1 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">Salvar</button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {labelModal.type === "delete" && (
                <ModalWrap title="Excluir etiqueta" onClose={closeLabelModal}>
                    <p className="text-sm">Excluir a etiqueta {labelModal.item.title}?</p>
                    <p className="mt-1 text-xs text-black/60">Ela também será removida de todos os contatos.</p>
                    <div className="mt-3 flex gap-2">
                        <button type="button" onClick={closeLabelModal} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button>
                        <button type="button" onClick={() => removeLabel(labelModal.item)} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Excluir</button>
                    </div>
                </ModalWrap>
            )}
            {classificationModal.type === "create" && (
                <ModalWrap title="Nova classificação" onClose={closeClassificationModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            upsertClassification("create");
                        }}
                        className="grid gap-3"
                    >
                        {classificationModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{classificationModalMsg}</section>}
                        <input
                            value={classificationFormTitle}
                            onChange={(event) => setClassificationFormTitle(event.target.value)}
                            placeholder="Título da classificação"
                            className="h-10 rounded-xl border px-3"
                            maxLength={60}
                            required
                        />
                        <select
                            value={classificationFormCategoryId}
                            onChange={(event) => setClassificationFormCategoryId(event.target.value as AtendimentoClassificationCategoryId)}
                            className="h-10 rounded-xl border px-3 text-sm"
                        >
                            {classificationCategories.map((category) => (
                                <option key={category.id} value={category.id}>{category.label}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-io-dark">
                            <input
                                type="checkbox"
                                checked={classificationFormHasValue}
                                onChange={(event) => setClassificationFormHasValue(event.target.checked)}
                            />
                            Possui valor
                        </label>
                        {classificationFormHasValue && (
                            <input
                                value={classificationFormValue}
                                onChange={(event) => setClassificationFormValue(event.target.value)}
                                placeholder="Valor da classificação"
                                inputMode="decimal"
                                className="h-10 rounded-xl border px-3 text-sm"
                                required
                            />
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={closeClassificationModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" className="h-10 flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">Criar</button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {classificationModal.type === "edit" && (
                <ModalWrap title="Editar classificação" onClose={closeClassificationModal}>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            upsertClassification("edit", classificationModal.item);
                        }}
                        className="grid gap-3"
                    >
                        {classificationModalMsg && <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{classificationModalMsg}</section>}
                        <input
                            value={classificationFormTitle}
                            onChange={(event) => setClassificationFormTitle(event.target.value)}
                            placeholder="Título da classificação"
                            className="h-10 rounded-xl border px-3"
                            maxLength={60}
                            required
                        />
                        <select
                            value={classificationFormCategoryId}
                            onChange={(event) => setClassificationFormCategoryId(event.target.value as AtendimentoClassificationCategoryId)}
                            className="h-10 rounded-xl border px-3 text-sm"
                        >
                            {classificationCategories.map((category) => (
                                <option key={category.id} value={category.id}>{category.label}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-io-dark">
                            <input
                                type="checkbox"
                                checked={classificationFormHasValue}
                                onChange={(event) => setClassificationFormHasValue(event.target.checked)}
                            />
                            Possui valor
                        </label>
                        {classificationFormHasValue && (
                            <input
                                value={classificationFormValue}
                                onChange={(event) => setClassificationFormValue(event.target.value)}
                                placeholder="Valor da classificação"
                                inputMode="decimal"
                                className="h-10 rounded-xl border px-3 text-sm"
                                required
                            />
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={closeClassificationModal} className="h-10 rounded-xl border px-4 text-sm">Cancelar</button>
                            <button type="submit" className="h-10 flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">Salvar</button>
                        </div>
                    </form>
                </ModalWrap>
            )}
            {classificationModal.type === "delete" && (
                <ModalWrap title="Excluir classificação" onClose={closeClassificationModal}>
                    <p className="text-sm">Excluir a classificação {classificationModal.item.title}?</p>
                    <div className="mt-3 flex gap-2">
                        <button type="button" onClick={closeClassificationModal} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button>
                        <button type="button" onClick={() => removeClassification(classificationModal.item)} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Excluir</button>
                    </div>
                </ModalWrap>
            )}
            {isStagesModalOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                    <div className="w-full max-w-6xl rounded-2xl border border-black/10 bg-[#f3f5f9] p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h3 className="text-xl font-semibold text-io-dark">Fases</h3>
                            <button type="button" onClick={closeStagesModal} className="rounded-lg border border-black/10 px-3 py-1 text-sm text-black/60">
                                Fechar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {crmStageDrafts.map((stage, index) => (
                                <div key={stage.id} className="grid grid-cols-[auto_minmax(0,1fr)_210px_auto] items-center gap-2">
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => moveStageDraft(index, -1)}
                                            className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 bg-white text-black/60 hover:bg-black/5"
                                            title="Subir etapa"
                                        >
                                            <ChevronUp className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveStageDraft(index, 1)}
                                            className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 bg-white text-black/60 hover:bg-black/5"
                                            title="Descer etapa"
                                        >
                                            <ChevronDown className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            value={stage.title}
                                            maxLength={100}
                                            onChange={(event) =>
                                                setCrmStageDrafts((previous) =>
                                                    previous.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item))
                                                )
                                            }
                                            className="h-10 w-full rounded-xl border border-[#c9d2e2] bg-white px-3 pr-14 text-sm text-io-dark"
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#8a97ad]">
                                            {stage.title.length}/100
                                        </span>
                                    </div>
                                    <select
                                        value={stage.kind}
                                        onChange={(event) =>
                                            setCrmStageDrafts((previous) =>
                                                previous.map((item, itemIndex) => (itemIndex === index ? { ...item, kind: event.target.value as CrmStageKind } : item))
                                            )
                                        }
                                        className="h-10 rounded-xl border border-[#c9d2e2] bg-white px-3 text-sm text-io-dark"
                                    >
                                        <option value="initial">Fase inicial</option>
                                        <option value="intermediate">Fase intermediária</option>
                                        <option value="final">Fase final</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setCrmStageDrafts((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                                        className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                        title="Excluir etapa"
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {crmStageModalMsg && <p className="mt-3 text-sm text-red-600">{crmStageModalMsg}</p>}
                        <div className="mt-4 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={addStageDraft}
                                className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-io-dark"
                            >
                                Adicionar etapa
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={closeStagesModal}
                                    className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black/70"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={saveStageDrafts}
                                    className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
                                >
                                    Salvar etapas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="pointer-events-none fixed right-4 top-4 z-[60] grid w-full max-w-sm gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-soft ${
                            toast.type === "success"
                                ? "border-green-200 bg-green-50 text-green-800"
                                : toast.type === "error"
                                    ? "border-red-200 bg-red-50 text-red-800"
                                    : "border-blue-200 bg-blue-50 text-blue-800"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <p>{toast.message}</p>
                            <button type="button" onClick={() => removeToast(toast.id)} className="text-xs opacity-70 hover:opacity-100">Fechar</button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
