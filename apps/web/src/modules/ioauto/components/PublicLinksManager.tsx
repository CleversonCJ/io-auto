"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
    CarFront,
    Check,
    CircleDollarSign,
    Copy,
    Globe2,
    Link2,
    LoaderCircle,
    Megaphone,
    MessageCircle,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react";
import type { PublicCatalogCustomBanner, PublicCatalogSettings, PublicLinkCommissionHistory, PublicLinkRecord, VehicleOptionRecord } from "@/modules/ioauto/types";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

type MePayload = {
    companyId?: string;
    companyName?: string | null;
};

type LinkResponsibleUser = {
    id: string;
    fullName: string;
    email: string;
    teamId?: string | null;
    teamName?: string | null;
};

type LinkFormState = {
    name: string;
    linkKind: "PUBLIC" | "CAMPAIGN";
    sourceType: "INFLUENCER" | "CAMPAIGN";
    scopeType: "CATALOG" | "VEHICLE";
    vehicleId: string;
    sourceReference: string;
    commissionPercentage: string;
    useCompanyWhatsapp: boolean;
    whatsappNumber: string;
    responsibleUserId: string;
};

const MAX_BANNER_IMAGES = 6;
const DEFAULT_PUBLIC_CATALOG_SETTINGS: PublicCatalogSettings = {
    bannerMode: "VEHICLES",
    customBanners: [],
};

function emptyForm(): LinkFormState {
    return {
        name: "",
        linkKind: "PUBLIC",
        sourceType: "INFLUENCER",
        scopeType: "CATALOG",
        vehicleId: "",
        sourceReference: "",
        commissionPercentage: "",
        useCompanyWhatsapp: true,
        whatsappNumber: "",
        responsibleUserId: "",
    };
}

function slugifyReference(value: string) {
    const normalized = value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return normalized.slice(0, 80);
}

function slugifyCompanyName(value: string) {
    return slugifyReference(value) || "catalogo";
}

function normalizeWhatsappNumber(value: string) {
    return value.replace(/\D/g, "").slice(0, 11);
}

