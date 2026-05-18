"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, LoaderCircle, RefreshCw, Send, Trash2 } from "lucide-react";
import type { OlxAdRecord, OlxCatalogOption, OlxVehicleMapping } from "@/modules/ioauto/types";
import { statusLabel } from "@/modules/ioauto/formatters";

export type OlxVehicleFormState = {
    brandId: string;
    modelId: string;
    versionId: string;
    fuelCode: string;
    gearboxCode: string;
    doorsCode: string;
    colorCode: string;
    featureCodes: string[];
    plate: string;
    phone: string;
    zipcode: string;
    ad: OlxAdRecord | null;
};

type MainSummary = {
    year: string;
    mileage: string;
    priceCents: string;
    description: string;
    imageCount: number;
};

type Props = {
    vehicleId?: string;
    value: OlxVehicleFormState;
    mainSummary: MainSummary;
    onHydrate: (mapping: OlxVehicleMapping) => void;
    onChange: (partial: Partial<OlxVehicleFormState>) => void;
};

export function emptyOlxVehicleForm(): OlxVehicleFormState {
    return {
        brandId: "",
        modelId: "",
        versionId: "",
        fuelCode: "",
        gearboxCode: "",
        doorsCode: "",
        colorCode: "",
        featureCodes: [],
        plate: "",
        phone: "",
        zipcode: "",
        ad: null,
    };
}

