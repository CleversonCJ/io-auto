"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, LoaderCircle, PauseCircle, PlayCircle, RefreshCw, Search, Send, ShieldAlert, StopCircle } from "lucide-react";
import type {
    MeliAdRecord,
    MeliCategoryAttributeRecord,
    MeliCategoryRecord,
    MeliCategorySuggestion,
    MeliListingTypeRecord,
    MeliVehicleAttributeValue,
    MeliVehicleMapping,
} from "@/modules/ioauto/types";
import { formatDateTime, statusLabel } from "@/modules/ioauto/formatters";

const AUTO_ATTRIBUTE_IDS = new Set([
    "BRAND",
    "MODEL",
    "TRIM",
    "VEHICLE_YEAR",
    "KILOMETERS",
    "FUEL_TYPE",
    "COLOR",
    "BODY_TYPE",
    "TRANSMISSION",
]);

export type MeliVehicleFormState = {
    categoryId: string;
    listingTypeId: string;
    condition: string;
    sellerSku: string;
    title: string;
    description: string;
    priceCents: string;
    attributes: MeliVehicleAttributeValue[];
    ad: MeliAdRecord | null;
};

type MainSummary = {
    brand: string;
    model: string;
    version: string;
    year: string;
    mileage: string;
    priceCents: string;
    description: string;
    imageCount: number;
};

type Props = {
    vehicleId?: string;
    value: MeliVehicleFormState;
    mainSummary: MainSummary;
    onHydrate: (mapping: MeliVehicleMapping) => void;
    onChange: (partial: Partial<MeliVehicleFormState>) => void;
};

export function emptyMeliVehicleForm(): MeliVehicleFormState {
    return {
        categoryId: "",
        listingTypeId: "",
        condition: "used",
        sellerSku: "",
        title: "",
        description: "",
        priceCents: "",
        attributes: [],
        ad: null,
    };
}