function formatWhatsappInput(value: string) {
    const digits = normalizeWhatsappNumber(value);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidWhatsappNumber(value: string) {
    return /^[1-9]{2}[2-9]\d{7,8}$/.test(normalizeWhatsappNumber(value));
}

function linkKindLabel(value: string) {
    if (value === "PUBLIC") return "Público";
    return "Campanha";
}

function scopeLabel(value: string) {
    if (value === "VEHICLE") return "Veículo específico";
    return "Estoque completo";
}

function parseCommissionPercentage(value: string) {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatPercentage(value?: number | null) {
    if (value == null || !Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value) + "%";
}

function isCustomBannerMode(value: PublicCatalogSettings["bannerMode"]) {
    return value === "CUSTOM_IMAGES";
}

function normalizeCatalogSettings(payload: PublicCatalogSettings): PublicCatalogSettings {
    const customBanners = Array.isArray(payload.customBanners) && payload.customBanners.length
        ? payload.customBanners
        : (payload.customImageUrls ?? []).map((imageUrl) => ({
            imageUrl,
            title: "",
            description: "",
            redirectUrl: "",
        }));

    return {
        bannerMode: payload.bannerMode,
        customBanners: customBanners.map((banner) => ({
            imageUrl: banner.imageUrl ?? "",
            title: banner.title ?? "",
            description: banner.description ?? "",
            redirectUrl: banner.redirectUrl ?? "",
        })),
    };
}

async function compressBannerImage(file: File) {
    if (!file.type.startsWith("image/")) {
        throw new Error("Selecione apenas arquivos de imagem.");
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image();
            nextImage.onload = () => resolve(nextImage);
            nextImage.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
            nextImage.src = objectUrl;
        });

        const maxDimension = 1600;
        const originalWidth = image.naturalWidth || image.width;
        const originalHeight = image.naturalHeight || image.height;
        const longestSide = Math.max(originalWidth, originalHeight, 1);
        const scale = Math.min(1, maxDimension / longestSide);
        const width = Math.max(1, Math.round(originalWidth * scale));
        const height = Math.max(1, Math.round(originalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Não foi possível preparar a imagem para upload.");
        }

        context.drawImage(image, 0, 0, width, height);

        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        return canvas.toDataURL(outputType, outputType === "image/jpeg" ? 0.82 : undefined);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export function PublicLinksManager() {
    const [links, setLinks] = useState<PublicLinkRecord[]>([]);
    const [vehicles, setVehicles] = useState<VehicleOptionRecord[]>([]);
    const [responsibleUsers, setResponsibleUsers] = useState<LinkResponsibleUser[]>([]);
    const [catalogSettings, setCatalogSettings] = useState<PublicCatalogSettings>(DEFAULT_PUBLIC_CATALOG_SETTINGS);
    const [savedCatalogSettings, setSavedCatalogSettings] = useState<PublicCatalogSettings>(DEFAULT_PUBLIC_CATALOG_SETTINGS);
    const [catalogSettingsLoading, setCatalogSettingsLoading] = useState(true);
    const [catalogSettingsError, setCatalogSettingsError] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState("Catálogo");
    const [origin, setOrigin] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingCatalogSettings, setSavingCatalogSettings] = useState(false);
    const [processingImages, setProcessingImages] = useState(false);
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [commissionLink, setCommissionLink] = useState<PublicLinkRecord | null>(null);
    const [commissionHistory, setCommissionHistory] = useState<PublicLinkCommissionHistory | null>(null);
    const [commissionHistoryLoading, setCommissionHistoryLoading] = useState(false);
    const [commissionHistoryError, setCommissionHistoryError] = useState<string | null>(null);
    const [form, setForm] = useState<LinkFormState>(emptyForm());

    const filteredLinks = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return links;

        return links.filter((link) =>
            [
                link.name,
                link.vehicleTitle,
                link.sourceReference,
                link.sourceType,
                link.linkKind,
                link.scopeType,
                link.whatsappNumber,
                link.responsibleUserName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
        );
    }, [links, search]);

    const publicLinks = useMemo(() => filteredLinks.filter((link) => link.linkKind === "PUBLIC"), [filteredLinks]);
    const campaignLinks = useMemo(() => filteredLinks.filter((link) => link.linkKind === "CAMPAIGN"), [filteredLinks]);
    const catalogSettingsChanged = useMemo(
        () => JSON.stringify(catalogSettings) !== JSON.stringify(savedCatalogSettings),
        [catalogSettings, savedCatalogSettings]
    );
    const previewPath = useMemo(() => {
        const basePath =
            form.scopeType === "VEHICLE" && form.vehicleId
                ? `/estoque-publico/${slugifyCompanyName(companyName)}/veiculo/${form.vehicleId}`
                : `/estoque-publico/${slugifyCompanyName(companyName)}`;

        if (form.linkKind === "PUBLIC") {
            return basePath;
        }

        const reference = slugifyReference(form.sourceReference);
        if (!reference) return basePath;
        return `${basePath}?source=${form.sourceType.toLowerCase()}&ref=${reference}`;
    }, [companyName, form.linkKind, form.scopeType, form.sourceReference, form.sourceType, form.vehicleId]);

    useEffect(() => {
        setOrigin(window.location.origin);
        void loadData();
        void loadCatalogSettings();
    }, []);

    useEffect(() => {
        if (form.linkKind !== "PUBLIC") return;
        if (form.scopeType === "CATALOG" && !form.vehicleId) return;

        setForm((current) => ({
            ...current,
            scopeType: "CATALOG",
            vehicleId: "",
        }));
    }, [form.linkKind, form.scopeType, form.vehicleId]);

    async function loadData() {
        setLoading(true);
        try {
            const [linksResponse, vehiclesResponse, usersResponse, meResponse] = await Promise.all([
                fetch("/api/ioauto/public-links", { cache: "no-store" }),
                fetch("/api/ioauto/vehicles/options", { cache: "no-store" }),
                fetch("/api/atendimentos/users", { cache: "no-store" }),
                fetch("/api/auth/me", { cache: "no-store" }),
            ]);

            if (!linksResponse.ok) throw new Error("Falha ao carregar os links públicos.");
            if (!vehiclesResponse.ok) throw new Error("Falha ao carregar os veículos.");
            if (!usersResponse.ok) throw new Error("Falha ao carregar os usuários responsáveis.");

            const [linksPayload, vehiclesPayload, usersPayload, mePayload] = await Promise.all([
                linksResponse.json() as Promise<PublicLinkRecord[]>,
                vehiclesResponse.json() as Promise<VehicleOptionRecord[]>,
                usersResponse.json() as Promise<LinkResponsibleUser[]>,
                meResponse.ok ? meResponse.json() as Promise<MePayload> : Promise.resolve(null),
            ]);

            setLinks(linksPayload);
            setVehicles(vehiclesPayload);
            setResponsibleUsers(usersPayload);
            setCompanyName(mePayload?.companyName?.trim() || "Catálogo");
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar os links.");
        } finally {
            setLoading(false);
        }
    }

    async function loadCatalogSettings() {
        setCatalogSettingsLoading(true);
        setCatalogSettingsError(null);
        try {
            const response = await fetch("/api/ioauto/public-catalog-settings", { cache: "no-store" });
            if (!response.ok) throw new Error("Falha ao carregar as configurações do banner.");

            const payload = normalizeCatalogSettings(await response.json() as PublicCatalogSettings);
            setCatalogSettings(payload);
            setSavedCatalogSettings(payload);
        } catch (cause) {
            setCatalogSettingsError(cause instanceof Error ? cause.message : "Falha ao carregar as configurações do banner.");
        } finally {
            setCatalogSettingsLoading(false);
        }
    }

    function updateForm<K extends keyof LinkFormState>(key: K, value: LinkFormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function updateCatalogSettings(nextValue: Partial<PublicCatalogSettings>) {
        setCatalogSettings((current) => ({ ...current, ...nextValue }));
    }

    function openCreateModal() {
        setForm(emptyForm());
        setError(null);
        setIsCreateOpen(true);
    }

    function closeCreateModal() {
        setIsCreateOpen(false);
        setForm(emptyForm());
    }

    async function handleCreateLink(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!form.useCompanyWhatsapp && !isValidWhatsappNumber(form.whatsappNumber)) {
            setError("Informe um WhatsApp válido com DDD para este link.");
            return;
        }
        if (!form.responsibleUserId) {
            setError("Selecione o usuário responsável pelos leads deste link.");
            return;
        }
        const commissionPercentage = parseCommissionPercentage(form.commissionPercentage);
        if (form.linkKind === "CAMPAIGN" && form.sourceType === "INFLUENCER"
            && (commissionPercentage == null || commissionPercentage <= 0 || commissionPercentage > 100)) {
            setError("Informe uma comissão maior que 0% e menor ou igual a 100%.");
            return;
        }

        setSaving(true);
        const payload = {
            name: form.name,
            linkKind: form.linkKind,
            scopeType: form.scopeType,
            vehicleId: form.scopeType === "VEHICLE" ? form.vehicleId || null : null,
            sourceType: form.linkKind === "CAMPAIGN" ? form.sourceType : null,
            sourceReference: form.linkKind === "CAMPAIGN" ? slugifyReference(form.sourceReference) : null,
            commissionPercentage: form.linkKind === "CAMPAIGN" && form.sourceType === "INFLUENCER"
                ? commissionPercentage
                : null,
            useCompanyWhatsapp: form.useCompanyWhatsapp,
            whatsappNumber: form.useCompanyWhatsapp ? null : normalizeWhatsappNumber(form.whatsappNumber),
            responsibleUserId: form.responsibleUserId,
        };

        const response = await fetch("/api/ioauto/public-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { message?: string } | null;
            setError(data?.message ?? "Falha ao criar o link.");
            setSaving(false);
            return;
        }

        await loadData();
        setSaving(false);
        closeCreateModal();
    }

    async function handleDeleteLink(link: PublicLinkRecord) {
        const confirmed = window.confirm(`Deseja remover o link "${link.name}"?`);
        if (!confirmed) return;

        const response = await fetch(`/api/ioauto/public-links/${link.id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { message?: string } | null;
            setError(data?.message ?? "Falha ao remover o link.");
            return;
        }

        await loadData();
    }

    async function handleCopyLink(link: PublicLinkRecord) {
        try {
            await navigator.clipboard.writeText(`${origin}${link.publicPath}`);
            setCopiedLinkId(link.id);
            window.setTimeout(() => setCopiedLinkId(null), 2200);
        } catch {
            setError("Não foi possível copiar o link.");
        }
    }

    async function openCommissionHistory(link: PublicLinkRecord) {
        setCommissionLink(link);
        setCommissionHistory(null);
        setCommissionHistoryError(null);
        setCommissionHistoryLoading(true);

        try {
            const response = await fetch(`/api/ioauto/public-links/${link.id}/commissions`, { cache: "no-store" });
            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                throw new Error(payload?.message ?? "Falha ao carregar o histórico de comissão.");
            }
            setCommissionHistory(await response.json() as PublicLinkCommissionHistory);
        } catch (cause) {
            setCommissionHistoryError(cause instanceof Error ? cause.message : "Falha ao carregar o histórico de comissão.");
        } finally {
            setCommissionHistoryLoading(false);
        }
    }

    function closeCommissionHistory() {
        setCommissionLink(null);
        setCommissionHistory(null);
        setCommissionHistoryError(null);
    }

    async function handleCatalogImagesSelected(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";

        if (!files.length) return;

        const remainingSlots = Math.max(0, MAX_BANNER_IMAGES - catalogSettings.customBanners.length);
        if (remainingSlots === 0) {
            setError(`Você pode manter no máximo ${MAX_BANNER_IMAGES} imagens no banner.`);
            return;
        }

        setProcessingImages(true);
        setError(null);

        try {
            const preparedImages = await Promise.all(files.slice(0, remainingSlots).map((file) => compressBannerImage(file)));
            setCatalogSettings((current) => ({
                ...current,
                bannerMode: "CUSTOM_IMAGES",
                customBanners: [
                    ...current.customBanners,
                    ...preparedImages.map((imageUrl) => ({ imageUrl, title: "", description: "", redirectUrl: "" })),
                ].slice(0, MAX_BANNER_IMAGES),
            }));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao processar as imagens do banner.");
        } finally {
            setProcessingImages(false);
        }
    }

    function handleRemoveCatalogImage(index: number) {
        setCatalogSettings((current) => ({
            ...current,
            customBanners: current.customBanners.filter((_, currentIndex) => currentIndex !== index),
        }));
    }

    function updateCustomBanner(index: number, nextValue: Partial<PublicCatalogCustomBanner>) {
        setCatalogSettings((current) => ({
            ...current,
            customBanners: current.customBanners.map((banner, currentIndex) =>
                currentIndex === index ? { ...banner, ...nextValue } : banner
            ),
        }));
    }

    async function handleSaveCatalogSettings() {
        setSavingCatalogSettings(true);
        setError(null);

        const response = await fetch("/api/ioauto/public-catalog-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(catalogSettings),
        });

        if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { message?: string } | null;
            setError(data?.message ?? "Falha ao salvar as configurações do banner.");
            setSavingCatalogSettings(false);
            return;
        }

        const payload = normalizeCatalogSettings((await response.json()) as PublicCatalogSettings);
        setCatalogSettings(payload);
        setSavedCatalogSettings(payload);
        setSavingCatalogSettings(false);
    }

    return (
        <>
            <div className="grid gap-6">
                <section className="overflow-hidden rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-6">
                    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
                        <label className="flex h-14 flex-1 items-center gap-3 rounded-full border border-black/10 bg-[#fafafa] px-5">
                            <Search className="h-5 w-5 text-black/40" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Pesquisar por nome, origem ou veículo"
                                className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/35"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-io-purple px-5 text-sm font-semibold text-white transition hover:bg-black/85"
                        >
                            <Plus className="h-4 w-4" />
                            Novo link
                        </button>
                    </div>
                </section>

                {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

                {loading ? (
                    <SystemPageLoader
                        compact
                        label="Carregando links"
                        description="Preparando páginas, veículos e responsáveis..."
                        className="rounded-[34px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
                    />
                ) : (
                    <div className="grid gap-6">
                        {catalogSettingsLoading ? (
                            <SystemPageLoader
                                compact
                                label="Carregando configuração do catálogo"
                                description="Preparando o banner da vitrine pública..."
                                className="rounded-[34px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
                            />
                        ) : catalogSettingsError ? (
                            <section className="rounded-[34px] border border-red-100 bg-red-50 px-6 py-8 text-center">
                                <p className="text-sm font-semibold text-red-700">{catalogSettingsError}</p>
                                <button
                                    type="button"
                                    onClick={() => void loadCatalogSettings()}
                                    className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-io-dark px-5 text-sm font-semibold text-white transition hover:bg-black/85"
                                >
                                    Tentar novamente
                                </button>
                            </section>
                        ) : (
                            <section className="rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-6">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="max-w-3xl">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-io-purple/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple border border-io-purple/10">
                                        <Globe2 className="h-4 w-4" />
                                        Banner do estoque público
                                    </p>
                                    <h2 className="mt-4 font-display text-3xl font-bold text-io-dark">Escolha como a vitrine abre</h2>
                                    <p className="mt-2 text-sm text-black/56">
                                        Use os carros em destaque ou envie imagens próprias para rodar no topo da página pública como banner.
                                    </p>
                                    <p className="mt-3 text-sm text-black/50">
                                        Preview público: {origin}/estoque-publico/{slugifyCompanyName(companyName)}
                                    </p>
                                </div>

                                <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1.5 self-start xl:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => updateCatalogSettings({ bannerMode: "VEHICLES" })}
                                        className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition ${!isCustomBannerMode(catalogSettings.bannerMode)
                                                ? "bg-white text-io-dark shadow-sm"
                                                : "text-black/55 hover:text-io-dark"
                                            }`}
                                    >
                                        Rodar carros
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateCatalogSettings({ bannerMode: "CUSTOM_IMAGES" })}
                                        className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition ${isCustomBannerMode(catalogSettings.bannerMode)
                                                ? "bg-io-purple text-white shadow-sm"
                                                : "text-black/55 hover:text-io-dark"
                                            }`}
                                    >
                                        Usar imagens
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 border-t border-black/5 pt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                                {isCustomBannerMode(catalogSettings.bannerMode) ? (
                                    <div className="rounded-[28px] border border-black/10 bg-white p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/38">Imagens do banner</p>
                                                <p className="mt-2 text-sm text-black/56">Até {MAX_BANNER_IMAGES} imagens. Elas são comprimidas antes de salvar.</p>
                                            </div>
                                            <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-io-purple px-4 text-sm font-semibold text-white transition hover:bg-black/85">
                                                {processingImages ? "Processando..." : "Adicionar imagens"}
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleCatalogImagesSelected} />
                                            </label>
                                        </div>

                                        {catalogSettings.customBanners.length ? (
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                {catalogSettings.customBanners.map((banner, index) => (
                                                    <article key={`${index}-${banner.imageUrl.slice(0, 24)}`} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
                                                        <div className="relative aspect-[16/9] bg-black/5">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={banner.imageUrl} alt={`Banner ${index + 1}`} className="h-full w-full object-cover" />
                                                            {banner.title.trim() || banner.description.trim() ? (
                                                                <>
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
                                                                    <div className="absolute inset-y-0 left-0 flex w-4/5 flex-col justify-center p-4 text-white">
                                                                        {banner.title ? <p className="font-display text-lg font-bold leading-tight">{banner.title}</p> : null}
                                                                        {banner.description ? <p className={`${banner.title ? "mt-1" : ""} line-clamp-2 text-xs leading-5 text-white/80`}>{banner.description}</p> : null}
                                                                    </div>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                        <div className="space-y-3 p-4">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-semibold text-black/60">Banner {index + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveCatalogImage(index)}
                                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                                                    aria-label={`Remover imagem ${index + 1}`}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            <label className="block">
                                                                <span className="text-xs font-semibold text-black/50">Título (opcional)</span>
                                                                <input
                                                                    value={banner.title}
                                                                    onChange={(event) => updateCustomBanner(index, { title: event.target.value })}
                                                                    maxLength={120}
                                                                    placeholder="Ex.: Feirão de seminovos"
                                                                    className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-sm text-io-dark outline-none transition focus:border-io-purple/45 focus:bg-white"
                                                                />
                                                            </label>
                                                            <label className="block">
                                                                <span className="text-xs font-semibold text-black/50">Descrição (opcional)</span>
                                                                <textarea
                                                                    value={banner.description}
                                                                    onChange={(event) => updateCustomBanner(index, { description: event.target.value })}
                                                                    maxLength={300}
                                                                    rows={3}
                                                                    placeholder="Apresente a oferta ou chamada deste banner"
                                                                    className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-io-dark outline-none transition focus:border-io-purple/45 focus:bg-white"
                                                                />
                                                            </label>
                                                            <label className="block">
                                                                <span className="text-xs font-semibold text-black/50">Link de redirecionamento (opcional)</span>
                                                                <input
                                                                    type="url"
                                                                    value={banner.redirectUrl}
                                                                    onChange={(event) => updateCustomBanner(index, { redirectUrl: event.target.value })}
                                                                    maxLength={2048}
                                                                    placeholder="https://exemplo.com/oferta"
                                                                    className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-sm text-io-dark outline-none transition focus:border-io-purple/45 focus:bg-white"
                                                                />
                                                                <span className="mt-1.5 block text-[11px] leading-4 text-black/38">O banner inteiro ficará clicável quando este campo for preenchido.</span>
                                                            </label>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-4 rounded-[24px] border border-dashed border-black/12 bg-white px-6 py-10 text-center">
                                                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-black/5 text-black/48 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                                                    <Globe2 className="h-5 w-5" />
                                                </div>
                                                <h3 className="mt-4 font-display text-2xl font-bold text-io-dark">Nenhuma imagem</h3>
                                                <p className="mt-2 text-sm text-black/56">Adicione imagens personalizadas para exibir no topo da sua vitrine pública.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-[34px] bg-black/[0.03] border-2 border-dashed border-black/5 p-8 text-center h-full min-h-[300px]">
                                        <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm text-io-purple">
                                            <CarFront className="h-8 w-8" />
                                        </div>
                                        <h3 className="mt-6 font-display text-2xl font-bold text-io-dark">Modo Automático</h3>
                                        <p className="mt-2 text-sm text-black/56 max-w-sm">
                                            Neste modo, o banner exibira automaticamente os veículos em destaque e as entradas mais recentes do seu estoque.
                                        </p>
                                    </div>
                                )}

                                <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-io-purple animate-pulse" />
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/35">Configuração atual</p>
                                    </div>
                                    <h3 className="mt-4 font-display text-2xl font-bold text-io-dark">
                                        {isCustomBannerMode(catalogSettings.bannerMode) ? "Imagens personalizadas" : "Carros do estoque"}
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-black/56">
                                        {isCustomBannerMode(catalogSettings.bannerMode)
                                            ? "A página pública exibira as imagens enviadas ao lado em um carrossel rotativo."
                                            : "A página pública continua usando os carros em destaque e mais recentes no banner."}
                                    </p>

                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3.5 text-sm">
                                            <span className="text-black/50">Imagens preparadas</span>
                                            <span className="font-bold text-io-dark">{catalogSettings.customBanners.length}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3.5 text-sm">
                                            <span className="text-black/50">Status das alterações</span>
                                            <span className={`font-bold ${catalogSettingsChanged ? "text-io-purple" : "text-green-600"}`}>
                                                {catalogSettingsChanged ? "Pendentes" : "Salvas"}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSaveCatalogSettings}
                                        disabled={savingCatalogSettings || processingImages || !catalogSettingsChanged}
                                        className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30"
                                    >
                                        {savingCatalogSettings ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                        Salvar Alterações
                                    </button>

                                    {catalogSettingsChanged && (
                                        <p className="mt-4 text-center text-xs text-io-purple font-medium">
                                            Você tem alterações não salvas. Clique acima para aplicar.
                                        </p>
                                    )}
                                </div>
                            </div>
                            </section>
                        )}

                        <LinkSection
                            title="Links públicos do estoque"
                            description="Links limpos para divulgar a vitrine pública sem origem de campanha."
                            icon={<Globe2 className="h-4 w-4" />}
                            links={publicLinks}
                            copiedLinkId={copiedLinkId}
                            onCopyLink={handleCopyLink}
                            onOpenCommissionHistory={openCommissionHistory}
                            onDeleteLink={handleDeleteLink}
                        />

                        <LinkSection
                            title="Links de influenciadores e campanhas"
                            description="Links rastreáveis para medir qual parceiro ou campanha trouxe mais interações."
                            icon={<Megaphone className="h-4 w-4" />}
                            links={campaignLinks}
                            copiedLinkId={copiedLinkId}
                            onCopyLink={handleCopyLink}
                            onOpenCommissionHistory={openCommissionHistory}
                            onDeleteLink={handleDeleteLink}
                        />
                    </div>
                )}
            </div>

            {isCreateOpen ? (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 px-4 py-6">
                    <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
                        <div className="w-full rounded-[34px] border border-white/15 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-7">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/38">Novo link</p>
                                    <h2 className="mt-2 font-display text-2xl font-bold text-io-dark">Criar link</h2>
                                    <p className="mt-2 text-sm text-black/56">
                                        Escolha se o link será público ou de campanha e defina se ele aponta para o estoque inteiro ou para um veículo específico.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                                    aria-label="Fechar modal"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateLink} className="mt-6 grid gap-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label="Nome do link" value={form.name} onChange={(value) => updateForm("name", value)} required />

                                    <SelectField
                                        label="Tipo"
                                        value={form.linkKind}
                                        onChange={(value) => updateForm("linkKind", value as LinkFormState["linkKind"])}
                                        options={[
                                            { value: "PUBLIC", label: "Público" },
                                            { value: "CAMPAIGN", label: "Influenciador / campanha" },
                                        ]}
                                    />
                                </div>

                                {form.linkKind === "CAMPAIGN" ? (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <SelectField
                                            label="Origem"
                                            value={form.sourceType}
                                            onChange={(value) => updateForm("sourceType", value as LinkFormState["sourceType"])}
                                            options={[
                                                { value: "INFLUENCER", label: "Influenciador" },
                                                { value: "CAMPAIGN", label: "Campanha" },
                                            ]}
                                        />
                                        <Field
                                            label="Identificador"
                                            value={form.sourceReference}
                                            onChange={(value) => updateForm("sourceReference", value)}
                                            placeholder="Ex.: joao-da-radio"
                                            required
                                        />
                                    </div>
                                ) : null}

                                {form.linkKind === "CAMPAIGN" && form.sourceType === "INFLUENCER" ? (
                                    <label className="grid gap-2">
                                        <span className="text-sm font-medium text-black/60">Comissão sobre o valor da venda (%)</span>
                                        <div className="flex h-12 items-center rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 transition focus-within:border-black/30 focus-within:bg-white">
                                            <input
                                                type="text"
                                                value={form.commissionPercentage}
                                                onChange={(event) => {
                                                    const value = event.target.value.replace(/[^\d,.]/g, "").slice(0, 8);
                                                    updateForm("commissionPercentage", value);
                                                    setError(null);
                                                }}
                                                placeholder="Ex.: 2,5"
                                                inputMode="decimal"
                                                maxLength={8}
                                                required
                                                className="h-full min-w-0 flex-1 bg-transparent text-sm text-io-dark outline-none placeholder:text-black/32"
                                            />
                                            <span className="ml-3 text-sm font-semibold text-black/45">%</span>
                                        </div>
                                        <span className="text-xs text-black/42">O percentual será calculado sobre o valor negociado da venda.</span>
                                    </label>
                                ) : null}

                                {form.linkKind === "CAMPAIGN" ? (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <SelectField
                                            label="Destino"
                                            value={form.scopeType}
                                            onChange={(value) => updateForm("scopeType", value as LinkFormState["scopeType"])}
                                            options={[
                                                { value: "CATALOG", label: "Estoque completo" },
                                                { value: "VEHICLE", label: "Veículo específico" },
                                            ]}
                                        />

                                        {form.scopeType === "VEHICLE" ? (
                                            <SelectField
                                                label="Veículo"
                                                value={form.vehicleId}
                                                onChange={(value) => updateForm("vehicleId", value)}
                                                options={vehicles.map((vehicle) => ({
                                                    value: vehicle.id,
                                                    label: vehicle.title,
                                                }))}
                                                placeholder="Selecione um veículo"
                                            />
                                        ) : (
                                            <div className="rounded-[26px] border border-black/10 bg-black/5 px-5 py-4 text-sm text-black/58">
                                                Esse link vai abrir a listagem completa do estoque.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-[26px] border border-black/10 bg-black/5 px-5 py-4 text-sm text-black/58">
                                        O link público sempre aponta para o estoque completo da empresa.
                                    </div>
                                )}

                                <label className="grid gap-2 rounded-[28px] border border-black/10 bg-white px-5 py-5">
                                    <span className="text-sm font-semibold text-io-dark">Responsável pelos leads</span>
                                    <span className="text-sm leading-6 text-black/55">
                                        Os leads originados por este link ficarão visíveis para o usuário selecionado e para administradores.
                                    </span>
                                    <select
                                        value={form.responsibleUserId}
                                        onChange={(event) => {
                                            updateForm("responsibleUserId", event.target.value);
                                            setError(null);
                                        }}
                                        required
                                        className="mt-2 h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
                                    >
                                        <option value="">Selecione um usuário</option>
                                        {responsibleUsers.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.fullName}{user.teamName ? ` • ${user.teamName}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {!responsibleUsers.length ? (
                                        <span className="text-xs text-red-700">
                                            Nenhum usuário ativo está disponível para receber leads.
                                        </span>
                                    ) : null}
                                </label>

                                <fieldset className="rounded-[28px] border border-black/10 bg-white px-5 py-5">
                                    <legend className="px-2 text-sm font-semibold text-io-dark">WhatsApp dos botões de contato</legend>
                                    <p className="mt-1 text-sm text-black/55">
                                        Escolha qual número receberá os contatos originados por este link.
                                    </p>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <label
                                            className={`flex cursor-pointer items-start gap-3 rounded-[22px] border px-4 py-4 transition ${
                                                form.useCompanyWhatsapp
                                                    ? "border-io-purple bg-io-purple/5"
                                                    : "border-black/10 bg-[#fafafa] hover:border-black/20"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="whatsappSource"
                                                checked={form.useCompanyWhatsapp}
                                                onChange={() => {
                                                    updateForm("useCompanyWhatsapp", true);
                                                    setError(null);
                                                }}
                                                className="mt-1 accent-[#6b00e3]"
                                            />
                                            <span>
                                                <span className="block text-sm font-semibold text-io-dark">Número padrão da empresa</span>
                                                <span className="mt-1 block text-xs leading-5 text-black/50">
                                                    Usa automaticamente o WhatsApp cadastrado nas configurações da empresa.
                                                </span>
                                            </span>
                                        </label>

                                        <label
                                            className={`flex cursor-pointer items-start gap-3 rounded-[22px] border px-4 py-4 transition ${
                                                !form.useCompanyWhatsapp
                                                    ? "border-io-purple bg-io-purple/5"
                                                    : "border-black/10 bg-[#fafafa] hover:border-black/20"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="whatsappSource"
                                                checked={!form.useCompanyWhatsapp}
                                                onChange={() => {
                                                    updateForm("useCompanyWhatsapp", false);
                                                    setError(null);
                                                }}
                                                className="mt-1 accent-[#6b00e3]"
                                            />
                                            <span>
                                                <span className="block text-sm font-semibold text-io-dark">Número personalizado</span>
                                                <span className="mt-1 block text-xs leading-5 text-black/50">
                                                    Direciona somente os contatos deste link para outro WhatsApp.
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    {!form.useCompanyWhatsapp ? (
                                        <label className="mt-4 grid gap-2">
                                            <span className="text-sm font-medium text-black/60">WhatsApp personalizado</span>
                                            <div className="flex h-12 items-center gap-3 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 transition focus-within:border-black/30 focus-within:bg-white">
                                                <MessageCircle className="h-4 w-4 shrink-0 text-black/38" />
                                                <input
                                                    value={form.whatsappNumber}
                                                    onChange={(event) => {
                                                        updateForm("whatsappNumber", formatWhatsappInput(event.target.value));
                                                        setError(null);
                                                    }}
                                                    placeholder="(11) 99999-9999"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                    maxLength={15}
                                                    required
                                                    className="h-full w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/32"
                                                />
                                            </div>
                                            {form.whatsappNumber && !isValidWhatsappNumber(form.whatsappNumber) ? (
                                                <span className="text-xs text-red-700">Informe um número válido com DDD.</span>
                                            ) : (
                                                <span className="text-xs text-black/42">Use um número brasileiro com DDD.</span>
                                            )}
                                        </label>
                                    ) : null}
                                </fieldset>

                                <div className="rounded-[28px] bg-black/5 px-5 py-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/38">Preview do link</p>
                                    <p className="mt-3 break-all text-sm leading-6 text-black/68">{origin}{previewPath}</p>
                                </div>

                                {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

                                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeCreateModal}
                                        className="inline-flex h-12 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-black/68 transition hover:border-black/20 hover:text-io-dark"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            saving
                                            || !form.responsibleUserId
                                            || !responsibleUsers.length
                                            || (form.linkKind === "CAMPAIGN" && form.scopeType === "VEHICLE" && !form.vehicleId)
                                            || (form.linkKind === "CAMPAIGN" && form.sourceType === "INFLUENCER" && !form.commissionPercentage)
                                        }
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-io-purple px-5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/30"
                                    >
                                        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        Criar link
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : null}

            {commissionLink ? (
                <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/55 px-4 py-6">
                    <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center">
                        <div className="w-full rounded-[34px] border border-white/15 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-7">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-io-purple">Histórico de comissão</p>
                                    <h2 className="mt-2 font-display text-2xl font-bold text-io-dark">{commissionLink.name}</h2>
                                    <p className="mt-2 text-sm text-black/56">Últimas vendas atribuídas a este link de influenciador.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeCommissionHistory}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                                    aria-label="Fechar histórico de comissão"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {commissionHistoryLoading ? (
                                <div className="grid min-h-64 place-items-center">
                                    <LoaderCircle className="h-7 w-7 animate-spin text-io-purple" />
                                </div>
                            ) : commissionHistoryError ? (
                                <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{commissionHistoryError}</p>
                            ) : commissionHistory ? (
                                <>
                                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                        <CommissionSummaryCard label="Percentual" value={formatPercentage(commissionHistory.commissionPercentage)} />
                                        <CommissionSummaryCard label="Vendas pelo link" value={String(commissionHistory.totalSales)} />
                                        <CommissionSummaryCard label="Comissão total" value={formatMoney(commissionHistory.totalCommissionCents)} accent />
                                    </div>

                                    {commissionHistory.sales.length ? (
                                        <div className="mt-6 overflow-x-auto rounded-[26px] border border-black/10">
                                            <table className="w-full min-w-[680px] border-collapse text-left">
                                                <thead className="bg-black/[0.035] text-[11px] font-semibold uppercase tracking-[0.16em] text-black/42">
                                                    <tr>
                                                        <th className="px-4 py-3">Data da venda</th>
                                                        <th className="px-4 py-3">Veículo</th>
                                                        <th className="px-4 py-3">Valor total</th>
                                                        <th className="px-4 py-3">Percentual</th>
                                                        <th className="px-4 py-3">Comissão</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {commissionHistory.sales.map((sale) => (
                                                        <tr key={sale.saleId} className="border-t border-black/8 text-sm text-black/65">
                                                            <td className="whitespace-nowrap px-4 py-4">{formatDateTime(sale.soldAt)}</td>
                                                            <td className="px-4 py-4 font-semibold text-io-dark">{sale.vehicleTitle}</td>
                                                            <td className="whitespace-nowrap px-4 py-4">{formatMoney(sale.saleAmountCents)}</td>
                                                            <td className="whitespace-nowrap px-4 py-4">{formatPercentage(sale.commissionPercentage)}</td>
                                                            <td className="whitespace-nowrap px-4 py-4 font-bold text-io-purple">{formatMoney(sale.commissionAmountCents)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="mt-6 rounded-[26px] border border-dashed border-black/12 bg-black/[0.02] px-6 py-10 text-center">
                                            <CircleDollarSign className="mx-auto h-8 w-8 text-black/30" />
                                            <p className="mt-3 text-sm font-semibold text-io-dark">Nenhuma comissão registrada</p>
                                            <p className="mt-1 text-sm text-black/50">As vendas concluídas a partir deste link aparecerão aqui.</p>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function LinkSection({
    title,
    description,
    icon,
    links,
    copiedLinkId,
    onCopyLink,
    onOpenCommissionHistory,
    onDeleteLink,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    links: PublicLinkRecord[];
    copiedLinkId: string | null;
    onCopyLink: (link: PublicLinkRecord) => void;
    onOpenCommissionHistory: (link: PublicLinkRecord) => void;
    onDeleteLink: (link: PublicLinkRecord) => void;
}) {
    return (
        <section className="rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-6">
            <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-io-purple/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple border border-io-purple/10">
                    {icon}
                    {title}
                </p>
                <p className="mt-3 text-sm text-black/56">{description}</p>
            </div>

            {links.length ? (
                <div className="mt-5 overflow-hidden rounded-[28px] border border-black/10">
                    {links.map((link, index) => (
                        <article
                            key={link.id}
                            className={`grid gap-4 bg-white px-4 py-4 ${link.sourceType === "INFLUENCER"
                                ? "xl:grid-cols-[1.2fr_0.8fr_0.85fr_0.8fr_0.65fr_0.5fr_0.5fr_0.5fr_0.8fr_auto]"
                                : "xl:grid-cols-[1.2fr_0.85fr_0.9fr_0.85fr_0.55fr_0.55fr_0.55fr_0.85fr_auto]"
                            } xl:items-center ${index === 0 ? "" : "border-t border-black/8"
                                }`}
                        >
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-io-dark">{link.name}</p>
                                <p className="mt-1 text-sm text-black/56">
                                    {linkKindLabel(link.linkKind)} • {scopeLabel(link.scopeType)}
                                    {link.vehicleTitle ? ` • ${link.vehicleTitle}` : ""}
                                </p>
                                {link.sourceType === "INFLUENCER" && link.commissionPercentage != null ? (
                                    <p className="mt-1 text-xs font-semibold text-io-purple">Comissão de {formatPercentage(link.commissionPercentage)}</p>
                                ) : null}
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Responsável</p>
                                <p className="mt-1 text-sm text-black/62">
                                    {link.responsibleUserName || "Não atribuído"}
                                </p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Origem</p>
                                <p className="mt-1 text-sm text-black/62">
                                    {link.sourceReference || (link.linkKind === "PUBLIC" ? "Rastreamento automático" : "Sem rastreio")}
                                </p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">WhatsApp</p>
                                <p className="mt-1 text-sm text-black/62">
                                    {link.useCompanyWhatsapp
                                        ? "Padrão da empresa"
                                        : formatWhatsappInput(link.whatsappNumber ?? "") || "Personalizado"}
                                </p>
                            </div>

                            {link.sourceType === "INFLUENCER" ? (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Comissão total</p>
                                    <p className="mt-1 text-sm font-semibold text-io-purple">{formatMoney(link.totalCommissionCents)}</p>
                                </div>
                            ) : null}

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Interações</p>
                                <p className="mt-1 text-sm text-black/62">{link.totalInteractions}</p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Contatos</p>
                                <p className="mt-1 text-sm text-black/62">{link.contactClicks}</p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Interesses</p>
                                <p className="mt-1 text-sm text-black/62">{link.interestClicks}</p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Última interação</p>
                                <p className="mt-1 text-sm text-black/62">{formatDateTime(link.lastInteractionAt)}</p>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => onCopyLink(link)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/12 bg-white text-black/72 transition hover:border-black/22 hover:text-io-dark"
                                    aria-label={`Copiar link ${link.name}`}
                                    title={copiedLinkId === link.id ? "Copiado" : "Copiar link"}
                                >
                                    {copiedLinkId === link.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                                {link.sourceType === "INFLUENCER" ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpenCommissionHistory(link)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-io-purple/20 bg-io-purple/5 text-io-purple transition hover:bg-io-purple/10"
                                        aria-label={`Abrir histórico de comissão de ${link.name}`}
                                        title="Histórico de comissão"
                                    >
                                        <CircleDollarSign className="h-4 w-4" />
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => onDeleteLink(link)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
                                    aria-label={`Excluir link ${link.name}`}
                                    title="Excluir link"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="mt-5 rounded-[28px] border border-dashed border-black/12 bg-white px-6 py-10 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-black/5 text-black/48 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                        <Link2 className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold text-io-dark">Nenhum link encontrado</h3>
                    <p className="mt-2 text-sm text-black/56">Crie um novo link para começar a divulgar o estoque ou medir campanhas.</p>
                </div>
            )}
        </section>
    );
}

function CommissionSummaryCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={`rounded-[24px] border px-5 py-4 ${accent ? "border-io-purple/15 bg-io-purple/5" : "border-black/10 bg-black/[0.025]"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/42">{label}</p>
            <p className={`mt-2 text-xl font-bold ${accent ? "text-io-purple" : "text-io-dark"}`}>{value}</p>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            >
                {placeholder ? <option value="">{placeholder}</option> : null}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
