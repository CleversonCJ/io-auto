"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import {
    CalendarDays,
    CarFront,
    CheckCircle2,
    Gauge,
    Globe2,
    GripVertical,
    Link2,
    LoaderCircle,
    PencilLine,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { emptyMeliVehicleForm, type MeliVehicleFormState } from "@/modules/ioauto/components/MeliVehiclePanel";
import { OlxVehiclePanel, emptyOlxVehicleForm, type OlxVehicleFormState } from "@/modules/ioauto/components/OlxVehiclePanel";
import type {
    BillingSnapshot,
    ConversationRecord,
    InventoryVehicleSummary,
    IntegrationRecord,
    MeliCategoryRecord,
    MeliCategorySuggestion,
    MeliListingTypeRecord,
    MeliVehicleMapping,
    OlxCatalogOption,
    OlxVehicleMapping,
    VehiclePublication,
    VehicleRecord,
} from "@/modules/ioauto/types";
import { formatDateTime, formatMoney, formatShortDate, platformLabel, statusLabel } from "@/modules/ioauto/formatters";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";
import {
    buildSaleClosingFinancialPayload,
    computeSaleClosingFinancialPreview,
    createDefaultSaleClosingFinancialState,
    validateSaleClosingFinancialState,
    type SaleClosingFinancialFormState,
} from "@/modules/ioauto/saleClosingFinancial";

type VehicleFormState = {
    id?: string;
    stockNumber: string;
    title: string;
    brand: string;
    model: string;
    version: string;
    engine: string;
    year: string;
    mileage: string;
    priceCents: string;
    tradeInPriceCents: string;
    transmission: string;
    fuelType: string;
    bodyType: string;
    doors: string;
    color: string;
    plateFinal: string;
    plate: string;
    contactPhone: string;
    zipcode: string;
    city: string;
    state: string;
    consigned: boolean;
    consignedOwnerName: string;
    consignmentCommissionPercentage: string;
    downPaymentCents: string;
    installmentCount: string;
    installmentValueCents: string;
    description: string;
    optionalsText: string;
    imageUrls: string[];
    featured: boolean;
    status: string;
    targetIntegrations: string[];
    meli: MeliVehicleFormState;
    olx: OlxVehicleFormState;
};

type TeamMember = {
    id: string;
    fullName: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
};

type SavedVehicleResponse = {
    id: string;
    updatedAt: string | null;
};

type OlxMappingPayload = {
    brandId: string | null;
    modelId: string | null;
    versionId: string | null;
    fuelCode: string | null;
    gearboxCode: string | null;
    doorsCode: string | null;
    colorCode: string | null;
    featureCodes: string[];
    plate: string | null;
    phone: string | null;
    zipcode: string | null;
};

type MeliMappingPayload = {
    categoryId: string | null;
    listingTypeId: string | null;
    condition: string | null;
    sellerSku: string | null;
    title: string | null;
    description: string | null;
    priceCents: number | null;
    attributes: MeliVehicleFormState["attributes"];
};

type SelectedMappingPayloads = {
    providerKeys: string[];
    olx: OlxMappingPayload | null;
    mercadolivre: MeliMappingPayload | null;
};

const TRANSMISSION_OPTIONS = [
    { value: "Automatica", label: "Automático" },
    { value: "Manual", label: "Manual" },
    { value: "Semiautomatica", label: "Semiautomático" },
    { value: "Automatica sequencial", label: "Automático sequencial" },
];

const FUEL_TYPE_OPTIONS = [
    { value: "Flex", label: "Flex" },
    { value: "Gasolina", label: "Gasolina" },
    { value: "Diesel", label: "Diesel" },
    { value: "Etanol", label: "Etanol" },
    { value: "Alcool", label: "Álcool" },
    { value: "Eletrico", label: "Elétrico" },
    { value: "Hibrido", label: "Híbrido" },
    { value: "Hibrido/Flex", label: "Híbrido/Flex" },
    { value: "Hibrido/Gasolina", label: "Híbrido/Gasolina" },
    { value: "Hibrido/Diesel", label: "Híbrido/Diesel" },
    { value: "Gasolina e eletrico", label: "Gasolina e elétrico" },
    { value: "Gasolina e gas natural", label: "Gasolina e gás natural" },
    { value: "Alcool e gas natural", label: "Álcool e gás natural" },
    { value: "Gasolina-Alcool e gas natural", label: "Gasolina-Álcool e gás natural" },
];

const BODY_TYPE_OPTIONS = [
    { value: "Hatch", label: "Hatch" },
    { value: "Sedan", label: "Sedã" },
    { value: "SUV", label: "SUV" },
    { value: "Crossover", label: "Crossover" },
    { value: "Picape", label: "Picape" },
    { value: "Coupe", label: "Coupé" },
    { value: "Conversivel", label: "Conversível" },
    { value: "Perua", label: "Perua" },
    { value: "Van", label: "Van" },
    { value: "Minivan", label: "Minivan" },
];

const DOORS_OPTIONS = [
    { value: "2", label: "2 portas" },
    { value: "3", label: "3 portas" },
    { value: "4", label: "4 portas" },
    { value: "5", label: "5 portas" },
];

const COLOR_OPTIONS = [
    { value: "Prata", label: "Prata" },
    { value: "Preto", label: "Preto" },
    { value: "Branco", label: "Branco" },
    { value: "Cinza", label: "Cinza" },
    { value: "Cinza escuro", label: "Cinza escuro" },
    { value: "Vermelho", label: "Vermelho" },
    { value: "Azul", label: "Azul" },
    { value: "Verde", label: "Verde" },
    { value: "Amarelo", label: "Amarelo" },
    { value: "Bege", label: "Bege" },
    { value: "Marrom", label: "Marrom" },
];

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/avif",
]);
const MAX_VEHICLE_IMAGES = 20;
const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_BYTES = 600_000;
const MAX_UNOPTIMIZED_IMAGE_BYTES = 2_500_000;
const IMAGE_PROCESSING_CONCURRENCY = 2;

function emptyForm(): VehicleFormState {
    return {
        stockNumber: "",
        title: "",
        brand: "",
        model: "",
        version: "",
        engine: "",
        year: "",
        mileage: "",
        priceCents: "",
        tradeInPriceCents: "",
        transmission: "",
        fuelType: "",
        bodyType: "",
        doors: "",
        color: "",
        plateFinal: "",
        plate: "",
        contactPhone: "",
        zipcode: "",
        city: "",
        state: "",
        consigned: false,
        consignedOwnerName: "",
        consignmentCommissionPercentage: "",
        downPaymentCents: "",
        installmentCount: "",
        installmentValueCents: "",
        description: "",
        optionalsText: "",
        imageUrls: [],
        featured: false,
        status: "READY",
        targetIntegrations: [],
        meli: emptyMeliVehicleForm(),
        olx: emptyOlxVehicleForm(),
    };
}