export function MeliVehiclePanel({ vehicleId, value, mainSummary, onHydrate, onChange }: Props) {
    const [categories, setCategories] = useState<MeliCategoryRecord[]>([]);
    const [categoryAttributes, setCategoryAttributes] = useState<MeliCategoryAttributeRecord[]>([]);
    const [listingTypes, setListingTypes] = useState<MeliListingTypeRecord[]>([]);
    const [categorySearch, setCategorySearch] = useState("");
    const [suggestion, setSuggestion] = useState<MeliCategorySuggestion | null>(null);
    const [loadingMapping, setLoadingMapping] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [loadingAttributes, setLoadingAttributes] = useState(false);
    const [loadingListingTypes, setLoadingListingTypes] = useState(false);
    const [action, setAction] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mappedAttributes = useMemo(() => {
        return new Map(value.attributes.map((item) => [item.id.trim().toUpperCase(), item]));
    }, [value.attributes]);

    useEffect(() => {
        if (!vehicleId) return;
        void loadMapping(vehicleId);
    }, [vehicleId]);

    async function loadMapping(currentVehicleId: string) {
        setLoadingMapping(true);
        setError(null);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/vehicles/${currentVehicleId}/mapping`, { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as MeliVehicleMapping | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao carregar os dados Mercado Livre do veículo.");
            }
            const mapping = payload as MeliVehicleMapping;
            onHydrate(mapping);
            setCategorySearch(mapping.categoryId ?? "");
            if (mapping.categoryId) {
                await loadCategoryResources(mapping.categoryId);
            } else {
                setCategoryAttributes([]);
                setListingTypes([]);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar os dados Mercado Livre do veículo.");
        } finally {
            setLoadingMapping(false);
        }
    }

    async function persistMapping() {
        if (!vehicleId) return;
        const response = await fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/mapping`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                categoryId: value.categoryId || null,
                listingTypeId: value.listingTypeId || null,
                condition: value.condition || null,
                sellerSku: value.sellerSku || null,
                title: value.title || null,
                description: value.description || null,
                priceCents: value.priceCents ? Number(value.priceCents) : null,
                attributes: value.attributes,
            }),
        });
        const payload = (await response.json().catch(() => null)) as MeliVehicleMapping | { message?: string } | null;
        if (!response.ok) {
            throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao salvar a configuração Mercado Livre do veículo.");
        }
        onHydrate(payload as MeliVehicleMapping);
    }

    async function loadCategories(searchText = categorySearch) {
        setLoadingCategories(true);
        setError(null);
        try {
            const query = searchText.trim() ? `?search=${encodeURIComponent(searchText.trim())}` : "";
            const response = await fetch(`/api/integrations/mercadolivre/categories${query}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as MeliCategoryRecord[] | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao carregar as categorias do Mercado Livre.");
            }
            setCategories(payload as MeliCategoryRecord[]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar as categorias do Mercado Livre.");
        } finally {
            setLoadingCategories(false);
        }
    }

    async function suggestCategory() {
        const title = value.title.trim();
        if (!title) {
            setError("Preencha o título do anúncio para sugerir uma categoria.");
            return;
        }
        setAction("suggest-category");
        setError(null);
        setMessage(null);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/categories/discover?title=${encodeURIComponent(title)}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as MeliCategorySuggestion | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao sugerir uma categoria do Mercado Livre.");
            }
            setSuggestion(payload as MeliCategorySuggestion);
            if ((payload as MeliCategorySuggestion | null)?.categoryId) {
                setMessage(`Categoria sugerida: ${(payload as MeliCategorySuggestion).categoryName}. Confirme antes de publicar.`);
            } else {
                setMessage("Nenhuma categoria sugerida pelo Mercado Livre para este título.");
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao sugerir uma categoria do Mercado Livre.");
        } finally {
            setAction(null);
        }
    }

    async function loadCategoryResources(categoryId: string) {
        if (!categoryId.trim()) {
            setCategoryAttributes([]);
            setListingTypes([]);
            return;
        }
        await Promise.all([loadCategoryAttributes(categoryId), loadListingTypes(categoryId)]);
    }

    async function syncCategoryResources(categoryId: string) {
        const normalized = categoryId.trim();
        if (!normalized) {
            setError("Selecione uma categoria do Mercado Livre.");
            return;
        }
        setAction("sync-category");
        setError(null);
        setMessage(null);
        try {
            const [categoryResponse, attributeResponse] = await Promise.all([
                fetch(`/api/integrations/mercadolivre/categories/${encodeURIComponent(normalized)}/sync`, { method: "POST" }),
                fetch(`/api/integrations/mercadolivre/categories/${encodeURIComponent(normalized)}/attributes/sync`, { method: "POST" }),
            ]);
            const categoryPayload = await categoryResponse.json().catch(() => null);
            const attributePayload = await attributeResponse.json().catch(() => null);
            if (!categoryResponse.ok) {
                throw new Error((categoryPayload as { message?: string } | null)?.message ?? "Falha ao sincronizar a categoria Mercado Livre.");
            }
            if (!attributeResponse.ok) {
                throw new Error((attributePayload as { message?: string } | null)?.message ?? "Falha ao sincronizar os atributos da categoria.");
            }
            await loadCategories(normalized);
            await loadCategoryResources(normalized);
            setMessage("Categoria e atributos do Mercado Livre sincronizados para este veículo.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao sincronizar a categoria Mercado Livre.");
        } finally {
            setAction(null);
        }
    }

    async function loadCategoryAttributes(categoryId: string) {
        setLoadingAttributes(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/categories/${encodeURIComponent(categoryId)}/attributes`, { cache: "no-store" });
            if (response.ok) {
                setCategoryAttributes((await response.json()) as MeliCategoryAttributeRecord[]);
            } else {
                setCategoryAttributes([]);
            }
        } finally {
            setLoadingAttributes(false);
        }
    }

    async function loadListingTypes(categoryId: string) {
        setLoadingListingTypes(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/listing-types?categoryId=${encodeURIComponent(categoryId)}`, { cache: "no-store" });
            if (response.ok) {
                setListingTypes((await response.json()) as MeliListingTypeRecord[]);
            } else {
                setListingTypes([]);
            }
        } finally {
            setLoadingListingTypes(false);
        }
    }

    async function applyCategory(categoryId: string) {
        setCategorySearch(categoryId);
        onChange({ categoryId, listingTypeId: "" });
        setSuggestion(null);
        await loadCategoryResources(categoryId);
    }

    async function runAction(
        nextAction: string,
        requestFactory: () => Promise<Response>,
        options?: { persistMapping?: boolean; successMessage?: string },
    ) {
        if (!vehicleId) return;
        setAction(nextAction);
        setError(null);
        setMessage(null);
        try {
            if (options?.persistMapping) {
                await persistMapping();
            }
            const response = await requestFactory();
            const payload = (await response.json().catch(() => null)) as MeliAdRecord | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao processar o anúncio do Mercado Livre.");
            }
            const ad = payload as MeliAdRecord;
            onChange({ ad });
            setMessage(options?.successMessage ?? `Status Mercado Livre atualizado: ${statusLabel(ad.status)}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao processar o anúncio do Mercado Livre.");
        } finally {
            setAction(null);
        }
    }

    function updateAttribute(attributeId: string, partial: Partial<MeliVehicleAttributeValue>) {
        const normalized = attributeId.trim().toUpperCase();
        const current = value.attributes.find((item) => item.id.trim().toUpperCase() === normalized) ?? {
            id: normalized,
            valueId: null,
            valueName: null,
        };
        const next: MeliVehicleAttributeValue = {
            id: normalized,
            valueId: partial.valueId ?? current.valueId ?? null,
            valueName: partial.valueName ?? current.valueName ?? null,
        };
        const hasValue = Boolean(next.valueId?.trim() || next.valueName?.trim());
        const remaining = value.attributes.filter((item) => item.id.trim().toUpperCase() !== normalized);
        onChange({
            attributes: hasValue ? [...remaining, next] : remaining,
        });
    }

    function resolveInheritedValue(attributeId: string) {
        const normalized = attributeId.trim().toUpperCase();
        if (normalized === "BRAND") return mainSummary.brand;
        if (normalized === "MODEL") return mainSummary.model;
        if (normalized === "TRIM") return mainSummary.version;
        if (normalized === "VEHICLE_YEAR") return mainSummary.year;
        if (normalized === "KILOMETERS") return mainSummary.mileage ? `${mainSummary.mileage} km` : "";
        return "";
    }

    return (
        <section className="rounded-[30px] border border-black/10 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-io-dark">Anúncio Mercado Livre</p>
                    <p className="mt-1 text-sm text-black/52">
                        Categoria, tipo de anúncio, descrição e atributos específicos ficam aqui. Marca, modelo, ano, quilometragem e imagens saem do cadastro principal.
                    </p>
                </div>
                <div className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-black/50">
                    {value.ad?.status ? statusLabel(value.ad.status) : "Não publicado"}
                </div>
            </div>

            {error ? <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryBox label="Marca / modelo" value={[mainSummary.brand, mainSummary.model].filter(Boolean).join(" ") || "-"} />
                <SummaryBox label="Ano" value={mainSummary.year || "-"} />
                <SummaryBox label="Quilometragem" value={mainSummary.mileage ? `${mainSummary.mileage} km` : "-"} />
                <SummaryBox label="Imagens públicas" value={String(mainSummary.imageCount)} />
            </div>

            <div className="mt-6 rounded-[24px] border border-black/8 bg-[#faf8f4] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Field
                        label="Buscar categorias salvas"
                        value={categorySearch}
                        onChange={setCategorySearch}
                        placeholder="Ex.: carros, camionetas ou MLB1234"
                        className="lg:flex-1"
                    />
                    <div className="flex flex-wrap gap-3">
                        <SecondaryButton
                            label="Buscar"
                            icon={<Search className="h-4 w-4" />}
                            loading={loadingCategories}
                            onClick={() => void loadCategories()}
                        />
                        <SecondaryButton
                            label="Sugerir categoria"
                            icon={<ShieldAlert className="h-4 w-4" />}
                            loading={action === "suggest-category"}
                            onClick={() => void suggestCategory()}
                        />
                        <SecondaryButton
                            label="Sincronizar categoria"
                            icon={<RefreshCw className="h-4 w-4" />}
                            loading={action === "sync-category"}
                            onClick={() => void syncCategoryResources(value.categoryId)}
                            disabled={!value.categoryId}
                        />
                    </div>
                </div>

                {suggestion?.categoryId ? (
                    <button
                        type="button"
                        onClick={() => void applyCategory(suggestion.categoryId)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d5c228] bg-[#fff2a8] px-4 py-2 text-sm font-semibold text-[#463b03] transition hover:bg-[#ffe97b]"
                    >
                        Aplicar sugestao: {suggestion.categoryName} ({suggestion.categoryId})
                    </button>
                ) : null}

                {categories.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {categories.slice(0, 10).map((category) => {
                            const selected = value.categoryId === category.categoryId;
                            return (
                                <button
                                    key={category.categoryId}
                                    type="button"
                                    onClick={() => void applyCategory(category.categoryId)}
                                    className={`rounded-full border px-3 py-2 text-left text-xs font-semibold transition ${
                                        selected
                                            ? "border-[#d5c228] bg-[#fff2a8] text-[#463b03]"
                                            : "border-black/10 bg-white text-black/65 hover:border-black/20 hover:text-io-dark"
                                    }`}
                                >
                                    {category.name} <span className="text-black/45">({category.categoryId})</span>
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Categoria Mercado Livre" value={value.categoryId} onChange={(next) => onChange({ categoryId: next })} />
                <SelectField
                    label="Tipo de anúncio"
                    value={value.listingTypeId}
                    options={listingTypes.map((item) => ({
                        value: item.id,
                        label: item.remainingListings == null ? `${item.name} (${item.id})` : `${item.name} (${item.id}) - saldo ${item.remainingListings}`,
                    }))}
                    loading={loadingListingTypes}
                    onChange={(next) => onChange({ listingTypeId: next })}
                />
                <SelectField
                    label="Condição"
                    value={value.condition || "used"}
                    options={[
                        { value: "used", label: "Usado" },
                        { value: "new", label: "Novo" },
                    ]}
                    onChange={(next) => onChange({ condition: next })}
                />
                <Field label="SKU interno" value={value.sellerSku} onChange={(next) => onChange({ sellerSku: next.toUpperCase() })} />
                <Field label="Título do anúncio" value={value.title} onChange={(next) => onChange({ title: next })} placeholder="Ex.: Chevrolet Onix 1.0 LT 2020" />
                <MoneyField label="Preço Mercado Livre" value={value.priceCents} onChange={(next) => onChange({ priceCents: next })} />
            </div>

            <div className="mt-4">
                <TextArea
                    label="Descrição do anúncio"
                    value={value.description}
                    onChange={(next) => onChange({ description: next })}
                    placeholder={mainSummary.description || "Descrição usada no Mercado Livre"}
                />
            </div>

            <div className="mt-6 rounded-[24px] border border-black/8 bg-[#fafafa] p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-io-dark">Atributos da categoria</p>
                        <p className="mt-1 text-sm text-black/52">Os campos obrigatórios dependem da categoria escolhida. Atributos base como marca, modelo e ano continuam vindo do cadastro principal.</p>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
                        {loadingAttributes ? "Carregando..." : `${categoryAttributes.length} atributos`}
                    </div>
                </div>

                {categoryAttributes.length ? (
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {categoryAttributes.map((attribute) => {
                            const current = mappedAttributes.get(attribute.attributeId.trim().toUpperCase());
                            const inheritedValue = resolveInheritedValue(attribute.attributeId);
                            const isAuto = AUTO_ATTRIBUTE_IDS.has(attribute.attributeId.trim().toUpperCase());
                            return (
                                <div key={attribute.attributeId} className="rounded-2xl border border-black/8 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-io-dark">{attribute.name}</p>
                                            <p className="mt-1 text-xs text-black/45">{attribute.attributeId}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {attribute.required || attribute.catalogRequired ? (
                                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">Obrigatório</span>
                                            ) : null}
                                            {isAuto ? (
                                                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black/55">Herdado</span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {attribute.allowedValues.length ? (
                                        <label className="mt-3 grid gap-2">
                                            <span className="text-xs font-medium text-black/55">Valor</span>
                                            <select
                                                value={current?.valueId ?? current?.valueName ?? ""}
                                                onChange={(event) => {
                                                    const selected = attribute.allowedValues.find((item) => (item.id || item.name) === event.target.value);
                                                    updateAttribute(attribute.attributeId, {
                                                        valueId: selected?.id ?? null,
                                                        valueName: selected?.name ?? null,
                                                    });
                                                }}
                                                className="h-11 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
                                            >
                                                <option value="">Selecione</option>
                                                {attribute.allowedValues.map((allowed) => (
                                                    <option key={allowed.id || allowed.name} value={allowed.id || allowed.name}>
                                                        {allowed.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    ) : (
                                        <Field
                                            label="Valor"
                                            value={current?.valueName ?? ""}
                                            onChange={(next) => updateAttribute(attribute.attributeId, { valueId: null, valueName: next })}
                                            placeholder={inheritedValue || "Informe o valor"}
                                            className="mt-3"
                                        />
                                    )}

                                    {isAuto && inheritedValue ? (
                                        <p className="mt-2 text-xs text-black/45">Valor herdado do cadastro principal: {inheritedValue}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm text-black/55">
                        Escolha uma categoria e sincronize os atributos para validar o payload antes da publicação.
                    </p>
                )}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <ActionButton
                    label="Publicar"
                    icon={<Send className="h-4 w-4" />}
                    loading={action === "publish"}
                    disabled={!vehicleId}
                    onClick={() =>
                        void runAction(
                            "publish",
                            () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/publish`, { method: "POST" }),
                            { persistMapping: true, successMessage: "Veículo publicado no Mercado Livre." },
                        )
                    }
                />
                <ActionButton
                    label="Atualizar"
                    icon={<RefreshCw className="h-4 w-4" />}
                    loading={action === "update"}
                    disabled={!vehicleId || !value.ad?.meliItemId}
                    onClick={() =>
                        void runAction(
                            "update",
                            () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/ad`, { method: "PUT" }),
                            { persistMapping: true, successMessage: "Anúncio Mercado Livre atualizado." },
                        )
                    }
                />
                <ActionButton
                    label="Pausar"
                    icon={<PauseCircle className="h-4 w-4" />}
                    loading={action === "pause"}
                    disabled={!vehicleId || !value.ad?.meliItemId}
                    onClick={() => void runAction("pause", () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/ad/pause`, { method: "POST" }))}
                />
                <ActionButton
                    label="Reativar"
                    icon={<PlayCircle className="h-4 w-4" />}
                    loading={action === "activate"}
                    disabled={!vehicleId || !value.ad?.meliItemId}
                    onClick={() => void runAction("activate", () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/ad/activate`, { method: "POST" }))}
                />
                <ActionButton
                    label="Finalizar"
                    icon={<StopCircle className="h-4 w-4" />}
                    loading={action === "close"}
                    disabled={!vehicleId || !value.ad?.meliItemId}
                    onClick={() => void runAction("close", () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/ad/close`, { method: "POST" }))}
                />
                <ActionButton
                    label="Sincronizar"
                    icon={<RefreshCw className="h-4 w-4" />}
                    loading={action === "sync"}
                    disabled={!vehicleId || !value.ad?.meliItemId}
                    onClick={() => void runAction("sync", () => fetch(`/api/integrations/mercadolivre/vehicles/${vehicleId}/ad/sync`, { method: "POST" }))}
                />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                    href={value.ad?.permalink ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition ${
                        value.ad?.permalink ? "border-black/12 text-black/72 hover:border-black/20 hover:text-io-dark" : "pointer-events-none border-black/8 text-black/30"
                    }`}
                >
                    <ExternalLink className="h-4 w-4" />
                    Abrir anúncio no Mercado Livre
                </a>
                <div className="text-xs text-black/45">
                    última sincronização: {formatDateTime(value.ad?.lastSyncedAt)}
                </div>
            </div>

            {!vehicleId ? (
                <p className="mt-4 text-xs text-black/42">Salve o cadastro do veículo para persistir o mapeamento Mercado Livre e habilitar a publicação.</p>
            ) : null}

            {loadingMapping ? (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-black/48">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Carregando configuração Mercado Livre do veículo...
                </div>
            ) : null}
        </section>
    );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-black/8 bg-[#fafafa] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">{label}</p>
            <p className="mt-2 text-sm font-medium text-io-dark">{value}</p>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder = "",
    className = "",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <label className={`grid gap-2 ${className}`}>
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={formatCurrencyInput(value)}
                onChange={(event) => onChange(normalizeCurrencyDigits(event.target.value))}
                inputMode="numeric"
                placeholder="R$ 0,00"
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
                rows={6}
                placeholder={placeholder}
                className="min-h-44 rounded-[24px] border border-black/10 bg-[#f7f7f7] px-4 py-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
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
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    loading?: boolean;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            >
                <option value="">{loading ? "Carregando..." : "Selecione"}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function SecondaryButton({
    label,
    icon,
    loading,
    onClick,
    disabled = false,
}: {
    label: string;
    icon: ReactNode;
    loading: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black/70 transition hover:border-black/20 hover:text-io-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
            {label}
        </button>
    );
}

function ActionButton({
    label,
    icon,
    loading,
    disabled,
    onClick,
}: {
    label: string;
    icon: ReactNode;
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20"
        >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
            {label}
        </button>
    );
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
