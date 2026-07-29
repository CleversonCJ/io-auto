"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
    CarFront,
    Check,
    Copy,
    Globe2,
    Link2,
    LoaderCircle,
    Megaphone,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react";
import type { PublicCatalogSettings, PublicLinkRecord, VehicleRecord } from "@/modules/ioauto/types";
import { formatDateTime } from "@/modules/ioauto/formatters";

type MePayload = {
    companyId?: string;
    companyName?: string | null;
};

type LinkFormState = {
    name: string;
    linkKind: "PUBLIC" | "CAMPAIGN";
    sourceType: "INFLUENCER" | "CAMPAIGN";
    scopeType: "CATALOG" | "VEHICLE";
    vehicleId: string;
    sourceReference: string;
};

const MAX_BANNER_IMAGES = 6;
const DEFAULT_PUBLIC_CATALOG_SETTINGS: PublicCatalogSettings = {
    bannerMode: "VEHICLES",
    customImageUrls: [],
};

function emptyForm(): LinkFormState {
    return {
        name: "",
        linkKind: "PUBLIC",
        sourceType: "INFLUENCER",
        scopeType: "CATALOG",
        vehicleId: "",
        sourceReference: "",
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

function linkKindLabel(value: string) {
    if (value === "PUBLIC") return "Público";
    return "Campanha";
}

function scopeLabel(value: string) {
    if (value === "VEHICLE") return "Veículo específico";
    return "Estoque completo";
}

function isCustomBannerMode(value: PublicCatalogSettings["bannerMode"]) {
    return value === "CUSTOM_IMAGES";
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
    const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
    const [catalogSettings, setCatalogSettings] = useState<PublicCatalogSettings>(DEFAULT_PUBLIC_CATALOG_SETTINGS);
    const [savedCatalogSettings, setSavedCatalogSettings] = useState<PublicCatalogSettings>(DEFAULT_PUBLIC_CATALOG_SETTINGS);
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
            const [linksResponse, vehiclesResponse, meResponse, settingsResponse] = await Promise.all([
                fetch("/api/ioauto/public-links", { cache: "no-store" }),
                fetch("/api/ioauto/vehicles", { cache: "no-store" }),
                fetch("/api/auth/me", { cache: "no-store" }),
                fetch("/api/ioauto/public-catalog-settings", { cache: "no-store" }),
            ]);

            if (!linksResponse.ok) throw new Error("Falha ao carregar os links públicos.");
            if (!vehiclesResponse.ok) throw new Error("Falha ao carregar os veículos.");

            if (!settingsResponse.ok) throw new Error("Falha ao carregar as configurações do banner.");

            const [linksPayload, vehiclesPayload, mePayload, settingsPayload] = await Promise.all([
                linksResponse.json() as Promise<PublicLinkRecord[]>,
                vehiclesResponse.json() as Promise<VehicleRecord[]>,
                meResponse.ok ? meResponse.json() as Promise<MePayload> : Promise.resolve(null),
                settingsResponse.json() as Promise<PublicCatalogSettings>,
            ]);

            setLinks(linksPayload);
            setVehicles(vehiclesPayload);
            setCompanyName(mePayload?.companyName?.trim() || "Catálogo");
            setCatalogSettings(settingsPayload);
            setSavedCatalogSettings(settingsPayload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar os links.");
        } finally {
            setLoading(false);
        }
    }

    function updateForm<K extends keyof LinkFormState>(key: K, value: LinkFormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function updateCatalogSettings(nextValue: Partial<PublicCatalogSettings>) {
        setCatalogSettings((current) => ({ ...current, ...nextValue }));
    }

    function openCreateModal() {
        setForm({
            name: "",
            linkKind: "PUBLIC",
            sourceType: "INFLUENCER",
            scopeType: "CATALOG",
            vehicleId: "",
            sourceReference: "",
        });
        setError(null);
        setIsCreateOpen(true);
    }

    function closeCreateModal() {
        setIsCreateOpen(false);
        setForm(emptyForm());
    }

    async function handleCreateLink(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError(null);

        const payload = {
            name: form.name,
            linkKind: form.linkKind,
            scopeType: form.scopeType,
            vehicleId: form.scopeType === "VEHICLE" ? form.vehicleId || null : null,
            sourceType: form.linkKind === "CAMPAIGN" ? form.sourceType : null,
            sourceReference: form.linkKind === "CAMPAIGN" ? slugifyReference(form.sourceReference) : null,
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

    async function handleCatalogImagesSelected(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";

        if (!files.length) return;

        const remainingSlots = Math.max(0, MAX_BANNER_IMAGES - catalogSettings.customImageUrls.length);
        if (remainingSlots === 0) {
            setError(`Você pode manter no máximo ${MAX_BANNER_IMAGES} imagens no banner.`);
            return;
        }

        setProcessingImages(true);
        setError(null);

        try {
            const preparedImages = await Promise.all(files.slice(0, remainingSlots).map((file) => compressBannerImage(file)));
            setCatalogSettings((current) => ({
                bannerMode: "CUSTOM_IMAGES",
                customImageUrls: [...current.customImageUrls, ...preparedImages].slice(0, MAX_BANNER_IMAGES),
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
            customImageUrls: current.customImageUrls.filter((_, currentIndex) => currentIndex !== index),
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

        const payload = (await response.json()) as PublicCatalogSettings;
        setCatalogSettings(payload);
        setSavedCatalogSettings(payload);
        setSavingCatalogSettings(false);
    }

    return (
        <>
            <div className="grid gap-6">
                <header>
                    <h1 className="font-display text-[1.75rem] font-bold leading-tight text-io-dark">Gerenciamento de links</h1>
                    <p className="mt-1.5 text-sm text-black/55">Centralize os links públicos do estoque e as campanhas com influenciadores ou divulgadores em um único lugar.</p>
                </header>

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
                    <section className="flex min-h-[280px] items-center justify-center rounded-[34px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-3 text-black/45">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Carregando os links...</span>
                        </div>
                    </section>
                ) : (
                    <div className="grid gap-6">
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

                                        {catalogSettings.customImageUrls.length ? (
                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                {catalogSettings.customImageUrls.map((imageUrl, index) => (
                                                    <article key={`${index}-${imageUrl.slice(0, 24)}`} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
                                                        <div className="aspect-[16/9] bg-black/5">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={imageUrl} alt={`Banner ${index + 1}`} className="h-full w-full object-cover" />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                                                            <span className="text-sm font-medium text-black/60">Imagem {index + 1}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCatalogImage(index)}
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                                                aria-label={`Remover imagem ${index + 1}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
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
                                            <span className="font-bold text-io-dark">{catalogSettings.customImageUrls.length}</span>
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

                        <LinkSection
                            title="Links públicos do estoque"
                            description="Links limpos para divulgar a vitrine pública sem origem de campanha."
                            icon={<Globe2 className="h-4 w-4" />}
                            links={publicLinks}
                            copiedLinkId={copiedLinkId}
                            onCopyLink={handleCopyLink}
                            onDeleteLink={handleDeleteLink}
                        />

                        <LinkSection
                            title="Links de influenciadores e campanhas"
                            description="Links rastreáveis para medir qual parceiro ou campanha trouxe mais interações."
                            icon={<Megaphone className="h-4 w-4" />}
                            links={campaignLinks}
                            copiedLinkId={copiedLinkId}
                            onCopyLink={handleCopyLink}
                            onDeleteLink={handleDeleteLink}
                        />
                    </div>
                )}
            </div>

            {isCreateOpen ? (
                <div className="fixed inset-0 z-50 bg-black/55 px-4 py-6">
                    <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
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

                                <div className="rounded-[28px] bg-black/5 px-5 py-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/38">Preview do link</p>
                                    <p className="mt-3 break-all text-sm leading-6 text-black/68">{origin}{previewPath}</p>
                                </div>

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
                                        disabled={saving || (form.linkKind === "CAMPAIGN" && form.scopeType === "VEHICLE" && !form.vehicleId)}
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
    onDeleteLink,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    links: PublicLinkRecord[];
    copiedLinkId: string | null;
    onCopyLink: (link: PublicLinkRecord) => void;
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
                            className={`grid gap-4 bg-white px-4 py-4 lg:grid-cols-[1.3fr_0.95fr_0.7fr_0.7fr_0.7fr_0.95fr_auto] lg:items-center ${index === 0 ? "" : "border-t border-black/8"
                                }`}
                        >
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-io-dark">{link.name}</p>
                                <p className="mt-1 text-sm text-black/56">
                                    {linkKindLabel(link.linkKind)} • {scopeLabel(link.scopeType)}
                                    {link.vehicleTitle ? ` • ${link.vehicleTitle}` : ""}
                                </p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Origem</p>
                                <p className="mt-1 text-sm text-black/62">
                                    {link.sourceReference || (link.linkKind === "PUBLIC" ? "Rastreamento automático" : "Sem rastreio")}
                                </p>
                            </div>

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