function uniqueImageList(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function reorderImageList(imageUrls: string[], draggedUrl: string, targetUrl: string) {
    if (!draggedUrl || !targetUrl || draggedUrl === targetUrl) return imageUrls;
    const next = imageUrls.filter((item) => item !== draggedUrl);
    const targetIndex = next.indexOf(targetUrl);
    if (targetIndex < 0) return imageUrls;
    next.splice(targetIndex, 0, draggedUrl);
    return next;
}

function vehicleToForm(vehicle: VehicleRecord): VehicleFormState {
    return {
        id: vehicle.id,
        stockNumber: vehicle.stockNumber ?? "",
        title: vehicle.title,
        brand: vehicle.brand,
        model: vehicle.model,
        version: vehicle.version ?? "",
        engine: vehicle.engine ?? "",
        year: vehicle.year ? String(vehicle.year) : vehicle.modelYear ? String(vehicle.modelYear) : vehicle.manufactureYear ? String(vehicle.manufactureYear) : "",
        mileage: vehicle.mileage ? String(vehicle.mileage) : "",
        priceCents: vehicle.priceCents ? String(vehicle.priceCents) : "",
        tradeInPriceCents: vehicle.tradeInPriceCents ? String(vehicle.tradeInPriceCents) : "",
        transmission: vehicle.transmission ?? "",
        fuelType: vehicle.fuelType ?? "",
        bodyType: vehicle.bodyType ?? "",
        doors: vehicle.doors != null ? String(vehicle.doors) : "",
        color: vehicle.color ?? "",
        plateFinal: vehicle.plateFinal ?? "",
        plate: normalizePlateValue(vehicle.plate ?? ""),
        contactPhone: formatPhoneInput(vehicle.contactPhone ?? ""),
        zipcode: formatZipcodeInput(vehicle.zipcode ?? ""),
        city: vehicle.city ?? "",
        state: vehicle.state ?? "",
        consigned: Boolean(vehicle.consigned),
        consignedOwnerName: vehicle.consignedOwnerName ?? "",
        consignmentCommissionPercentage: vehicle.consignmentCommissionPercentage != null ? String(vehicle.consignmentCommissionPercentage) : "",
        downPaymentCents: vehicle.financing.downPaymentCents ? String(vehicle.financing.downPaymentCents) : "",
        installmentCount: vehicle.financing.installmentCount ? String(vehicle.financing.installmentCount) : "",
        installmentValueCents: vehicle.financing.installmentValueCents ? String(vehicle.financing.installmentValueCents) : "",
        description: vehicle.description ?? "",
        optionalsText: vehicle.optionals.join(", "),
        imageUrls: uniqueImageList([vehicle.coverImageUrl, ...vehicle.gallery]),
        featured: vehicle.featured,
        status: vehicle.status,
        targetIntegrations: vehicle.publications.map((publication) => publication.providerKey),
        meli: {
            ...emptyMeliVehicleForm(),
            categoryId: vehicle.meliCategoryId ?? "",
            listingTypeId: vehicle.meliListingTypeId ?? "",
            condition: vehicle.meliCondition ?? "used",
        },
        olx: emptyOlxVehicleForm(),
    };
}

function formatMileage(value?: number | null) {
    if (value == null || Number.isNaN(Number(value))) return "Quilometragem não informada";
    return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleYears(vehicle: VehicleRecord) {
    if (vehicle.year) return String(vehicle.year);
    if (vehicle.modelYear && vehicle.manufactureYear && vehicle.modelYear === vehicle.manufactureYear) return String(vehicle.modelYear);
    if (vehicle.modelYear && vehicle.manufactureYear) return `${vehicle.manufactureYear}/${vehicle.modelYear}`;
    if (vehicle.modelYear) return String(vehicle.modelYear);
    if (vehicle.manufactureYear) return String(vehicle.manufactureYear);
    return "Ano não informado";
}

function buildVehicleSubtitle(vehicle: VehicleRecord) {
    const parts = [vehicle.engine, vehicle.version].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Cadastro pronto para publicação";
}

function getVehicleImage(vehicle: VehicleRecord) {
    return uniqueImageList([vehicle.coverImageUrl, ...vehicle.gallery])[0] ?? null;
}

function inventorySummaryToVehicle(summary: InventoryVehicleSummary): VehicleRecord {
    const imageVersion = summary.updatedAt ? `?v=${encodeURIComponent(summary.updatedAt)}` : "";
    return {
        ...summary,
        transmission: null,
        fuelType: null,
        bodyType: null,
        doors: null,
        color: null,
        plateFinal: null,
        plate: null,
        contactPhone: null,
        zipcode: null,
        city: null,
        state: null,
        description: null,
        coverImageUrl: summary.coverImageAvailable
            ? `/api/ioauto/vehicles/${encodeURIComponent(summary.id)}/cover-image${imageVersion}`
            : null,
        gallery: [],
        optionals: [],
        financing: {
            downPaymentCents: null,
            installmentCount: null,
            installmentValueCents: null,
        },
        meliCategoryId: null,
        meliListingTypeId: null,
        meliCondition: null,
    };
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

function normalizeDigits(value: string) {
    return value.replace(/\D/g, "");
}

function formatPhoneInput(value: string) {
    const digits = normalizeDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatZipcodeInput(value: string) {
    const digits = normalizeDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizePlateValue(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function normalizeProviderKey(value: string) {
    return value.trim().toLowerCase();
}

function canonicalPublicationProviderKey(value: string) {
    const normalized = normalizeProviderKey(value);
    if (normalized === "olx-autos") return "olx";
    if (normalized === "mercado_livre") return "mercadolivre";
    return normalized;
}

function isSupportedVehicleImage(file: File) {
    return SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase());
}

function readBlobAsDataUrl(blob: Blob, label: string) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string" && reader.result.trim()) {
                resolve(reader.result);
                return;
            }
            reject(new Error(`Não foi possível ler a imagem "${label}".`));
        };
        reader.onerror = () => reject(new Error(`Não foi possível ler a imagem "${label}".`));
        reader.readAsDataURL(blob);
    });
}

