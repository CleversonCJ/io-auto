"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import {
    CalendarDays,
    CarFront,
    Gauge,
    Globe2,
    Link2,
    LoaderCircle,
    PencilLine,
    Plus,
    Save,
    Search,
    X,
} from "lucide-react";
import { MeliVehiclePanel, emptyMeliVehicleForm, type MeliVehicleFormState } from "@/modules/ioauto/components/MeliVehiclePanel";
import { OlxVehiclePanel, emptyOlxVehicleForm, type OlxVehicleFormState } from "@/modules/ioauto/components/OlxVehiclePanel";
import type { IntegrationRecord, MeliVehicleMapping, OlxVehicleMapping, VehiclePublication, VehicleRecord } from "@/modules/ioauto/types";
import { formatDateTime, formatMoney, platformLabel, statusLabel } from "@/modules/ioauto/formatters";

type VehicleFormState = {
    id?: string;
    title: string;
    brand: string;
    year: string;
    model: string;
    engine: string;
    mileage: string;
    priceCents: string;
    downPaymentCents: string;
    installmentCount: string;
    installmentValueCents: string;
    description: string;
    imageUrls: string[];
    featured: boolean;
    status: string;
    targetIntegrations: string[];
    meli: MeliVehicleFormState;
    olx: OlxVehicleFormState;
};

function emptyForm(): VehicleFormState {
    return {
        title: "",
        brand: "",
        year: "",
        model: "",
        engine: "",
        mileage: "",
        priceCents: "",
        downPaymentCents: "",
        installmentCount: "",
        installmentValueCents: "",
        description: "",
        imageUrls: [],
        featured: false,
        status: "DRAFT",
        targetIntegrations: [],
        meli: emptyMeliVehicleForm(),
        olx: emptyOlxVehicleForm(),
    };
}