export function OlxVehiclePanel({ vehicleId, value, mainSummary, onHydrate, onChange }: Props) {
    const [brands, setBrands] = useState<OlxCatalogOption[]>([]);
    const [models, setModels] = useState<OlxCatalogOption[]>([]);
    const [versions, setVersions] = useState<OlxCatalogOption[]>([]);
    const [loadingMapping, setLoadingMapping] = useState(false);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [action, setAction] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const featureCodesText = useMemo(() => value.featureCodes.join(", "), [value.featureCodes]);

    useEffect(() => {
        void loadBrands();
    }, []);

    useEffect(() => {
        if (!vehicleId) return;
        void loadMapping(vehicleId);
    }, [vehicleId]);

    useEffect(() => {
        if (!value.brandId) {
            setModels([]);
            return;
        }
        void loadModels(value.brandId);
    }, [value.brandId]);

    useEffect(() => {
        if (!value.brandId || !value.modelId) {
            setVersions([]);
            return;
        }
        void loadVersions(value.brandId, value.modelId);
    }, [value.brandId, value.modelId]);

    async function loadBrands() {
        setLoadingCatalog(true);
        try {
            const response = await fetch("/api/integrations/olx/catalog/brands", { cache: "no-store" });
            if (response.ok) {
                setBrands((await response.json()) as OlxCatalogOption[]);
            }
        } finally {
            setLoadingCatalog(false);
        }
    }

    async function loadModels(brandId: string) {
        const response = await fetch(`/api/integrations/olx/catalog/brands/${brandId}/models`, { cache: "no-store" });
        if (response.ok) {
            setModels((await response.json()) as OlxCatalogOption[]);
        }
    }

    async function loadVersions(brandId: string, modelId: string) {
        const response = await fetch(`/api/integrations/olx/catalog/brands/${brandId}/models/${modelId}/versions`, { cache: "no-store" });
        if (response.ok) {
            setVersions((await response.json()) as OlxCatalogOption[]);
        }
    }

    async function loadMapping(currentVehicleId: string) {
        setLoadingMapping(true);
        setError(null);
        try {
            const response = await fetch(`/api/integrations/olx/vehicles/${currentVehicleId}/mapping`, { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as OlxVehicleMapping | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao carregar os dados OLX do veículo.");
            }
            onHydrate(payload as OlxVehicleMapping);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao carregar os dados OLX do veículo.");
        } finally {
            setLoadingMapping(false);
        }
    }

    async function runAction(nextAction: string, requestFactory: () => Promise<Response>) {
        if (!vehicleId) return;
        setAction(nextAction);
        setError(null);
        setMessage(null);
        try {
            const response = await requestFactory();
            const payload = (await response.json().catch(() => null)) as OlxAdRecord | { message?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { message?: string } | null)?.message ?? "Falha ao processar o anúncio OLX.");
            }
            onChange({ ad: payload as OlxAdRecord });
            setMessage(`Status OLX atualizado: ${statusLabel((payload as OlxAdRecord).status)}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Falha ao processar o anúncio OLX.");
        } finally {
            setAction(null);
        }
    }

    return (
        <section className="rounded-[30px] border border-black/10 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-io-dark">Anúncio OLX</p>
                    <p className="mt-1 text-sm text-black/52">
                        Ano, quilometragem, preço, descrição e imagens saem do cadastro principal. Aqui você ajusta o mapeamento OLX e controla a publicação.
                    </p>
                </div>
                <div className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-black/50">
                    {value.ad?.status ? statusLabel(value.ad.status) : "Não publicado"}
                </div>
            </div>

            {error ? <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryBox label="Ano" value={mainSummary.year || "-"} />
                <SummaryBox label="Quilometragem" value={mainSummary.mileage || "-"} />
                <SummaryBox label="Preço" value={mainSummary.priceCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(mainSummary.priceCents) / 100) : "-"} />
                <SummaryBox label="Imagens" value={String(mainSummary.imageCount)} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SelectField
                    label="Marca OLX"
                    value={value.brandId}
                    options={brands}
                    loading={loadingCatalog}
                    onChange={(next) => onChange({ brandId: next, modelId: "", versionId: "" })}
                />
                <SelectField
                    label="Modelo OLX"
                    value={value.modelId}
                    options={models}
                    onChange={(next) => onChange({ modelId: next, versionId: "" })}
                />
                <SelectField
                    label="Versão OLX"
                    value={value.versionId}
                    options={versions}
                    onChange={(next) => onChange({ versionId: next })}
                />
                <Field label="Combustível (código OLX)" value={value.fuelCode} onChange={(next) => onChange({ fuelCode: next })} />
                <Field label="Câmbio (código OLX)" value={value.gearboxCode} onChange={(next) => onChange({ gearboxCode: next })} />
                <Field label="Portas (código OLX)" value={value.doorsCode} onChange={(next) => onChange({ doorsCode: next })} />
                <Field label="Cor (código OLX)" value={value.colorCode} onChange={(next) => onChange({ colorCode: next })} />
                <Field label="Opcionais (códigos separados por vírgula)" value={featureCodesText} onChange={(next) => onChange({ featureCodes: next.split(",").map((item) => item.trim()).filter(Boolean) })} />
                <Field label="Placa" value={value.plate} onChange={(next) => onChange({ plate: next.toUpperCase() })} />
                <Field label="Telefone OLX" value={value.phone} onChange={(next) => onChange({ phone: next })} />
                <Field label="CEP OLX" value={value.zipcode} onChange={(next) => onChange({ zipcode: next })} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ActionButton
                    label="Publicar na OLX"
                    icon={<Send className="h-4 w-4" />}
                    loading={action === "publish"}
                    disabled={!vehicleId}
                    onClick={() => void runAction("publish", () => fetch(`/api/integrations/olx/vehicles/${vehicleId}/publish`, { method: "POST" }))}
                />
                <ActionButton
                    label="Atualizar anúncio"
                    icon={<RefreshCw className="h-4 w-4" />}
                    loading={action === "update"}
                    disabled={!vehicleId}
                    onClick={() => void runAction("update", () => fetch(`/api/integrations/olx/vehicles/${vehicleId}/ad`, { method: "PUT" }))}
                />
                <ActionButton
                    label="Despublicar"
                    icon={<Trash2 className="h-4 w-4" />}
                    loading={action === "delete"}
                    disabled={!vehicleId}
                    onClick={() => void runAction("delete", () => fetch(`/api/integrations/olx/vehicles/${vehicleId}/ad`, { method: "DELETE" }))}
                />
                <ActionButton
                    label="Sincronizar status"
                    icon={<RefreshCw className="h-4 w-4" />}
                    loading={action === "sync"}
                    disabled={!vehicleId || !value.ad?.id}
                    onClick={() => void runAction("sync", () => fetch(`/api/integrations/olx/ads/${value.ad?.id}/sync-status`, { method: "POST" }))}
                />
                <a
                    href={value.ad?.olxUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition ${
                        value.ad?.olxUrl ? "border-black/12 text-black/72 hover:border-black/20 hover:text-io-dark" : "pointer-events-none border-black/8 text-black/30"
                    }`}
                >
                    <ExternalLink className="h-4 w-4" />
                    Abrir anúncio
                </a>
            </div>

            {!vehicleId ? (
                <p className="mt-4 text-xs text-black/42">Salve o cadastro do veículo para persistir o mapeamento OLX e habilitar a publicação.</p>
            ) : null}

            {loadingMapping ? (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-black/48">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Carregando configuração OLX do veículo...
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-2">
            <span className="text-sm font-medium text-black/60">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-12 rounded-2xl border border-black/10 bg-[#f7f7f7] px-4 text-sm text-io-dark outline-none transition focus:border-black/30 focus:bg-white"
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    loading = false,
    onChange,
}: {
    label: string;
    value: string;
    options: OlxCatalogOption[];
    loading?: boolean;
    onChange: (value: string) => void;
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
                    <option key={option.id} value={option.id}>
                        {option.name}
                    </option>
                ))}
            </select>
        </label>
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