function loadImageFile(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Não foi possível processar a imagem "${file.name}".`));
        };
        image.src = objectUrl;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function optimizeImageFile(file: File) {
    try {
        const image = await loadImageFile(file);
        const largestDimension = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = largestDimension > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / largestDimension : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas indisponível.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        let optimized: Blob | null = null;
        for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
            optimized = await canvasToBlob(canvas, quality);
            if (optimized && optimized.size <= TARGET_IMAGE_BYTES) break;
        }
        if (!optimized) throw new Error("Codificação WEBP indisponível.");

        const selected = optimized.size < file.size || file.size > TARGET_IMAGE_BYTES
            ? optimized
            : file;
        return readBlobAsDataUrl(selected, file.name);
    } catch (cause) {
        if (file.size <= MAX_UNOPTIMIZED_IMAGE_BYTES) {
            return readBlobAsDataUrl(file, file.name);
        }
        throw cause instanceof Error
            ? cause
            : new Error(`Não foi possível otimizar a imagem "${file.name}".`);
    }
}

async function optimizeImageFiles(files: File[]) {
    const results = new Array<string>(files.length);
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(IMAGE_PROCESSING_CONCURRENCY, files.length) },
        async () => {
            while (nextIndex < files.length) {
                const index = nextIndex++;
                results[index] = await optimizeImageFile(files[index]);
            }
        },
    );
    await Promise.all(workers);
    return results;
}

function isConnectedIntegrationStatus(status: string) {
    const normalized = status.trim().toUpperCase();
    return normalized === "CONNECTED" || normalized === "ACTIVE";
}

function normalizeLookupValue(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function parseOptionalsInput(raw: string) {
    return Array.from(new Set(raw.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)));
}

function formatFinancingSummary(vehicle: VehicleRecord) {
    const parts: string[] = [];
    if (vehicle.financing.downPaymentCents != null) parts.push(`Entrada ${formatMoney(vehicle.financing.downPaymentCents)}`);
    if (vehicle.financing.installmentCount != null && vehicle.financing.installmentValueCents != null) {
        parts.push(`${vehicle.financing.installmentCount}x de ${formatMoney(vehicle.financing.installmentValueCents)}`);
    }
    return parts.length ? parts.join(" • ") : "Financiamento não informado";
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
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [saleConversations, setSaleConversations] = useState<ConversationRecord[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [form, setForm] = useState<VehicleFormState>(emptyForm());
    const [saving, setSaving] = useState(false);
    const [deletingVehicle, setDeletingVehicle] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saleContextLoading, setSaleContextLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [stockTab, setStockTab] = useState<"AVAILABLE" | "SOLD">("AVAILABLE");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorDetailsLoaded, setEditorDetailsLoaded] = useState(true);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [loadingVehicleId, setLoadingVehicleId] = useState<string | null>(null);
    const [isImageDragActive, setIsImageDragActive] = useState(false);
    const [draggedImageUrl, setDraggedImageUrl] = useState<string | null>(null);
    const [dragOverImageUrl, setDragOverImageUrl] = useState<string | null>(null);
    const [meliListingTypes, setMeliListingTypes] = useState<MeliListingTypeRecord[]>([]);
    const [loadingMeliListingTypes, setLoadingMeliListingTypes] = useState(false);
    const [saleVehicle, setSaleVehicle] = useState<VehicleRecord | null>(null);
    const [saleSellerUserId, setSaleSellerUserId] = useState("");
    const [saleFinancial, setSaleFinancial] = useState<SaleClosingFinancialFormState>(createDefaultSaleClosingFinancialState);
    const [saleBuyerMode, setSaleBuyerMode] = useState<"EXISTING" | "NEW">("EXISTING");
    const [saleBuyerConversationId, setSaleBuyerConversationId] = useState("");
    const [saleBuyerName, setSaleBuyerName] = useState("");
    const [saleBuyerPhone, setSaleBuyerPhone] = useState("");
    const [saleSubmitting, setSaleSubmitting] = useState(false);
    const [saleMessage, setSaleMessage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const editorLoadRequestRef = useRef(0);
    const saleContextLoadedRef = useRef(false);

    const connectedIntegrations = useMemo(() => integrations.filter((integration) => isConnectedIntegrationStatus(integration.status)), [integrations]);
    const readyPublicationIntegrations = useMemo(
        () => connectedIntegrations.filter((integration) => integration.supportsPublication),
        [connectedIntegrations]
    );
    const readyPublicationProviderKeys = useMemo(
        () => new Set(readyPublicationIntegrations.map((integration) => canonicalPublicationProviderKey(integration.providerKey))),
        [readyPublicationIntegrations]
    );
    const selectedReadyPublicationIntegrations = useMemo(
        () =>
            readyPublicationIntegrations.filter((integration) =>
                form.targetIntegrations.some(
                    (providerKey) => canonicalPublicationProviderKey(providerKey) === canonicalPublicationProviderKey(integration.providerKey),
                )
            ),
        [form.targetIntegrations, readyPublicationIntegrations]
    );
    const requiresOlxPublication = useMemo(
        () =>
            form.targetIntegrations.some((providerKey) => {
                const normalized = canonicalPublicationProviderKey(providerKey);
                return readyPublicationProviderKeys.has(normalized) && normalized === "olx";
            }),
        [form.targetIntegrations, readyPublicationProviderKeys]
    );
    const requiresMeliPublication = useMemo(
        () =>
            form.targetIntegrations.some((providerKey) => {
                const normalized = canonicalPublicationProviderKey(providerKey);
                return readyPublicationProviderKeys.has(normalized) && normalized === "mercadolivre";
            }),
        [form.targetIntegrations, readyPublicationProviderKeys]
    );
    const vehiclesByAvailability = useMemo(
        () =>
            vehicles.reduce(
                (grouped, vehicle) => {
                    const target = String(vehicle.status ?? "").trim().toUpperCase() === "SOLD" ? grouped.sold : grouped.available;
                    target.push(vehicle);
                    return grouped;
                },
                { available: [] as VehicleRecord[], sold: [] as VehicleRecord[] },
            ),
        [vehicles],
    );
    const visibleVehicles = useMemo(() => {
        const filteredByTab = stockTab === "SOLD" ? vehiclesByAvailability.sold : vehiclesByAvailability.available;
        const query = search.trim().toLowerCase();
        if (!query) return filteredByTab;
        return filteredByTab.filter((vehicle) =>
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
    }, [search, stockTab, vehiclesByAvailability]);
    const availableVehiclesCount = vehiclesByAvailability.available.length;
    const soldVehiclesCount = vehiclesByAvailability.sold.length;
    const requiresBuyerLead = Boolean(billing?.features.leadManagement);
    const saleFinancialPreview = useMemo(
        () => computeSaleClosingFinancialPreview(
            saleFinancial.hasTradeInVehicle && saleVehicle?.tradeInPriceCents
                ? saleVehicle.tradeInPriceCents
                : saleVehicle?.priceCents ?? 0,
            saleFinancial,
            saleVehicle == null
            ? null
            : {
                consigned: saleVehicle.consigned,
                consignedOwnerName: saleVehicle.consignedOwnerName,
                consignmentCommissionPercentage: saleVehicle.consignmentCommissionPercentage,
            }
        ),
        [saleFinancial, saleVehicle]
    );

    useEffect(() => {
        void loadInventory();
        void loadInventoryContext();
    }, []);

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

    async function saveOlxMapping(
        vehicleId: string,
        mapping: OlxMappingPayload
    ) {
        const response = await fetch(`/api/integrations/olx/vehicles/${vehicleId}/mapping`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mapping),
        });
        const payload = (await response.json().catch(() => null)) as OlxVehicleMapping | { message?: string } | null;
        if (!response.ok) {
            throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao salvar a configuração OLX do veículo.");
        }
    }

    async function saveMeliMapping(
        vehicleId: string,
        mapping: MeliMappingPayload
    ) {
        const response = await fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/mapping`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mapping),
        });
        const payload = (await response.json().catch(() => null)) as MeliVehicleMapping | { message?: string } | null;
        if (!response.ok) {
            throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao salvar a configuração Mercado Livre do veículo.");
        }
    }

    async function fetchOlxCatalogOptions(path: string) {
        try {
            const response = await fetch(path, { cache: "no-store" });
            if (!response.ok) return [] as OlxCatalogOption[];
            return (await response.json()) as OlxCatalogOption[];
        } catch {
            return [] as OlxCatalogOption[];
        }
    }

    function matchCatalogOption(options: OlxCatalogOption[], rawValue: string) {
        const normalizedQuery = normalizeLookupValue(rawValue);
        if (!normalizedQuery) return null;

        const exact = options.find((option) => normalizeLookupValue(option.name) === normalizedQuery);
        if (exact) return exact.id;

        const partial = options.find((option) => {
            const normalizedName = normalizeLookupValue(option.name);
            return normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName);
        });
        return partial?.id ?? null;
    }

    async function buildOlxMappingPayload() {
        let brandId = form.olx.brandId.trim() || null;
        let modelId = form.olx.modelId.trim() || null;
        let versionId = form.olx.versionId.trim() || null;

        if (!brandId && form.brand.trim()) {
            const brands = await fetchOlxCatalogOptions("/api/integrations/olx/catalog/brands");
            brandId = matchCatalogOption(brands, form.brand);
        }

        if (brandId && !modelId && form.model.trim()) {
            const models = await fetchOlxCatalogOptions(`/api/integrations/olx/catalog/brands/${encodeURIComponent(brandId)}/models`);
            modelId = matchCatalogOption(models, form.model);
        }

        if (brandId && modelId && !versionId) {
            const versions = await fetchOlxCatalogOptions(
                `/api/integrations/olx/catalog/brands/${encodeURIComponent(brandId)}/models/${encodeURIComponent(modelId)}/versions`
            );
            versionId = matchCatalogOption(versions, form.version || form.engine || form.title);
        }

        return {
            brandId,
            modelId,
            versionId,
            fuelCode: form.olx.fuelCode.trim() || null,
            gearboxCode: form.olx.gearboxCode.trim() || null,
            doorsCode: form.olx.doorsCode.trim() || null,
            colorCode: form.olx.colorCode.trim() || null,
            featureCodes: form.olx.featureCodes,
            plate: normalizePlateValue(form.plate || form.olx.plate) || null,
            phone: normalizeDigits(form.contactPhone || form.olx.phone) || null,
            zipcode: normalizeDigits(form.zipcode || form.olx.zipcode) || null,
        };
    }

    async function fetchMeliCategorySuggestion(title: string) {
        try {
            const response = await fetch(`/api/integrations/mercadolivre/categories/discover?title=${encodeURIComponent(title)}`, { cache: "no-store" });
            if (!response.ok) return null;
            return (await response.json()) as MeliCategorySuggestion;
        } catch {
            return null;
        }
    }

    async function fetchMeliListingTypes(categoryId: string) {
        try {
            const response = await fetch(`/api/integrations/mercadolivre/listing-types?categoryId=${encodeURIComponent(categoryId)}`, { cache: "no-store" });
            if (!response.ok) return [] as MeliListingTypeRecord[];
            return (await response.json()) as MeliListingTypeRecord[];
        } catch {
            return [] as MeliListingTypeRecord[];
        }
    }

    function pickPreferredListingType(listingTypes: MeliListingTypeRecord[]) {
        return listingTypes.find((item) => item.remainingListings == null || item.remainingListings > 0)?.id ?? listingTypes[0]?.id ?? null;
    }

    async function buildMeliMappingPayload() {
        let categoryId = form.meli.categoryId.trim() || null;
        if (!categoryId && form.title.trim()) {
            categoryId = (await fetchMeliCategorySuggestion(form.title.trim()))?.categoryId ?? null;
        }

        let listingTypeId = form.meli.listingTypeId.trim() || null;
        if (!listingTypeId && categoryId) {
            listingTypeId = pickPreferredListingType(await fetchMeliListingTypes(categoryId));
        }

        const normalizedMileage = Number(form.mileage || "0");
        return {
            categoryId,
            listingTypeId,
            condition: form.meli.condition.trim() || (normalizedMileage === 0 ? "new" : "used"),
            sellerSku: form.meli.sellerSku.trim() || null,
            title: form.title.trim() || form.meli.title.trim() || null,
            description: form.description.trim() || form.meli.description.trim() || null,
            priceCents: form.priceCents ? Number(form.priceCents) : null,
            attributes: form.meli.attributes,
        };
    }

    async function loadMeliListingTypes(categoryId: string) {
        setLoadingMeliListingTypes(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/listing-types?categoryId=${encodeURIComponent(categoryId)}`, { cache: "no-store" });
            if (response.ok) {
                setMeliListingTypes((await response.json()) as MeliListingTypeRecord[]);
            } else {
                setMeliListingTypes([]);
            }
        } finally {
            setLoadingMeliListingTypes(false);
        }
    }

    async function prepareSelectedMappings(): Promise<SelectedMappingPayloads> {
        const selectedProviders = new Set(
            form.targetIntegrations
                .map((providerKey) => canonicalPublicationProviderKey(providerKey))
                .filter((providerKey) => readyPublicationProviderKeys.has(providerKey))
        );
        const [olx, mercadolivre] = await Promise.all([
            selectedProviders.has("olx") ? buildOlxMappingPayload() : Promise.resolve(null),
            selectedProviders.has("mercadolivre") ? buildMeliMappingPayload() : Promise.resolve(null),
        ]);
        return { providerKeys: Array.from(selectedProviders), olx, mercadolivre };
    }

    async function persistSelectedMappings(vehicleId: string, mappings: SelectedMappingPayloads) {
        const tasks: Promise<void>[] = [];
        if (mappings.olx) tasks.push(saveOlxMapping(vehicleId, mappings.olx));
        if (mappings.mercadolivre) tasks.push(saveMeliMapping(vehicleId, mappings.mercadolivre));
        await Promise.all(tasks);
    }

    async function syncSelectedIntegrations(vehicleId: string) {
        const response = await fetch(`/api/ioauto/vehicles/${encodeURIComponent(vehicleId)}/sync-publications`, {
            method: "POST",
        });
        if (response.ok) return;
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Não foi possível agendar a sincronização das integrações.");
    }

    async function finalizeVehicleIntegrations(
        vehicleId: string,
        mappingsPromise: Promise<SelectedMappingPayloads>,
    ) {
        try {
            const mappings = await mappingsPromise;
            await persistSelectedMappings(vehicleId, mappings);
            if (mappings.providerKeys.length) {
                await syncSelectedIntegrations(vehicleId);
            }
        } catch (cause) {
            setError(
                `Veículo salvo, mas a sincronização das integrações ficou pendente: ${
                    cause instanceof Error ? cause.message : "falha desconhecida"
                }`,
            );
        }
    }

    useEffect(() => {
        const categoryId = form.meli.categoryId.trim();
        if (!categoryId) {
            setMeliListingTypes([]);
            return;
        }
        void loadMeliListingTypes(categoryId);
    }, [form.meli.categoryId]);

    async function loadInventory(showLoadingState = true) {
        if (showLoadingState) {
            setLoading(true);
            setError(null);
        }
        try {
            const vehiclesResponse = await fetch("/api/ioauto/vehicles/inventory-summaries", { cache: "no-store" });
            if (!vehiclesResponse.ok) throw new Error("Falha ao listar os veículos.");
            const summaries = await vehiclesResponse.json() as InventoryVehicleSummary[];
            const vehiclePayload = summaries.map(inventorySummaryToVehicle);

            setVehicles(vehiclePayload);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar o estoque.");
        } finally {
            if (showLoadingState) {
                setLoading(false);
            }
        }
    }

    async function loadInventoryContext() {
        try {
            const [integrationsResponse, billingResponse] = await Promise.all([
                fetch("/api/ioauto/integrations", { cache: "no-store" }),
                fetch("/api/ioauto/billing", { cache: "no-store", credentials: "include" }),
            ]);
            if (!integrationsResponse.ok) throw new Error("Falha ao listar as integrações.");
            if (!billingResponse.ok) throw new Error("Falha ao carregar o plano atual.");

            const [integrationPayload, billingPayload] = await Promise.all([
                integrationsResponse.json() as Promise<IntegrationRecord[]>,
                billingResponse.json() as Promise<BillingSnapshot>,
            ]);
            setIntegrations(integrationPayload);
            setBilling(billingPayload);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar os recursos auxiliares do estoque.");
        }
    }

    async function loadSaleContext() {
        if (saleContextLoadedRef.current || saleContextLoading) return;

        setSaleContextLoading(true);
        try {
            const usersRequest = fetch("/api/atendimentos/users", { cache: "no-store", credentials: "include" });
            let currentBilling = billing;
            if (!currentBilling) {
                const billingResponse = await fetch("/api/ioauto/billing", { cache: "no-store", credentials: "include" });
                if (!billingResponse.ok) throw new Error("Falha ao carregar o plano atual.");
                currentBilling = await billingResponse.json() as BillingSnapshot;
                setBilling(currentBilling);
            }

            const conversationsRequest = currentBilling.features.leadManagement
                ? fetch("/api/atendimentos/conversations", { cache: "no-store", credentials: "include" })
                : null;

            const usersResponse = await usersRequest;
            if (!usersResponse.ok) throw new Error("Falha ao listar a equipe.");
            const usersPayload = await usersResponse.json() as TeamMember[];

            let conversationsPayload: ConversationRecord[] = [];
            if (conversationsRequest) {
                const conversationsResponse = await conversationsRequest;
                if (!conversationsResponse.ok) {
                    const payload = await conversationsResponse.json().catch(() => ({ message: "Falha ao listar os leads." }));
                    throw new Error(payload.message ?? "Falha ao listar os leads.");
                }
                conversationsPayload = await conversationsResponse.json() as ConversationRecord[];
            }

            setTeamMembers(usersPayload);
            setSaleConversations(conversationsPayload);
            if (currentBilling.features.leadManagement) {
                setSaleBuyerMode(conversationsPayload.length ? "EXISTING" : "NEW");
            }
            saleContextLoadedRef.current = true;
        } catch (cause) {
            setSaleMessage(cause instanceof Error ? cause.message : "Falha ao carregar os dados para concluir a venda.");
        } finally {
            setSaleContextLoading(false);
        }
    }

    function openCreateEditor() {
        editorLoadRequestRef.current += 1;
        setForm(emptyForm());
        setEditorDetailsLoaded(true);
        setError(null);
        setUploadingImages(false);
        setDeletingVehicle(false);
        setIsImageDragActive(false);
        setDraggedImageUrl(null);
        setDragOverImageUrl(null);
        setIsEditorOpen(true);
    }

    async function openEditEditor(vehicle: VehicleRecord) {
        if (loadingVehicleId) return;
        const requestId = editorLoadRequestRef.current + 1;
        editorLoadRequestRef.current = requestId;
        setLoadingVehicleId(vehicle.id);
        setError(null);
        setForm(vehicleToForm(vehicle));
        setEditorDetailsLoaded(false);
        setUploadingImages(false);
        setDeletingVehicle(false);
        setIsImageDragActive(false);
        setDraggedImageUrl(null);
        setDragOverImageUrl(null);
        setIsEditorOpen(true);
        try {
            const response = await fetch(`/api/ioauto/vehicles/${encodeURIComponent(vehicle.id)}`, { cache: "no-store" });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao carregar o veículo." }));
                throw new Error(payload.message ?? "Falha ao carregar o veículo.");
            }
            const fullVehicle = await response.json() as VehicleRecord;
            if (editorLoadRequestRef.current !== requestId) return;
            setForm(vehicleToForm(fullVehicle));
            setEditorDetailsLoaded(true);
        } catch (cause) {
            if (editorLoadRequestRef.current === requestId) {
                setIsEditorOpen(false);
                setEditorDetailsLoaded(true);
                setForm(emptyForm());
                setError(cause instanceof Error ? cause.message : "Falha ao carregar o veículo.");
            }
        } finally {
            if (editorLoadRequestRef.current === requestId) {
                setLoadingVehicleId(null);
            }
        }
    }

    function closeEditor() {
        editorLoadRequestRef.current += 1;
        setIsEditorOpen(false);
        setEditorDetailsLoaded(true);
        setLoadingVehicleId(null);
        setError(null);
        setUploadingImages(false);
        setDeletingVehicle(false);
        setIsImageDragActive(false);
        setDraggedImageUrl(null);
        setDragOverImageUrl(null);
        setForm(emptyForm());
    }

    async function handleDeleteVehicle() {
        const vehicleId = form.id;
        if (!vehicleId || !editorDetailsLoaded || deletingVehicle || saving) return;

        const confirmed = window.confirm(
            `Excluir "${form.title || "este veículo"}" do estoque? O veículo sairá das listagens e os anúncios integrados serão retirados.`,
        );
        if (!confirmed) return;

        setDeletingVehicle(true);
        setError(null);
        try {
            const response = await fetch(`/api/ioauto/vehicles/${encodeURIComponent(vehicleId)}`, {
                method: "DELETE",
            });
            const payload = (await response.json().catch(() => null)) as { message?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.message ?? "Falha ao excluir o veículo.");
            }

            setVehicles((current) => current.filter((vehicle) => vehicle.id !== vehicleId));
            closeEditor();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao excluir o veículo.");
        } finally {
            setDeletingVehicle(false);
        }
    }

    function openCloseSaleModal(vehicle: VehicleRecord) {
        const defaultFinancial = createDefaultSaleClosingFinancialState();
        const hasDefaultCommission = vehicle.consigned && vehicle.consignmentCommissionPercentage != null && vehicle.consignmentCommissionPercentage > 0;
        if (hasDefaultCommission) {
            defaultFinancial.consignmentCommissionType = "PERCENTUAL";
            defaultFinancial.consignmentCommissionPercentage = String(vehicle.consignmentCommissionPercentage);
        }
        setSaleVehicle(vehicle);
        setSaleSellerUserId("");
        setSaleFinancial(defaultFinancial);
        setSaleBuyerMode(requiresBuyerLead && !saleConversations.length ? "NEW" : "EXISTING");
        setSaleBuyerConversationId("");
        setSaleBuyerName("");
        setSaleBuyerPhone("");
        setSaleMessage(null);
        void loadSaleContext();
    }

    function closeSaleModal() {
        setSaleVehicle(null);
        setSaleSellerUserId("");
        setSaleFinancial(createDefaultSaleClosingFinancialState());
        setSaleBuyerMode("EXISTING");
        setSaleBuyerConversationId("");
        setSaleBuyerName("");
        setSaleBuyerPhone("");
        setSaleMessage(null);
    }

    async function handleCloseSale() {
        if (!saleVehicle) return;
        if (!saleSellerUserId) {
            setSaleMessage("Selecione o vendedor responsável para concluir a venda.");
            return;
        }

        if (requiresBuyerLead && saleBuyerMode === "EXISTING" && !saleBuyerConversationId) {
            setSaleMessage("Selecione o lead comprador para concluir a venda.");
            return;
        }
        if (requiresBuyerLead && saleBuyerMode === "NEW" && !saleBuyerName.trim()) {
            setSaleMessage("Informe o nome do comprador para criar o lead.");
            return;
        }
        if (requiresBuyerLead && saleBuyerMode === "NEW" && normalizeDigits(saleBuyerPhone).length < 10) {
            setSaleMessage("Informe um telefone válido para criar o lead do comprador.");
            return;
        }

        const financialValidationError = validateSaleClosingFinancialState(saleFinancial, saleFinancialPreview);
        if (financialValidationError) {
            setSaleMessage(financialValidationError);
            return;
        }

        setSaleSubmitting(true);
        setSaleMessage(null);
        try {
            const response = await fetch(`/api/ioauto/vehicles/${saleVehicle.id}/close-sale`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    sellerUserId: saleSellerUserId,
                    buyerConversationId: requiresBuyerLead && saleBuyerMode === "EXISTING" ? saleBuyerConversationId : null,
                    buyerName: requiresBuyerLead && saleBuyerMode === "NEW" ? saleBuyerName.trim() : null,
                    buyerPhone: requiresBuyerLead && saleBuyerMode === "NEW" ? normalizeDigits(saleBuyerPhone) : null,
                    financial: buildSaleClosingFinancialPayload(saleFinancial, saleFinancialPreview),
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Não foi possível concluir a venda do veículo." }));
                throw new Error(payload.message ?? "Não foi possível concluir a venda do veículo.");
            }

            setVehicles((current) =>
                current.map((vehicle) =>
                    vehicle.id === saleVehicle.id
                        ? {
                              ...vehicle,
                              status: "SOLD",
                              updatedAt: new Date().toISOString(),
                          }
                        : vehicle
                )
            );
            saleContextLoadedRef.current = false;
            closeSaleModal();
        } catch (cause) {
            setSaleMessage(cause instanceof Error ? cause.message : "Não foi possível concluir a venda do veículo.");
        } finally {
            setSaleSubmitting(false);
        }
    }

    function openImagePicker() {
        imageInputRef.current?.click();
    }

    async function uploadSelectedImages(files: File[]) {
        if (!files.length) return;

        setUploadingImages(true);
        setError(null);
        try {
            const invalidFile = files.find((file) => !isSupportedVehicleImage(file));
            if (invalidFile) {
                throw new Error("Envie imagens PNG, JPG, WEBP, GIF ou AVIF.");
            }
            if (form.imageUrls.length + files.length > MAX_VEHICLE_IMAGES) {
                throw new Error(`Envie no máximo ${MAX_VEHICLE_IMAGES} imagens por veículo.`);
            }

            const imageUrls = await optimizeImageFiles(files);

            setForm((current) => ({
                ...current,
                imageUrls: uniqueImageList([...current.imageUrls, ...imageUrls]),
            }));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível adicionar as imagens.");
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

    function handleImageCardDragStart(event: DragEvent<HTMLDivElement>, imageUrl: string) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", imageUrl);
        setDraggedImageUrl(imageUrl);
        setDragOverImageUrl(imageUrl);
    }

    function handleImageCardDragOver(event: DragEvent<HTMLDivElement>, imageUrl: string) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverImageUrl !== imageUrl) {
            setDragOverImageUrl(imageUrl);
        }
    }

    function handleImageCardDrop(event: DragEvent<HTMLDivElement>, targetUrl: string) {
        event.preventDefault();
        const sourceUrl = draggedImageUrl || event.dataTransfer.getData("text/plain");
        if (!sourceUrl || sourceUrl === targetUrl) {
            setDragOverImageUrl(null);
            return;
        }

        setForm((current) => ({
            ...current,
            imageUrls: reorderImageList(current.imageUrls, sourceUrl, targetUrl),
        }));
        setDragOverImageUrl(targetUrl);
    }

    function handleImageCardDragEnd() {
        setDraggedImageUrl(null);
        setDragOverImageUrl(null);
    }

    async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.id && !editorDetailsLoaded) {
            setError("Aguarde o carregamento das informações do veículo.");
            return;
        }
        setSaving(true);
        setError(null);

        try {
            const year = form.year ? Number(form.year) : null;
            const consignmentCommissionPercentage = form.consignmentCommissionPercentage.trim()
                ? Number(form.consignmentCommissionPercentage.replace(",", "."))
                : null;
            if (form.consigned && !form.consignedOwnerName.trim()) {
                throw new Error("Informe o dono/empresa para veículo consignado.");
            }
            if (consignmentCommissionPercentage != null && Number.isFinite(consignmentCommissionPercentage) === false) {
                throw new Error("Informe um percentual de comissão válido para consignação.");
            }
            if (consignmentCommissionPercentage != null && consignmentCommissionPercentage < 0) {
                throw new Error("O percentual de comissão da consignação não pode ser negativo.");
            }
            if (consignmentCommissionPercentage != null && consignmentCommissionPercentage > 100) {
                throw new Error("O percentual de comissão da consignação não pode ser maior que 100%.");
            }
            const imageUrls = uniqueImageList(form.imageUrls);
            const targetIntegrations = Array.from(
                new Set(
                    form.targetIntegrations
                        .map((providerKey) => canonicalPublicationProviderKey(providerKey))
                        .filter((providerKey) => readyPublicationProviderKeys.has(providerKey)),
                ),
            );
            const payload = {
                stockNumber: form.stockNumber || null,
                title: form.title,
                brand: form.brand,
                model: form.model,
                version: form.version || null,
                engine: form.engine || null,
                year,
                modelYear: year,
                manufactureYear: year,
                mileage: form.mileage ? Number(form.mileage) : null,
                priceCents: form.priceCents ? Number(form.priceCents) : null,
                tradeInPriceCents: form.tradeInPriceCents ? Number(form.tradeInPriceCents) : null,
                transmission: form.transmission || null,
                fuelType: form.fuelType || null,
                bodyType: form.bodyType || null,
                doors: form.doors ? Number(form.doors) : null,
                color: form.color || null,
                plateFinal: form.plateFinal || null,
                plate: normalizePlateValue(form.plate) || null,
                contactPhone: normalizeDigits(form.contactPhone) || null,
                zipcode: normalizeDigits(form.zipcode) || null,
                city: form.city || null,
                state: form.state || null,
                consigned: form.consigned,
                consignedOwnerName: form.consigned ? form.consignedOwnerName.trim() || null : null,
                consignmentCommissionPercentage: form.consigned
                    ? consignmentCommissionPercentage
                    : null,
                description: form.description,
                coverImageUrl: imageUrls[0] ?? null,
                gallery: imageUrls.slice(1),
                optionals: parseOptionalsInput(form.optionalsText),
                featured: form.featured,
                status: form.status,
                financing: {
                    downPaymentCents: form.downPaymentCents ? Number(form.downPaymentCents) : null,
                    installmentCount: form.installmentCount ? Number(form.installmentCount) : null,
                    installmentValueCents: form.installmentValueCents ? Number(form.installmentValueCents) : null,
                },
                targetIntegrations,
                meliCategoryId: form.meli.categoryId || null,
                meliListingTypeId: form.meli.listingTypeId || null,
                meliCondition: form.meli.condition || null,
            };

            const mappingsPromise = prepareSelectedMappings();
            void mappingsPromise.catch(() => undefined);
            const response = await fetch(form.id ? `/api/ioauto/vehicles/${form.id}` : "/api/ioauto/vehicles", {
                method: form.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const responseBody = (await response.json().catch(() => null)) as SavedVehicleResponse | { message?: string } | null;

            if (!response.ok) {
                throw new Error((responseBody as { message?: string } | null)?.message ?? "Falha ao salvar o veículo.");
            }

            const savedVehicle = responseBody as SavedVehicleResponse;
            setIsEditorOpen(false);
            void loadInventory(false);
            void finalizeVehicleIntegrations(savedVehicle.id, mappingsPromise);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao salvar o veículo.");
        } finally {
            setSaving(false);
        }
    }

    const publishedVehicles = useMemo(
        () => vehicles.filter((vehicle) => vehicle.publications.length > 0).length,
        [vehicles],
    );

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

                <div className="mt-5 flex flex-wrap gap-3">
                    <StockTabButton active={stockTab === "AVAILABLE"} label="Disponíveis" count={availableVehiclesCount} onClick={() => setStockTab("AVAILABLE")} />
                    <StockTabButton active={stockTab === "SOLD"} label="Vendidos" count={soldVehiclesCount} onClick={() => setStockTab("SOLD")} />
                </div>

                {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

                {loading ? (
                    <SystemPageLoader
                        compact
                        label="Carregando estoque"
                        description="Preparando veículos e publicações..."
                        className="rounded-[34px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.05)]"
                    />
                ) : visibleVehicles.length ? (
                    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleVehicles.map((vehicle) => (
                            <InventoryVehicleCard
                                key={vehicle.id}
                                vehicle={vehicle}
                                editing={loadingVehicleId === vehicle.id}
                                onEdit={() => void openEditEditor(vehicle)}
                                onCloseSale={() => openCloseSaleModal(vehicle)}
                            />
                        ))}
                    </section>
                ) : (
                    <section className="rounded-[34px] border border-dashed border-black/12 bg-white px-6 py-12 text-center shadow-[0_18px_45px_rgba(0,0,0,0.04)]">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/[0.04]">
                            <Search className="h-6 w-6 text-black/45" />
                        </div>
                        <h2 className="mt-4 font-display text-2xl font-bold text-io-dark">Nenhum veículo encontrado</h2>
                        <p className="mt-2 text-sm text-black/52">Ajuste a pesquisa ou cadastre um novo veículo para preencher essa vitrine.</p>
                    </section>
                )}
            </div>

            {isEditorOpen ? (
                <div className="fixed inset-0 z-50 bg-black/55 px-4 py-6">
                    <div className="mx-auto flex h-full max-w-6xl items-start justify-center">
                        <div className="flex max-h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-8">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Cadastro do veículo</p>
                                    <h2 className="mt-1 font-display text-2xl font-bold text-io-dark">{form.id ? "Editar veículo" : "Novo veículo"}</h2>
                                    <p className="mt-1 text-sm text-black/55">Cadastro único com os dados que alimentam as integrações selecionadas no mesmo fluxo.</p>
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
                                {!editorDetailsLoaded && form.id ? (
                                    <div className="mx-6 mt-5 flex items-center gap-2 rounded-2xl bg-[#eef4ff] px-4 py-3 text-sm font-medium text-[#2b57d9] md:mx-8">
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                        Carregando informações complementares e imagens...
                                    </div>
                                ) : null}
                                {error ? <p className="mx-6 mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 md:mx-8">{error}</p> : null}

                                <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-6 transition md:px-8 ${!editorDetailsLoaded ? "pointer-events-none opacity-60" : ""}`}>
                                    <div className="grid gap-6">
                                        <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-io-dark">Cadastro unificado do veículo</p>
                                                    <p className="mt-1 text-sm text-black/52">Esses dados são reutilizados automaticamente pelas integrações conectadas para evitar retrabalho.</p>
                                                </div>
                                                <span className="rounded-full bg-black/[0.04] px-4 py-2 text-xs font-semibold text-black/52">
                                                    {readyPublicationIntegrations.length} integrações prontas
                                                </span>
                                            </div>

                                            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <Field label="Código interno" value={form.stockNumber} onChange={(value) => updateField("stockNumber", value)} placeholder="Opcional" />
                                                <Field label="Nome do anúncio" value={form.title} onChange={(value) => updateField("title", value)} required />
                                                <Field label="Marca" value={form.brand} onChange={(value) => updateField("brand", value)} required />
                                                <Field label="Modelo" value={form.model} onChange={(value) => updateField("model", value)} required />
                                                <Field label="Versão" value={form.version} onChange={(value) => updateField("version", value)} placeholder="Ex.: LTZ 1.0 Turbo" />
                                                <Field label="Motor" value={form.engine} onChange={(value) => updateField("engine", value)} placeholder="Ex.: 1.6 Flex" />
                                                <Field label="Ano" value={form.year} onChange={(value) => updateField("year", value.replace(/\D/g, "").slice(0, 4))} required inputMode="numeric" />
                                                <Field label="Quilometragem (KM)" value={form.mileage} onChange={(value) => updateField("mileage", value.replace(/\D/g, ""))} inputMode="numeric" />
                                                <MoneyField label="Valor padrão (R$)" value={form.priceCents} onChange={(value) => updateField("priceCents", value)} required />
                                                <MoneyField label="Valor de troca (R$)" value={form.tradeInPriceCents} onChange={(value) => updateField("tradeInPriceCents", value)} />
                                                <SelectField label="Câmbio" value={form.transmission} options={TRANSMISSION_OPTIONS} onChange={(value) => updateField("transmission", value)} />
                                                <SelectField label="Combustível" value={form.fuelType} options={FUEL_TYPE_OPTIONS} onChange={(value) => updateField("fuelType", value)} />
                                                <SelectField label="Carroceria" value={form.bodyType} options={BODY_TYPE_OPTIONS} onChange={(value) => updateField("bodyType", value)} />
                                                <SelectField label="Portas" value={form.doors} options={DOORS_OPTIONS} onChange={(value) => updateField("doors", value)} />
                                                <SelectField label="Cor" value={form.color} options={COLOR_OPTIONS} onChange={(value) => updateField("color", value)} />
                                                <Field
                                                    label="Placa completa"
                                                    value={form.plate}
                                                    onChange={(value) => updateField("plate", normalizePlateValue(value))}
                                                    placeholder="ABC1D23"
                                                    maxLength={7}
                                                    required={requiresOlxPublication && Number(form.mileage || "0") > 0}
                                                />
                                                <Field
                                                    label="Final da placa"
                                                    value={form.plateFinal}
                                                    onChange={(value) => updateField("plateFinal", value.replace(/\D/g, "").slice(0, 1))}
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                />
                                                <Field
                                                    label="Telefone para atendimento"
                                                    value={form.contactPhone}
                                                    onChange={(value) => updateField("contactPhone", formatPhoneInput(value))}
                                                    placeholder="(11) 99999-9999"
                                                    inputMode="tel"
                                                    maxLength={15}
                                                    required={requiresOlxPublication}
                                                />
                                                <Field
                                                    label="CEP do anúncio"
                                                    value={form.zipcode}
                                                    onChange={(value) => updateField("zipcode", formatZipcodeInput(value))}
                                                    inputMode="numeric"
                                                    placeholder="00000-000"
                                                    maxLength={9}
                                                    required={requiresOlxPublication}
                                                />
                                                <Field label="Cidade" value={form.city} onChange={(value) => updateField("city", value)} />
                                                <Field
                                                    label="UF"
                                                    value={form.state}
                                                    onChange={(value) => updateField("state", value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                                                    placeholder="SP"
                                                />
                                            </div>
                                            <p className="mt-3 text-xs text-black/45">
                                                O valor de troca é opcional e será usado como preço-base no fechamento quando houver um veículo recebido na negociação.
                                            </p>

                                            <div className="mt-5 rounded-[22px] border border-black/10 bg-[#fafafa] px-4 py-4">
                                                <label className="inline-flex items-center gap-2 text-sm font-medium text-black/70">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.consigned}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                consigned: event.target.checked,
                                                                consignedOwnerName: event.target.checked ? current.consignedOwnerName : "",
                                                                consignmentCommissionPercentage: event.target.checked ? current.consignmentCommissionPercentage : "",
                                                            }))
                                                        }
                                                    />
                                                    Veículo consignado?
                                                </label>

                                                {form.consigned ? (
                                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                        <Field
                                                            label="Nome do dono/empresa"
                                                            value={form.consignedOwnerName}
                                                            onChange={(value) => updateField("consignedOwnerName", value)}
                                                            placeholder="Ex.: Auto XYZ ou Joao Silva"
                                                            required
                                                        />
                                                        <Field
                                                            label="% de comissão da empresa"
                                                            value={form.consignmentCommissionPercentage}
                                                            onChange={(value) => updateField("consignmentCommissionPercentage", value.replace(",", ".").replace(/[^0-9.]/g, ""))}
                                                            placeholder="Opcional"
                                                            inputMode="decimal"
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        </section>

                                        <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                            <div>
                                                <p className="text-sm font-semibold text-io-dark">Distribuição</p>
                                                <p className="mt-1 text-sm text-black/52">Apenas integrações conectadas e prontas para publicação aparecem aqui.</p>
                                            </div>

                                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                {readyPublicationIntegrations.length ? (
                                                    readyPublicationIntegrations.map((integration) => {
                                                        const selected = form.targetIntegrations.some(
                                                            (providerKey) =>
                                                                canonicalPublicationProviderKey(providerKey) === canonicalPublicationProviderKey(integration.providerKey)
                                                        );
                                                        return (
                                                            <label
                                                                key={integration.providerKey}
                                                                className={`rounded-2xl border px-4 py-3 text-sm transition ${
                                                                    selected ? "border-white bg-black text-white" : "border-black/10 bg-[#f7f7f7] text-black/70 hover:border-black/20"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selected}
                                                                        onChange={(event) => {
                                                                            const normalizedProvider = canonicalPublicationProviderKey(integration.providerKey);
                                                                            const remaining = form.targetIntegrations.filter(
                                                                                (providerKey) => canonicalPublicationProviderKey(providerKey) !== normalizedProvider
                                                                            );
                                                                            const next = event.target.checked ? [...remaining, integration.providerKey] : remaining;
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
                                                    <p className="rounded-2xl bg-[#f7f7f7] px-4 py-4 text-sm text-black/55">
                                                        Nenhuma integração de publicação conectada no momento. Conecte um canal no módulo de integrações para habilitar a distribuição.
                                                    </p>
                                                )}
                                            </div>

                                            {requiresMeliPublication ? (
                                                <div className="mt-4 grid gap-4 rounded-2xl border border-[#d5c228] bg-[#fffdf0] p-4 md:grid-cols-2">
                                                    <SelectField
                                                        label="Tipo de anúncio (ML)"
                                                        value={form.meli.listingTypeId}
                                                        options={meliListingTypes.map((item) => ({
                                                            value: item.id,
                                                            label: item.remainingListings == null
                                                                ? `${item.name} (${item.id})`
                                                                : `${item.name} (${item.id}) - saldo ${item.remainingListings}`,
                                                        }))}
                                                        loading={loadingMeliListingTypes}
                                                        onChange={(next) => updateMeliField({ listingTypeId: next })}
                                                    />
                                                    <SelectField
                                                        label="Condição (ML)"
                                                        value={form.meli.condition || "used"}
                                                        options={[{ value: "used", label: "Usado" }, { value: "new", label: "Novo" }]}
                                                        onChange={(next) => updateMeliField({ condition: next })}
                                                    />
                                                </div>
                                            ) : null}
                                        </section>

                                        <section className="rounded-[30px] border border-[#c8d8ff] bg-white p-5 shadow-[0_10px_30px_rgba(49,89,184,0.08)]">
                                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#2b57d9]">Condições de financiamento</p>
                                                    <p className="mt-1 text-sm text-[#6d8de6]">Opcional: preencha se o veículo tiver parcelas disponíveis.</p>
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
                                                <TextArea
                                                    label="Descrição do anúncio"
                                                    value={form.description}
                                                    onChange={(value) => updateField("description", value)}
                                                    placeholder="Descreva versão, estado de conservação, histórico e destaques do carro."
                                                />
                                            </section>

                                            <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                                <TextArea
                                                    label="Opcionais e itens do veículo"
                                                    value={form.optionalsText}
                                                    onChange={(value) => updateField("optionalsText", value)}
                                                    placeholder="Ex.: multimídia, bancos em couro, câmera de ré, sensor de estacionamento"
                                                />
                                            </section>
                                        </div>

                                        <section className="rounded-[30px] border border-black/10 bg-white p-5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-io-dark">Imagens do veículo</p>
                                                    <p className="mt-1 text-sm text-black/50">Arraste e solte para enviar. Depois, arraste as miniaturas para organizar a ordem.</p>
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
                                                <p className="mt-4 text-sm font-semibold text-io-dark">{uploadingImages ? "Processando imagens..." : "Solte as imagens aqui"}</p>
                                                <p className="mt-2 text-sm text-black/52">Até 20 imagens PNG, JPG, WEBP, GIF ou AVIF, otimizadas automaticamente. A primeira vira a capa.</p>
                                            </div>

                                            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageInputChange} className="hidden" />

                                            {form.imageUrls.length ? (
                                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                    {form.imageUrls.map((imageUrl, index) => (
                                                        <div
                                                            key={imageUrl}
                                                            draggable
                                                            onDragStart={(event) => handleImageCardDragStart(event, imageUrl)}
                                                            onDragOver={(event) => handleImageCardDragOver(event, imageUrl)}
                                                            onDrop={(event) => handleImageCardDrop(event, imageUrl)}
                                                            onDragEnd={handleImageCardDragEnd}
                                                            className={`overflow-hidden rounded-[24px] border bg-white transition ${
                                                                dragOverImageUrl === imageUrl && draggedImageUrl !== imageUrl
                                                                    ? "border-[#2b57d9] ring-2 ring-[#2b57d9]/15"
                                                                    : "border-black/10"
                                                            } ${draggedImageUrl === imageUrl ? "cursor-grabbing opacity-80" : "cursor-grab"}`}
                                                        >
                                                            <img src={imageUrl} alt={`Imagem ${index + 1}`} loading="lazy" decoding="async" className="h-40 w-full object-cover" />
                                                            <div className="flex items-center justify-between gap-2 px-3 py-3">
                                                                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/40">
                                                                    <GripVertical className="h-4 w-4" />
                                                                    <span>{index === 0 ? "Capa" : `Posição ${index + 1}`}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2 border-t border-black/6 px-3 py-3">
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

                                        {selectedReadyPublicationIntegrations.length ? (
                                            <section className="grid gap-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-io-dark">Ajustes avançados e publicação</p>
                                                    <p className="mt-1 text-sm text-black/52">Os dados principais já abastecem os canais escolhidos. Use estes cards apenas para revisar mapeamentos ou publicar.</p>
                                                </div>

                                                {selectedReadyPublicationIntegrations.some((integration) => ["olx", "olx-autos"].includes(normalizeProviderKey(integration.providerKey))) ? (
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
                                                ) : null}

                                            </section>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-6 py-5 md:px-8">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {form.id ? (
                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteVehicle()}
                                                disabled={!editorDetailsLoaded || deletingVehicle || saving || uploadingImages}
                                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {deletingVehicle ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                {deletingVehicle ? "Excluindo..." : "Excluir veículo"}
                                            </button>
                                        ) : null}
                                        <div className="text-xs text-black/45">{readyPublicationIntegrations.length} integrações conectadas prontas para uso na distribuição.</div>
                                    </div>
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
                                            disabled={!editorDetailsLoaded || saving || deletingVehicle || uploadingImages}
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

            {saleVehicle ? (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-4 sm:items-center sm:py-6">
                    <div className="my-2 w-full max-w-2xl overflow-y-auto rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:my-0 sm:max-h-[88vh]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/38">Venda pelo estoque</p>
                                <h3 className="mt-2 font-display text-[1.85rem] font-bold text-io-dark">Fechar venda do veículo</h3>
                                <p className="mt-2 text-sm text-black/55">
                                    Selecione o vendedor responsável para concluir a venda e disparar as regras automáticas do veículo vendido.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-black/60 transition hover:border-black/20 hover:text-io-dark"
                                aria-label="Fechar modal de venda"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-5 rounded-[24px] bg-black/[0.03] px-4 py-4">
                            <p className="text-sm font-semibold text-io-dark">{saleVehicle.title}</p>
                            <p className="mt-1 text-sm text-black/55">{buildVehicleSubtitle(saleVehicle)}</p>
                            <p className="mt-2 text-sm font-semibold text-io-dark">Valor padrão: {formatMoney(saleVehicle.priceCents)}</p>
                            {saleVehicle.tradeInPriceCents != null ? (
                                <p className="mt-1 text-sm font-semibold text-io-purple">Valor de troca: {formatMoney(saleVehicle.tradeInPriceCents)}</p>
                            ) : null}
                            {saleVehicle.consigned ? (
                                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                                    Consignado • {saleVehicle.consignedOwnerName ?? "Dono não informado"}
                                </p>
                            ) : null}
                        </div>

                        <div className="mt-5 grid gap-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Vendedor responsável</label>
                            <select
                                value={saleSellerUserId}
                                onChange={(event) => setSaleSellerUserId(event.target.value)}
                                disabled={saleContextLoading}
                                className="rounded-[22px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                            >
                                <option value="">{saleContextLoading ? "Carregando vendedores..." : "Selecione um vendedor"}</option>
                                {teamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.fullName}{member.teamName ? ` • ${member.teamName}` : ""}
                                    </option>
                                ))}
                            </select>
                            {!saleContextLoading && !teamMembers.length ? <p className="text-xs text-black/45">Nenhum membro da equipe foi encontrado para vincular a venda.</p> : null}
                        </div>

                        <div className="mt-5 grid gap-4 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
                            <div className="grid gap-2 md:grid-cols-2">
                                <label className="grid gap-2">
                                    <span className="text-xs uppercase tracking-[0.18em] text-black/40">Desconto (%)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.01"
                                        value={saleFinancial.discountPercentage}
                                        onChange={(event) => setSaleFinancial((current) => ({ ...current, discountPercentage: event.target.value }))}
                                        className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                    />
                                </label>
                                <div className="grid gap-1 rounded-[18px] border border-black/8 bg-white px-4 py-3">
                                    <span className="text-xs uppercase tracking-[0.18em] text-black/35">Valor do desconto</span>
                                    <span className="text-sm font-semibold text-io-dark">{formatMoney(saleFinancialPreview.discountAmountCents)}</span>
                                </div>
                            </div>

                            <label className="inline-flex items-center gap-2 text-sm font-medium text-black/65">
                                <input
                                    type="checkbox"
                                    checked={saleFinancial.hasTradeInVehicle}
                                    onChange={(event) => setSaleFinancial((current) => ({ ...current, hasTradeInVehicle: event.target.checked }))}
                                />
                                Houve troca de veículo
                            </label>

                            {saleFinancial.hasTradeInVehicle ? (
                                <div className="grid gap-2 md:grid-cols-2">
                                    <label className="grid gap-2">
                                        <span className="text-xs uppercase tracking-[0.18em] text-black/40">Veículo recebido</span>
                                        <input
                                            type="text"
                                            value={saleFinancial.tradeInVehicleDescription}
                                            onChange={(event) => setSaleFinancial((current) => ({ ...current, tradeInVehicleDescription: event.target.value }))}
                                            placeholder="Ex.: Gol 1.0 2012"
                                            className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        />
                                    </label>
                                    <label className="grid gap-2">
                                        <span className="text-xs uppercase tracking-[0.18em] text-black/40">Valor do veículo recebido</span>
                                        <input
                                            type="text"
                                            value={formatCurrencyInput(saleFinancial.tradeInAmountDigits)}
                                            onChange={(event) =>
                                                setSaleFinancial((current) => ({ ...current, tradeInAmountDigits: normalizeCurrencyDigits(event.target.value) }))
                                            }
                                            className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        />
                                    </label>
                                </div>
                            ) : null}

                            <label className="inline-flex items-center gap-2 text-sm font-medium text-black/65">
                                <input
                                    type="checkbox"
                                    checked={saleFinancial.installmentSale}
                                    onChange={(event) => setSaleFinancial((current) => ({ ...current, installmentSale: event.target.checked }))}
                                />
                                Venda parcelada
                            </label>

                            {saleFinancial.installmentSale ? (
                                <div className="grid gap-2 md:grid-cols-2">
                                    <label className="grid gap-2">
                                        <span className="text-xs uppercase tracking-[0.18em] text-black/40">Quantidade de parcelas</span>
                                        <input
                                            type="number"
                                            min={2}
                                            value={saleFinancial.installmentCount}
                                            onChange={(event) => setSaleFinancial((current) => ({ ...current, installmentCount: event.target.value }))}
                                            className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        />
                                    </label>
                                    <label className="grid gap-2">
                                        <span className="text-xs uppercase tracking-[0.18em] text-black/40">Primeiro vencimento</span>
                                        <input
                                            type="date"
                                            value={saleFinancial.firstInstallmentDueDate}
                                            onChange={(event) => setSaleFinancial((current) => ({ ...current, firstInstallmentDueDate: event.target.value }))}
                                            className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        />
                                    </label>
                                </div>
                            ) : null}

                            {saleFinancialPreview.consigned ? (
                                <div className="grid gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Venda de veículo consignado</p>
                                    <p className="text-sm text-amber-900">
                                        Dono/empresa: <span className="font-semibold">{saleFinancialPreview.consignedOwnerName ?? "Não informado"}</span>
                                    </p>
                                    <p className="text-sm text-amber-900">
                                        Comissão cadastrada:{" "}
                                        <span className="font-semibold">
                                            {saleFinancialPreview.configuredConsignmentCommissionPercentage != null
                                                ? `${saleFinancialPreview.configuredConsignmentCommissionPercentage}%`
                                                : "Não informada"}
                                        </span>
                                    </p>

                                    <label className="grid gap-2">
                                        <span className="text-xs uppercase tracking-[0.18em] text-amber-800">Tipo de comissão</span>
                                        <select
                                            value={saleFinancial.consignmentCommissionType || ""}
                                            onChange={(event) =>
                                                setSaleFinancial((current) => ({
                                                    ...current,
                                                    consignmentCommissionType: event.target.value as "" | "PERCENTUAL" | "VALOR_FIXO",
                                                }))
                                            }
                                            className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="PERCENTUAL">Percentual</option>
                                            <option value="VALOR_FIXO">Valor fixo</option>
                                        </select>
                                    </label>

                                    {(saleFinancial.consignmentCommissionType || saleFinancialPreview.consignmentCommissionType) === "PERCENTUAL" ? (
                                        <label className="grid gap-2">
                                            <span className="text-xs uppercase tracking-[0.18em] text-amber-800">Percentual de comissão (%)</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.01"
                                                value={saleFinancial.consignmentCommissionPercentage}
                                                onChange={(event) =>
                                                    setSaleFinancial((current) => ({ ...current, consignmentCommissionPercentage: event.target.value }))
                                                }
                                                className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                            />
                                        </label>
                                    ) : null}

                                    {(saleFinancial.consignmentCommissionType || saleFinancialPreview.consignmentCommissionType) === "VALOR_FIXO" ? (
                                        <label className="grid gap-2">
                                            <span className="text-xs uppercase tracking-[0.18em] text-amber-800">Valor da comissão</span>
                                            <input
                                                type="text"
                                                value={formatCurrencyInput(saleFinancial.consignmentCommissionAmountDigits)}
                                                onChange={(event) =>
                                                    setSaleFinancial((current) => ({
                                                        ...current,
                                                        consignmentCommissionAmountDigits: normalizeCurrencyDigits(event.target.value),
                                                    }))
                                                }
                                                className="rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                            />
                                        </label>
                                    ) : null}

                                    <p className="text-sm text-amber-900">
                                        Base de cálculo: <span className="font-semibold">{formatMoney(saleFinancialPreview.consignmentBaseAmountCents)}</span>
                                    </p>
                                    <p className="text-sm text-amber-900">
                                        Valor da comissão: <span className="font-semibold">{formatMoney(saleFinancialPreview.consignmentCommissionAmountCents)}</span>
                                    </p>
                                    <p className="text-sm text-amber-900">
                                        Repasse estimado ao proprietário: <span className="font-semibold">{formatMoney(saleFinancialPreview.consignmentOwnerTransferAmountCents)}</span>
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-4 grid gap-2 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            <p>
                                Valor aplicado{saleFinancial.hasTradeInVehicle && saleVehicle.tradeInPriceCents ? " (condição de troca)" : " (padrão)"}: {" "}
                                <span className="font-semibold">{formatMoney(saleFinancialPreview.originalAmountCents)}</span>
                            </p>
                            <p>Desconto: <span className="font-semibold">{saleFinancialPreview.discountPercentage}% ({formatMoney(saleFinancialPreview.discountAmountCents)})</span></p>
                            <p>Valor com desconto: <span className="font-semibold">{formatMoney(saleFinancialPreview.amountAfterDiscountCents)}</span></p>
                            <p>Veículo recebido: <span className="font-semibold">{formatMoney(saleFinancialPreview.tradeInAmountCents)}</span></p>
                            <p>Total real da venda: <span className="font-semibold">{formatMoney(saleFinancialPreview.totalRealAmountCents)}</span></p>
                            <p>Consignado: <span className="font-semibold">{saleFinancialPreview.consigned ? "Sim" : "Não"}</span></p>
                            {saleFinancialPreview.consigned ? (
                                <>
                                    <p>Dono/empresa: <span className="font-semibold">{saleFinancialPreview.consignedOwnerName ?? "Não informado"}</span></p>
                                    <p>Comissão da empresa: <span className="font-semibold">{formatMoney(saleFinancialPreview.consignmentCommissionAmountCents)}</span></p>
                                    <p>Repasse ao proprietário: <span className="font-semibold">{formatMoney(saleFinancialPreview.consignmentOwnerTransferAmountCents)}</span></p>
                                </>
                            ) : null}
                            <p>
                                Pagamento:{" "}
                                <span className="font-semibold">
                                    {saleFinancial.installmentSale ? `Parcelado em ${saleFinancialPreview.installmentCount}x` : "A vista"}
                                </span>
                            </p>
                            {saleFinancial.installmentSale ? (
                                <div className="rounded-[14px] border border-emerald-200 bg-white px-3 py-2">
                                    <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Preview de parcelas</p>
                                    <div className="mt-2 grid gap-1 text-xs text-emerald-900">
                                        {saleFinancialPreview.installments.slice(0, 6).map((installment) => (
                                            <p key={`${installment.installmentNumber}-${installment.dueDate}`}>
                                                {`Parcela ${installment.installmentNumber}/${installment.totalInstallments}: ${formatMoney(installment.amountCents)} - ${formatShortDate(installment.dueDate)}`}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {requiresBuyerLead ? (
                            <div className="mt-5 grid gap-4">
                                <div className="grid gap-2">
                                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Comprador vinculado</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSaleBuyerMode("EXISTING")}
                                            className={`inline-flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                                                saleBuyerMode === "EXISTING" ? "border-io-purple bg-[#f6efff] text-io-purple" : "border-black/10 text-black/65 hover:border-black/18 hover:text-io-dark"
                                            }`}
                                        >
                                            Lead existente
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSaleBuyerMode("NEW")}
                                            className={`inline-flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                                                saleBuyerMode === "NEW" ? "border-io-purple bg-[#f6efff] text-io-purple" : "border-black/10 text-black/65 hover:border-black/18 hover:text-io-dark"
                                            }`}
                                        >
                                            Novo lead
                                        </button>
                                    </div>
                                </div>

                                {saleBuyerMode === "EXISTING" ? (
                                    <div className="grid gap-2">
                                        <select
                                            value={saleBuyerConversationId}
                                            onChange={(event) => setSaleBuyerConversationId(event.target.value)}
                                            disabled={saleContextLoading}
                                            className="rounded-[22px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                                        >
                                            <option value="">{saleContextLoading ? "Carregando leads..." : "Selecione um lead comprador"}</option>
                                            {saleConversations.map((conversation) => (
                                                <option key={conversation.id} value={conversation.id}>
                                                    {(conversation.displayName || "Lead sem nome")}
                                                    {conversation.phone ? ` • ${formatPhoneInput(conversation.phone)}` : ""}
                                                    {conversation.sourcePlatform ? ` • ${platformLabel(conversation.sourcePlatform)}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {!saleContextLoading && !saleConversations.length ? <p className="text-xs text-black/45">Nenhum lead foi encontrado. Use a opção de criar novo lead para vincular o comprador.</p> : null}
                                    </div>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field
                                            label="Nome do comprador"
                                            value={saleBuyerName}
                                            onChange={setSaleBuyerName}
                                            placeholder="Ex.: João da Silva"
                                            required
                                        />
                                        <Field
                                            label="Telefone do comprador"
                                            value={saleBuyerPhone}
                                            onChange={(value) => setSaleBuyerPhone(formatPhoneInput(value))}
                                            placeholder="(11) 99999-9999"
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {saleMessage ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saleMessage}</div> : null}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="inline-flex h-12 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-semibold text-black/68 transition hover:border-black/20 hover:text-io-dark"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseSale}
                                disabled={saleSubmitting || saleContextLoading || !teamMembers.length}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/20"
                            >
                                {saleSubmitting || saleContextLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Concluir venda
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function InventoryLoadingState() {
    return (
        <section
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="overflow-hidden rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-6"
        >
            <div className="flex items-center gap-4 border-b border-black/[0.06] pb-5">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f6efff] text-io-purple">
                    <span className="absolute inset-2 animate-ping rounded-xl bg-io-purple/10" />
                    <CarFront className="relative h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-io-dark">Preparando seu estoque</p>
                    <p className="mt-1 text-xs text-black/45">Organizando veículos e informações de publicação...</p>
                </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div
                        key={index}
                        aria-hidden="true"
                        className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-3"
                    >
                        <div className="io-inventory-shimmer h-44 rounded-[22px]" />
                        <div className="space-y-3 px-2 pb-3 pt-5">
                            <div className="io-inventory-shimmer h-5 w-3/4 rounded-full" />
                            <div className="io-inventory-shimmer h-3 w-1/2 rounded-full" />
                            <div className="flex gap-2 pt-1">
                                <div className="io-inventory-shimmer h-8 w-20 rounded-full" />
                                <div className="io-inventory-shimmer h-8 w-24 rounded-full" />
                            </div>
                            <div className="io-inventory-shimmer mt-5 h-7 w-2/3 rounded-full" />
                            <div className="io-inventory-shimmer h-11 w-full rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function InventoryVehicleCard({
    vehicle,
    editing,
    onEdit,
    onCloseSale,
}: {
    vehicle: VehicleRecord;
    editing: boolean;
    onEdit: () => void;
    onCloseSale: () => void;
}) {
    const imageUrl = getVehicleImage(vehicle);
    const isSold = String(vehicle.status ?? "").trim().toUpperCase() === "SOLD";

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-black/10 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
            <div className="relative overflow-hidden rounded-[24px] bg-[#f1eee8]">
                {imageUrl ? (
                    <img src={imageUrl} alt={vehicle.title} loading="lazy" decoding="async" className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
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
                    <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-black/[0.04] px-3 py-2 text-[11px] font-semibold text-black/55">{statusLabel(vehicle.status)}</span>
                        {vehicle.consigned ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                Consignado
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-black/56">
                    <MetaItem icon={<CalendarDays className="h-4 w-4" />} text={formatVehicleYears(vehicle)} />
                    <MetaItem icon={<Gauge className="h-4 w-4" />} text={formatMileage(vehicle.mileage)} />
                </div>

                {vehicle.consigned ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <p>Dono/empresa: <span className="font-semibold">{vehicle.consignedOwnerName ?? "Não informado"}</span></p>
                        {vehicle.consignmentCommissionPercentage != null ? (
                            <p className="mt-1">Comissão: <span className="font-semibold">{vehicle.consignmentCommissionPercentage}%</span></p>
                        ) : null}
                    </div>
                ) : null}



                <div className="mt-auto flex flex-col gap-5 pt-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/36">Valor padrão</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight text-io-dark">{formatMoney(vehicle.priceCents)}</p>
                        {vehicle.tradeInPriceCents != null ? (
                            <p className="mt-2 text-sm font-semibold text-io-purple">Na troca: {formatMoney(vehicle.tradeInPriceCents)}</p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-black/35 font-medium">Atualizado em {formatDateTime(vehicle.updatedAt)}</p>
                    </div>

                    {!isSold ? (
                        <button
                            type="button"
                            onClick={onCloseSale}
                            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-sm font-semibold text-white transition hover:brightness-110 shadow-sm"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Fechar venda
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={onEdit}
                        disabled={editing}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white shadow-sm transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-70"
                    >
                        {editing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                        {editing ? "Carregando..." : "Editar veículo"}
                    </button>
                </div>
            </div>
        </article>
    );
}

function StockTabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-12 items-center gap-3 rounded-full border px-4 text-sm font-semibold transition ${
                active ? "border-io-purple bg-[#f6efff] text-io-purple" : "border-black/10 bg-white text-black/65 hover:border-black/18 hover:text-io-dark"
            }`}
        >
            <span>{label}</span>
            <span
                className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs ${
                    active ? "bg-white text-io-purple" : "bg-black/[0.05] text-black/55"
                }`}
            >
                {count}
            </span>
        </button>
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
    placeholder = "",
    inputMode,
    maxLength,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    placeholder?: string;
    inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
    maxLength?: number;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
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

function TextArea({
    label,
    value,
    onChange,
    placeholder = "",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={8}
                placeholder={placeholder}
                className="min-h-56 rounded-[24px] border border-black/10 bg-[#f7f7f7] px-4 py-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
    loading = false,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    loading?: boolean;
}) {
    return (
        <label className="grid gap-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-black/60">{label}</span>
                {loading ? <LoaderCircle className="h-3 w-3 animate-spin text-black/40" /> : null}
            </div>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={loading}
                className="h-12 w-full appearance-none rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white disabled:opacity-60"
            >
                <option value="" disabled>Selecione...</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}