function uniqueImageList(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function vehicleToForm(vehicle: VehicleRecord): VehicleFormState {
    return {
        id: vehicle.id,
        title: vehicle.title,
        brand: vehicle.brand,
        year: vehicle.year ? String(vehicle.year) : vehicle.modelYear ? String(vehicle.modelYear) : vehicle.manufactureYear ? String(vehicle.manufactureYear) : "",
        model: vehicle.model,
        engine: vehicle.engine ?? vehicle.version ?? "",
        mileage: vehicle.mileage ? String(vehicle.mileage) : "",
        priceCents: vehicle.priceCents ? String(vehicle.priceCents) : "",
        downPaymentCents: vehicle.financing.downPaymentCents ? String(vehicle.financing.downPaymentCents) : "",
        installmentCount: vehicle.financing.installmentCount ? String(vehicle.financing.installmentCount) : "",
        installmentValueCents: vehicle.financing.installmentValueCents ? String(vehicle.financing.installmentValueCents) : "",
        description: vehicle.description ?? "",
        imageUrls: uniqueImageList([vehicle.coverImageUrl, ...vehicle.gallery]),
        featured: vehicle.featured,
        status: vehicle.status,
        targetIntegrations: vehicle.publications.map((publication) => publication.providerKey),
        meli: emptyMeliVehicleForm(),
        olx: emptyOlxVehicleForm(),
    };
}

function formatMileage(value?: number | null) {
    if (value == null || Number.isNaN(Number(value))) return "Quilometragem nao informada";
    return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleYears(vehicle: VehicleRecord) {
    if (vehicle.year) return String(vehicle.year);
    if (vehicle.modelYear && vehicle.manufactureYear && vehicle.modelYear === vehicle.manufactureYear) return String(vehicle.modelYear);
    if (vehicle.modelYear && vehicle.manufactureYear) return `${vehicle.manufactureYear}/${vehicle.modelYear}`;
    if (vehicle.modelYear) return String(vehicle.modelYear);
    if (vehicle.manufactureYear) return String(vehicle.manufactureYear);
    return "Ano nao informado";
}

function buildVehicleSubtitle(vehicle: VehicleRecord) {
    const parts = [vehicle.engine, vehicle.version].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Cadastro pronto para publicacao";
}

function getVehicleImage(vehicle: VehicleRecord) {
    return uniqueImageList([vehicle.coverImageUrl, ...vehicle.gallery])[0] ?? null;
}

function formatCurrencyInput(raw: string) {
    if (!raw) return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(raw) / 100);
}

function normalizeCurrencyDigits(value: string) {
    return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function formatFinancingSummary(vehicle: VehicleRecord) {
    const parts: string[] = [];
    if (vehicle.financing.downPaymentCents != null) parts.push(`Entrada ${formatMoney(vehicle.financing.downPaymentCents)}`);
    if (vehicle.financing.installmentCount != null && vehicle.financing.installmentValueCents != null) {
        parts.push(`${vehicle.financing.installmentCount}x de ${formatMoney(vehicle.financing.installmentValueCents)}`);
    }
    return parts.length ? parts.join(" • ") : "Financiamento nao informado";
}

function getPublicationBadgeConfig(publication: VehiclePublication) {
    const normalized = publication.providerKey.trim().toUpperCase();
    if (normalized === "WEBMOTORS") return { shortLabel: "WM", label: "Webmotors", className: "border-transparent bg-[#e52629] text-white" };
    if (normalized === "ICARROS") return { shortLabel: "IC", label: "iCarros", className: "border-transparent bg-[#171717] text-white" };
    if (normalized === "OLX" || normalized === "OLX_AUTOS") return { shortLabel: "OLX", label: "OLX", className: "border-transparent bg-[#f57c00] text-white" };
    if (normalized === "MERCADOLIVRE" || normalized === "MERCADO_LIVRE") {
        return { shortLabel: "ML", label: "Mercado Livre", className: "border-[#d5c228] bg-[#ffe84e] text-[#2f2a05]" };
    }
    return {
        shortLabel: platformLabel(publication.providerName || publication.providerKey).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase(),
        label: platformLabel(publication.providerName || publication.providerKey),
        className: "border-black/10 bg-white text-black/70",
    };
}

export function InventoryStudio() {
    const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
    const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [form, setForm] = useState<VehicleFormState>(emptyForm());
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [isImageDragActive, setIsImageDragActive] = useState(false);
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedId) ?? null, [selectedId, vehicles]);
    const connectedIntegrations = useMemo(
        () => integrations.filter((integration) => integration.status === "CONNECTED" || integration.status === "ACTIVE"),
        [integrations]
    );
    const publicationIntegrations = useMemo(() => integrations.filter((integration) => integration.supportsPublication), [integrations]);
    const visibleVehicles = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return vehicles;
        return vehicles.filter((vehicle) =>
            [
                vehicle.title,
                vehicle.brand,
                vehicle.model,
                vehicle.engine,
                vehicle.version,
                vehicle.year ? String(vehicle.year) : "",
                vehicle.publications.map((publication) => publication.providerName).join(" "),
                vehicle.publications.map((publication) => publication.providerKey).join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
        );
    }, [search, vehicles]);

    useEffect(() => {
        void loadInventory();
    }, []);

    useEffect(() => {
        if (!selectedVehicle) {
            setForm(emptyForm());
            return;
        }
        setForm(vehicleToForm(selectedVehicle));
    }, [selectedVehicle]);

    function updateField<K extends keyof VehicleFormState>(key: K, value: VehicleFormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function hydrateOlxMapping(mapping: OlxVehicleMapping) {
        setForm((current) => ({
            ...current,
            olx: {
                brandId: mapping.brandId ?? "",
                modelId: mapping.modelId ?? "",
                versionId: mapping.versionId ?? "",
                fuelCode: mapping.fuelCode ?? "",
                gearboxCode: mapping.gearboxCode ?? "",
                doorsCode: mapping.doorsCode ?? "",
                colorCode: mapping.colorCode ?? "",
                featureCodes: mapping.featureCodes ?? [],
                plate: mapping.plate ?? "",
                phone: mapping.phone ?? "",
                zipcode: mapping.zipcode ?? "",
                ad: mapping.ad ?? null,
            },
        }));
    }

    function hydrateMeliMapping(mapping: MeliVehicleMapping) {
        setForm((current) => ({
            ...current,
            meli: {
                categoryId: mapping.categoryId ?? "",
                listingTypeId: mapping.listingTypeId ?? "",
                condition: mapping.condition ?? "used",
                sellerSku: mapping.sellerSku ?? "",
                title: mapping.title ?? "",
                description: mapping.description ?? "",
                priceCents: mapping.priceCents != null ? String(mapping.priceCents) : "",
                attributes: mapping.attributes ?? [],
                ad: mapping.ad ?? null,
            },
        }));
    }

    function updateOlxField(partial: Partial<OlxVehicleFormState>) {
        setForm((current) => ({
            ...current,
            olx: {
                ...current.olx,
                ...partial,
            },
        }));
    }

    function updateMeliField(partial: Partial<MeliVehicleFormState>) {
        setForm((current) => ({
            ...current,
            meli: {
                ...current.meli,
                ...partial,
            },
        }));
    }

    async function saveOlxMapping(vehicleId: string) {
        const response = await fetch(`/api/integrations/olx/vehicles/${vehicleId}/mapping`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                brandId: form.olx.brandId || null,
                modelId: form.olx.modelId || null,
                versionId: form.olx.versionId || null,
                fuelCode: form.olx.fuelCode || null,
                gearboxCode: form.olx.gearboxCode || null,
                doorsCode: form.olx.doorsCode || null,
                colorCode: form.olx.colorCode || null,
                featureCodes: form.olx.featureCodes,
                plate: form.olx.plate || null,
                phone: form.olx.phone || null,
                zipcode: form.olx.zipcode || null,
            }),
        });
        const payload = (await response.json().catch(() => null)) as OlxVehicleMapping | { message?: string } | null;
        if (!response.ok) {
            throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao salvar a configuracao OLX do veiculo.");
        }
        hydrateOlxMapping(payload as OlxVehicleMapping);
    }

    async function saveMeliMapping(vehicleId: string) {
        const response = await fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/mapping`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                categoryId: form.meli.categoryId || null,
                listingTypeId: form.meli.listingTypeId || null,
                condition: form.meli.condition || null,
                sellerSku: form.meli.sellerSku || null,
                title: form.meli.title || null,
                description: form.meli.description || null,
                priceCents: form.meli.priceCents ? Number(form.meli.priceCents) : null,
                attributes: form.meli.attributes,
            }),
        });
        const payload = (await response.json().catch(() => null)) as MeliVehicleMapping | { message?: string } | null;
        if (!response.ok) {
            throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao salvar a configuracao Mercado Livre do veiculo.");
        }
        hydrateMeliMapping(payload as MeliVehicleMapping);
    }

    async function loadInventory() {
        setLoading(true);
        try {
            const [vehiclesResponse, integrationsResponse] = await Promise.all([
                fetch("/api/ioauto/vehicles", { cache: "no-store" }),
                fetch("/api/ioauto/integrations", { cache: "no-store" }),
            ]);

            if (!vehiclesResponse.ok) throw new Error("Falha ao listar os veiculos.");
            if (!integrationsResponse.ok) throw new Error("Falha ao listar as integracoes.");

            const [vehiclePayload, integrationPayload] = await Promise.all([
                vehiclesResponse.json() as Promise<VehicleRecord[]>,
                integrationsResponse.json() as Promise<IntegrationRecord[]>,
            ]);

            setVehicles(vehiclePayload);
            setIntegrations(integrationPayload);
            setSelectedId((current) => (current && vehiclePayload.some((vehicle) => vehicle.id === current) ? current : vehiclePayload[0]?.id ?? null));
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar o estoque.");
        } finally {
            setLoading(false);
        }
    }

    function openCreateEditor() {
        setSelectedId(null);
        setForm(emptyForm());
        setError(null);
        setUploadingImages(false);
        setIsImageDragActive(false);
        setIsEditorOpen(true);
    }

    function openEditEditor(vehicle: VehicleRecord) {
        setSelectedId(vehicle.id);
        setForm(vehicleToForm(vehicle));
        setError(null);
        setUploadingImages(false);
        setIsImageDragActive(false);
        setIsEditorOpen(true);
    }

    function closeEditor() {
        setIsEditorOpen(false);
        setError(null);
        setUploadingImages(false);
        setIsImageDragActive(false);
        setForm(selectedVehicle ? vehicleToForm(selectedVehicle) : emptyForm());
    }

    function openImagePicker() {
        imageInputRef.current?.click();
    }

    async function uploadSelectedImages(files: File[]) {
        if (!files.length) return;

        setUploadingImages(true);
        setError(null);
        try {
            const body = new FormData();
            files.forEach((file) => body.append("files", file));

            const response = await fetch("/api/ioauto/vehicle-images", {
                method: "POST",
                body,
            });
            const payload = (await response.json().catch(() => null)) as { files?: Array<{ url: string }>; message?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.message ?? "Nao foi possivel enviar as imagens.");
            }

            setForm((current) => ({
                ...current,
                imageUrls: uniqueImageList([...current.imageUrls, ...(payload?.files?.map((item) => item.url) ?? [])]),
            }));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Nao foi possivel enviar as imagens.");
        } finally {
            setUploadingImages(false);
            setIsImageDragActive(false);
        }
    }

    function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        void uploadSelectedImages(files);
    }

    function handleImageDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setIsImageDragActive(true);
    }

    function handleImageDragLeave(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setIsImageDragActive(false);
    }

    function handleImageDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/"));
        void uploadSelectedImages(files);
    }

    function promoteImage(url: string) {
        setForm((current) => ({
            ...current,
            imageUrls: [url, ...current.imageUrls.filter((item) => item !== url)],
        }));
    }

    function removeImage(url: string) {
        setForm((current) => ({
            ...current,
            imageUrls: current.imageUrls.filter((item) => item !== url),
        }));
    }

    async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const year = form.year ? Number(form.year) : null;
            const imageUrls = uniqueImageList(form.imageUrls);
            const payload = {
                title: form.title,
                brand: form.brand,
                model: form.model,
                engine: form.engine,
                version: form.engine,
                year,
                modelYear: year,
                manufactureYear: year,
                mileage: form.mileage ? Number(form.mileage) : null,
                priceCents: form.priceCents ? Number(form.priceCents) : null,
                description: form.description,
                coverImageUrl: imageUrls[0] ?? null,
                gallery: imageUrls,
                optionals: [],
                featured: form.featured,
                status: form.status,
                financing: {
                    downPaymentCents: form.downPaymentCents ? Number(form.downPaymentCents) : null,
                    installmentCount: form.installmentCount ? Number(form.installmentCount) : null,
                    installmentValueCents: form.installmentValueCents ? Number(form.installmentValueCents) : null,
                },
                targetIntegrations: form.targetIntegrations,
            };

            const response = await fetch(form.id ? `/api/ioauto/vehicles/${form.id}` : "/api/ioauto/vehicles", {
                method: form.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const responseBody = (await response.json().catch(() => null)) as VehicleRecord | { message?: string } | null;

            if (!response.ok) {
                throw new Error((responseBody as { message?: string } | null)?.message ?? "Falha ao salvar o veiculo.");
            }

            const savedVehicle = responseBody as VehicleRecord;
            await Promise.all([saveOlxMapping(savedVehicle.id), saveMeliMapping(savedVehicle.id)]);
            await loadInventory();
            setSelectedId(savedVehicle.id);
            setIsEditorOpen(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao salvar o veiculo.");
        } finally {
            setSaving(false);
        }
    }

    const publishedVehicles = vehicles.filter((vehicle) => vehicle.publications.length > 0).length;

    return (
        <>
            <div className="grid gap-6">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Módulo Estoque</p>
                    <h1 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-io-dark">Estoque de veículos</h1>
                    <p className="mt-1.5 text-sm text-black/55">Gerencie todos os veículos cadastrados, publique em plataformas e acompanhe o estoque em tempo real.</p>
                </header>

                <section className="overflow-hidden rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-6">
                    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
                        <label className="flex h-14 flex-1 items-center gap-3 rounded-full border border-black/10 bg-[#fafafa] px-5">
                            <Search className="h-5 w-5 text-black/40" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Pesquisar por marca, modelo, motor ou plataforma"
                                className="w-full bg-transparent text-sm text-io-dark outline-none placeholder:text-black/35"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={openCreateEditor}
                            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-io-purple px-5 text-sm font-semibold text-white transition hover:bg-black/85"
                        >
                            <Plus className="h-4 w-4" />
                            Novo veículo
                        </button>
                        <Link
                            href="/protected/links-publicos"
                            className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-5 text-sm font-semibold text-black/72 transition hover:border-black/20 hover:text-io-dark"
                        >
                            <Link2 className="h-4 w-4" />
                            Gerenciar links
                        </Link>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <MetricCard label="Veículos cadastrados" value={String(vehicles.length)} detail={`${visibleVehicles.length} visíveis na busca`} />
                        <MetricCard label="Com publicação ativa" value={String(publishedVehicles)} detail={`${connectedIntegrations.length} plataformas conectadas`} />
                    </div>
                </section>

                {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

                {loading ? (
                    <section className="flex min-h-[280px] items-center justify-center rounded-[34px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-3 text-black/45">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Carregando o estoque...</span>
                        </div>
                    </section>
                ) : visibleVehicles.length ? (
                    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleVehicles.map((vehicle) => (
                            <InventoryVehicleCard key={vehicle.id} vehicle={vehicle} onEdit={() => openEditEditor(vehicle)} />
                        ))}
                    </section>
                ) : (
                    <section className="rounded-[34px] border border-dashed border-black/12 bg-white px-6 py-12 text-center shadow-[0_18px_45px_rgba(0,0,0,0.04)]">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/[0.04]">
                            <Search className="h-6 w-6 text-black/45" />
                        </div>
                        <h2 className="mt-4 font-display text-2xl font-bold text-io-dark">Nenhum veiculo encontrado</h2>
                        <p className="mt-2 text-sm text-black/52">Ajuste a pesquisa ou cadastre um novo veiculo para preencher essa vitrine.</p>
                    </section>
                )}
            </div>

            {isEditorOpen ? (
                <div className="fixed inset-0 z-50 bg-black/55 px-4 py-6">
                    <div className="mx-auto flex h-full max-w-6xl items-start justify-center">
                        <div className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Cadastro do veiculo</p>
                                    <h2 className="mt-1 font-display text-2xl font-bold text-io-dark">{form.id ? "Editar veiculo" : "Novo veiculo"}</h2>
                                    <p className="mt-1 text-sm text-black/55">Nome, motor, financiamento, especificacoes e galeria de imagens no mesmo fluxo.</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeEditor}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/65 transition hover:border-black/20 hover:text-io-dark"
                                    aria-label="Fechar editor"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveVehicle} className="flex min-h-0 flex-1 flex-col">
                                {error ? <p className="mx-6 mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 md:mx-8">{error}</p> : null}

                                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
                                    <div className="grid gap-6">
                                        <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                                <Field label="Nome" value={form.title} onChange={(value) => updateField("title", value)} required />
                                                <Field label="Marca" value={form.brand} onChange={(value) => updateField("brand", value)} required />
                                                <Field label="Ano" value={form.year} onChange={(value) => updateField("year", value.replace(/\D/g, "").slice(0, 4))} required />
                                                <Field label="Modelo" value={form.model} onChange={(value) => updateField("model", value)} required />
                                                <Field label="Motor" value={form.engine} onChange={(value) => updateField("engine", value)} />
                                                <Field label="Quilometragem (KM)" value={form.mileage} onChange={(value) => updateField("mileage", value.replace(/\D/g, ""))} />
                                                <MoneyField label="Preco (R$)" value={form.priceCents} onChange={(value) => updateField("priceCents", value)} required />
                                            </div>
                                        </section>

                                        <section className="rounded-[30px] border border-[#c8d8ff] bg-white p-5 shadow-[0_10px_30px_rgba(49,89,184,0.08)]">
                                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#2b57d9]">Condicoes de financiamento</p>
                                                    <p className="mt-1 text-sm text-[#6d8de6]">Opcional — preencha se o veiculo tiver parcelas disponiveis.</p>
                                                </div>
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2b57d9] text-sm font-bold text-white">R$</span>
                                            </div>

                                            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
                                                <MoneyField label="Entrada (R$)" value={form.downPaymentCents} onChange={(value) => updateField("downPaymentCents", value)} />

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#2b57d9]">Parcelamento</span>
                                                    <div className="flex flex-col gap-3 rounded-[22px] border border-[#bcd0ff] bg-white px-4 py-4 md:flex-row md:items-center">
                                                        <input
                                                            value={form.installmentCount}
                                                            onChange={(event) => updateField("installmentCount", event.target.value.replace(/\D/g, "").slice(0, 3))}
                                                            inputMode="numeric"
                                                            placeholder="12"
                                                            className="h-12 w-full rounded-2xl border border-black/10 bg-[#f7f9ff] px-4 text-center text-lg font-semibold text-io-dark outline-none transition focus:border-[#2b57d9] focus:bg-white md:max-w-[120px]"
                                                        />
                                                        <span className="text-sm font-semibold text-black/35">x</span>
                                                        <input
                                                            value={formatCurrencyInput(form.installmentValueCents)}
                                                            onChange={(event) => updateField("installmentValueCents", normalizeCurrencyDigits(event.target.value))}
                                                            inputMode="numeric"
                                                            placeholder="R$ 0,00"
                                                            className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 bg-[#f7f9ff] px-4 text-lg font-semibold text-io-dark outline-none transition focus:border-[#2b57d9] focus:bg-white"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-[#6d8de6]">Qtd. parcelas × valor de cada parcela</span>
                                                </label>
                                            </div>
                                        </section>

                                        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                                            <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                                <TextArea label="Especificacoes" value={form.description} onChange={(value) => updateField("description", value)} />
                                            </section>

                                            <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-io-dark">Imagens do veiculo</p>
                                                        <p className="mt-1 text-sm text-black/50">Arraste e solte ou selecione imagens no computador.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={openImagePicker}
                                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-black/72 transition hover:border-black/20 hover:text-io-dark"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        Selecionar
                                                    </button>
                                                </div>

                                                <div
                                                    onDragOver={handleImageDragOver}
                                                    onDragLeave={handleImageDragLeave}
                                                    onDrop={handleImageDrop}
                                                    className={`mt-4 rounded-[26px] border border-dashed px-5 py-8 text-center transition ${isImageDragActive ? "border-[#2b57d9] bg-[#eef4ff]" : "border-black/14 bg-white"}`}
                                                >
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                                                        <CarFront className="h-6 w-6 text-black/55" />
                                                    </div>
                                                    <p className="mt-4 text-sm font-semibold text-io-dark">{uploadingImages ? "Enviando imagens..." : "Solte as imagens aqui"}</p>
                                                    <p className="mt-2 text-sm text-black/52">PNG, JPG, WEBP ou GIF. A primeira imagem vira a capa.</p>
                                                </div>

                                                <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageInputChange} className="hidden" />

                                                {form.imageUrls.length ? (
                                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                        {form.imageUrls.map((imageUrl, index) => (
                                                            <div key={imageUrl} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
                                                                <img src={imageUrl} alt={`Imagem ${index + 1}`} className="h-40 w-full object-cover" />
                                                                <div className="flex items-center justify-between gap-2 px-3 py-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => promoteImage(imageUrl)}
                                                                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${index === 0 ? "bg-black text-white" : "bg-white text-black/70 hover:text-io-dark"}`}
                                                                    >
                                                                        {index === 0 ? "Capa" : "Definir capa"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeImage(imageUrl)}
                                                                        className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                                                                    >
                                                                        Remover
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </section>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                                            <section className="rounded-[30px] border border-black/10 bg-black p-5 text-white">
                                                <div className="mt-4 grid gap-3">
                                                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                                                        <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} className="h-4 w-4" />
                                                        Destacar na vitrine
                                                    </label>

                                                    <label className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                                                        <span>Status do veiculo</span>
                                                        <select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none">
                                                            <option value="DRAFT" className="text-io-dark">Rascunho</option>
                                                            <option value="READY" className="text-io-dark">Pronto</option>
                                                            <option value="PUBLISHED" className="text-io-dark">Publicado</option>
                                                            <option value="SOLD" className="text-io-dark">Vendido</option>
                                                            <option value="ARCHIVED" className="text-io-dark">Arquivado</option>
                                                        </select>
                                                    </label>
                                                </div>
                                            </section>

                                            <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                                <p className="text-sm font-semibold text-io-dark">Distribuicao</p>
                                                <div className="mt-4 grid gap-3">
                                                    {publicationIntegrations.length ? (
                                                        publicationIntegrations.map((integration) => {
                                                            const selected = form.targetIntegrations.includes(integration.providerKey);
                                                            return (
                                                                <label key={integration.providerKey} className={`rounded-2xl border px-4 py-3 text-sm transition ${selected ? "border-white bg-black text-white" : "border-black/10 bg-[#f7f7f7] text-black/70 hover:border-black/20"}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selected}
                                                                            onChange={(event) => {
                                                                                const next = event.target.checked ? [...form.targetIntegrations, integration.providerKey] : form.targetIntegrations.filter((item) => item !== integration.providerKey);
                                                                                updateField("targetIntegrations", Array.from(new Set(next)));
                                                                            }}
                                                                            className="h-4 w-4"
                                                                        />
                                                                        <div>
                                                                            <p className="font-medium">{integration.displayName}</p>
                                                                            <p className={`text-[11px] ${selected ? "text-white/55" : "text-black/48"}`}>{statusLabel(integration.status)}</p>
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-4 text-sm text-black/55">Nenhuma integracao de publicacao disponivel no momento.</p>
                                                    )}
                                                </div>
                                            </section>
                                        </div>

                                        <OlxVehiclePanel
                                            vehicleId={form.id}
                                            value={form.olx}
                                            onHydrate={hydrateOlxMapping}
                                            onChange={updateOlxField}
                                            mainSummary={{
                                                year: form.year,
                                                mileage: form.mileage,
                                                priceCents: form.priceCents,
                                                description: form.description,
                                                imageCount: form.imageUrls.length,
                                            }}
                                        />

                                        <MeliVehiclePanel
                                            vehicleId={form.id}
                                            value={form.meli}
                                            onHydrate={hydrateMeliMapping}
                                            onChange={updateMeliField}
                                            mainSummary={{
                                                brand: form.brand,
                                                model: form.model,
                                                version: form.engine,
                                                year: form.year,
                                                mileage: form.mileage,
                                                priceCents: form.priceCents,
                                                description: form.description,
                                                imageCount: form.imageUrls.length,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-6 py-5 md:px-8">
                                    <div className="text-xs text-black/45">{connectedIntegrations.length} integracoes conectadas prontas para sincronizacao.</div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={closeEditor}
                                            className="inline-flex h-12 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-black/68 transition hover:border-black/20 hover:text-io-dark"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-io-purple px-5 text-sm font-semibold text-white transition hover:bg-[#212121] disabled:cursor-not-allowed disabled:bg-black/30"
                                        >
                                            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Salvar cadastro
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function InventoryVehicleCard({ vehicle, onEdit }: { vehicle: VehicleRecord; onEdit: () => void }) {
    const imageUrl = getVehicleImage(vehicle);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-black/10 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
            <div className="relative overflow-hidden rounded-[24px] bg-[#f1eee8]">
                {imageUrl ? (
                    <img src={imageUrl} alt={vehicle.title} className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                    <div className="flex h-60 w-full items-center justify-center bg-white text-white">
                        <div className="text-center">
                            <CarFront className="mx-auto h-10 w-10 text-white/75" />
                            <p className="mt-3 text-sm text-white/65">Sem imagem principal</p>
                        </div>
                    </div>
                )}

                <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
                    {vehicle.publications.map((publication) => (
                        <PublicationBadge key={publication.id} publication={publication} size="sm" />
                    ))}
                </div>
            </div>

            <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="mt-2 font-display text-[1.65rem] font-bold uppercase leading-[1.12] tracking-tight text-io-dark">{vehicle.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-black/58">{buildVehicleSubtitle(vehicle)}</p>
                    </div>
                    <span className="rounded-full bg-black/[0.04] px-3 py-2 text-[11px] font-semibold text-black/55">{statusLabel(vehicle.status)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-black/56">
                    <MetaItem icon={<CalendarDays className="h-4 w-4" />} text={formatVehicleYears(vehicle)} />
                    <MetaItem icon={<Gauge className="h-4 w-4" />} text={formatMileage(vehicle.mileage)} />
                </div>



                <div className="mt-auto flex flex-col gap-5 pt-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/36">Preço</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight text-io-dark">{formatMoney(vehicle.priceCents)}</p>
                        <p className="mt-1 text-[10px] text-black/35 font-medium">Atualizado em {formatDateTime(vehicle.updatedAt)}</p>
                    </div>

                    <button type="button" onClick={onEdit} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white transition hover:bg-black/85 shadow-sm">
                        <PencilLine className="h-4 w-4" />
                        Editar veículo
                    </button>
                </div>
            </div>
        </article>
    );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="rounded-[28px] border border-black/8 bg-white px-5 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">{label}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-3xl font-bold tracking-tight text-io-dark">{value}</p>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#faf8f4] text-black/45">
                    <Globe2 className="h-5 w-5" />
                </div>
            </div>
            <p className="mt-2 text-sm text-black/52">{detail}</p>
        </div>
    );
}

function PublicationBadge({ publication, size = "md" }: { publication: VehiclePublication; size?: "sm" | "md" }) {
    const config = getPublicationBadgeConfig(publication);
    const sizeClassName = size === "sm" ? "h-8 min-w-8 px-2.5 text-[10px]" : "h-10 min-w-10 px-3 text-[11px]";
    return (
        <span
            title={config.label}
            className={`inline-flex items-center justify-center rounded-full border font-semibold ${config.className} ${sizeClassName}`}
        >
            {config.shortLabel}
        </span>
    );
}

function MetaItem({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
            <span className="text-black/42">{icon}</span>
            <span>{text}</span>
        </span>
    );
}

function Field({
    label,
    value,
    onChange,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function MoneyField({
    label,
    value,
    onChange,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={formatCurrencyInput(value)}
                onChange={(event) => onChange(normalizeCurrencyDigits(event.target.value))}
                inputMode="numeric"
                placeholder="R$ 0,00"
                required={required}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm font-semibold text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={8}
                className="min-h-56 rounded-[24px] border border-black/10 bg-[#f7f7f7] px-4 py-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}
