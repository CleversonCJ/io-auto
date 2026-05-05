"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    ArrowRight,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Gauge,
    MapPin,
    MessageCircle,
    Search,
    SlidersHorizontal,
    Sparkles,
} from "lucide-react";
import { formatMoney, statusLabel } from "@/modules/ioauto/formatters";
import {
    buildTrackedWhatsappHref,
    readPublicLeadTracking,
    trackPublicLeadEvent,
    withPublicLeadTracking,
} from "@/modules/ioauto/publicLeadTracking";
import type { PublicInventoryBanner, PublicInventoryCatalog, PublicInventoryVehicle } from "@/modules/ioauto/types";

function getVehicleImages(vehicle: PublicInventoryVehicle) {
    return Array.from(new Set([vehicle.coverImageUrl, ...vehicle.gallery].filter(Boolean))) as string[];
}

function formatMileage(value?: number | null) {
    if (value == null || Number.isNaN(Number(value))) return "Quilometragem nao informada";
    return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleYears(vehicle: Pick<PublicInventoryVehicle, "modelYear" | "manufactureYear">) {
    if (vehicle.manufactureYear && vehicle.modelYear) return `${vehicle.manufactureYear}/${vehicle.modelYear}`;
    if (vehicle.modelYear) return String(vehicle.modelYear);
    if (vehicle.manufactureYear) return String(vehicle.manufactureYear);
    return "Ano nao informado";
}

function buildVehicleSubtitle(vehicle: Pick<PublicInventoryVehicle, "version" | "fuelType" | "transmission">) {
    const parts = [vehicle.version, vehicle.fuelType, vehicle.transmission].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Veiculo disponivel para negociacao";
}

function buildVehicleLocation(vehicle: Pick<PublicInventoryVehicle, "city" | "state">) {
    const parts = [vehicle.city, vehicle.state].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Localizacao nao informada";
}

function getInitials(name?: string | null) {
    const parts = String(name ?? "IO Auto")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const first = parts[0]?.[0] ?? "I";
    const second = parts[1]?.[0] ?? "O";
    return `${first}${second}`.toUpperCase();
}

function CatalogBanner({
    banner,
    companyName,
    vehicleCount,
    detailHref,
    contactHref,
    onContactClick,
}: {
    banner: PublicInventoryBanner;
    companyName: string;
    vehicleCount: number;
    detailHref: string;
    contactHref: string | null;
    onContactClick: () => void;
}) {
    const isCustomImage = banner.kind === "CUSTOM_IMAGE";

    if (isCustomImage) {
        return (
            <div className="relative min-h-[300px] overflow-hidden rounded-[34px] bg-black/[0.03] shadow-[0_24px_70px_rgba(0,0,0,0.08)] md:min-h-[420px]">
                {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm text-black/32">Imagem do banner indisponivel</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="grid min-h-[320px] gap-6 overflow-hidden rounded-[34px] bg-io-dark p-6 text-white md:min-h-[420px] md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
                {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full min-h-[240px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_45%),linear-gradient(135deg,_#212121,_#454545)]">
                        <span className="text-sm text-white/65">Imagem do banner indisponivel</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/90">
                        {banner.featured ? "Em destaque" : "Veiculo disponivel"}
                    </p>
                    <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold md:text-4xl">{banner.title}</h2>
                    <p className="mt-2 max-w-xl text-sm text-white/78 md:text-base">{banner.subtitle}</p>
                </div>
            </div>

            <div className="flex flex-col justify-between rounded-[30px] bg-white px-6 py-6 text-io-dark shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:px-7">
                <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-io-purple/5 border border-io-purple/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                        <Sparkles className="h-3.5 w-3.5" />
                        Banner do catalogo
                    </p>
                    <h3 className="mt-4 font-display text-3xl font-bold">{banner.modelYear ?? "Sem ano definido"}</h3>
                    <div className="mt-4 grid gap-3 text-sm text-black/62">
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2 font-medium">
                            <CalendarDays className="h-4 w-4 text-io-purple" />
                            {banner.modelYear ? `${banner.modelYear}` : "Ano nao informado"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2 font-medium">
                            <MapPin className="h-4 w-4 text-io-purple" />
                            {[banner.city, banner.state].filter(Boolean).join(" / ") || "Localizacao nao informada"}
                        </span>
                    </div>

                    <div className="mt-6 rounded-[24px] border border-black/10 bg-black/5 px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/40">Preco sugerido</p>
                        <p className="mt-2 text-3xl font-bold text-io-dark tracking-tight">{formatMoney(banner.priceCents)}</p>
                    </div>
                </div>

                <div className="mt-5 flex gap-2">
                    <Link
                        href={detailHref}
                        className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-bold text-white transition hover:bg-black/85"
                    >
                        Ver detalhes
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <a
                        href={contactHref ?? undefined}
                        target={contactHref ? "_blank" : undefined}
                        rel={contactHref ? "noreferrer" : undefined}
                        onClick={onContactClick}
                        className={`inline-flex h-14 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition ${
                            contactHref
                                ? "bg-io-purple text-white hover:opacity-90"
                                : "cursor-not-allowed bg-black/8 text-black/45"
                        }`}
                    >
                        <MessageCircle className="h-4 w-4" />
                        Tenho interesse
                    </a>
                </div>
            </div>
        </div>
    );
}

function VehicleCard({
    companyId,
    vehicle,
    detailHref,
    contactHref,
    onContactClick,
}: {
    companyId: string;
    vehicle: PublicInventoryVehicle;
    detailHref: string;
    contactHref: string | null;
    onContactClick: () => void;
}) {
    const images = getVehicleImages(vehicle);
    const imageUrl = images[0] ?? null;

    return (
        <article className="group flex flex-col overflow-hidden rounded-[32px] border border-black/10 bg-white p-3 shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_75px_rgba(15,23,42,0.16)]">
            <div className="relative overflow-hidden rounded-[26px] bg-black/[0.04]">
                {imageUrl ? (
                    <img src={imageUrl} alt={vehicle.title} className="h-64 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                    <div className="flex h-64 items-center justify-center bg-white text-sm text-white/70">
                        Sem imagem principal
                    </div>
                )}
                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
                    <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-black/68">
                        {vehicle.featured ? "Destaque" : "Disponivel"}
                    </span>
                </div>
            </div>

            <div className="flex flex-1 flex-col px-2 pb-3 pt-5">
                <div className="flex-1">
                <div className="mt-1">
                    <h3 className="font-display text-[1.7rem] font-bold leading-[1.05] tracking-tight text-io-dark">{vehicle.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-black/58">{buildVehicleSubtitle(vehicle)}</p>
                </div>

                <div className="mt-5 grid gap-2 text-sm text-black/62">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
                        <CalendarDays className="h-4 w-4" />
                        {formatVehicleYears(vehicle)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
                        <Gauge className="h-4 w-4" />
                        {formatMileage(vehicle.mileage)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
                        <MapPin className="h-4 w-4" />
                        {buildVehicleLocation(vehicle)}
                    </span>
                </div>
                <div className="mt-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/32">Preço</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-io-dark">{formatMoney(vehicle.priceCents)}</p>
                </div>

                </div>

                <div className="mt-5 flex gap-2">
                    <a
                        href={contactHref ?? undefined}
                        target={contactHref ? "_blank" : undefined}
                        rel={contactHref ? "noreferrer" : undefined}
                        onClick={onContactClick}
                        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                            contactHref
                                ? "border border-black/10 bg-white text-black/75 hover:border-black/20 hover:text-io-dark shadow-sm"
                                : "cursor-not-allowed border border-black/8 bg-black/[0.03] text-black/35"
                        }`}
                    >
                        <MessageCircle className="h-4 w-4" />
                    </a>
                    <Link
                        href={detailHref}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-io-dark px-5 text-sm font-bold text-white transition hover:bg-black/85 shadow-sm"
                    >
                        Ver detalhes
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </article>
    );
}

export function PublicInventoryCatalogView({ data }: { data: PublicInventoryCatalog }) {
    const searchParams = useSearchParams();
    const tracking = useMemo(() => readPublicLeadTracking(searchParams), [searchParams]);
    const stockSectionId = "estoque-publico-listagem";

    const [search, setSearch] = useState("");
    const [brand, setBrand] = useState("all");
    const [transmission, setTransmission] = useState("all");
    const [fuelType, setFuelType] = useState("all");
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    const banners = data.banners.length ? data.banners : data.vehicles.slice(0, 5).map((vehicle) => ({
        id: vehicle.id,
        kind: "VEHICLE" as const,
        vehicleId: vehicle.id,
        title: vehicle.title,
        subtitle: buildVehicleSubtitle(vehicle),
        imageUrl: getVehicleImages(vehicle)[0] ?? null,
        priceCents: vehicle.priceCents,
        city: vehicle.city,
        state: vehicle.state,
        modelYear: vehicle.modelYear,
        featured: vehicle.featured,
    }));

    const brandOptions = useMemo(
        () => Array.from(new Set(data.vehicles.map((vehicle) => vehicle.brand).filter(Boolean))).sort((left, right) => left.localeCompare(right, "pt-BR")),
        [data.vehicles]
    );
    const transmissionOptions = useMemo(
        () => Array.from(new Set(data.vehicles.map((vehicle) => vehicle.transmission).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, "pt-BR")),
        [data.vehicles]
    );
    const fuelOptions = useMemo(
        () => Array.from(new Set(data.vehicles.map((vehicle) => vehicle.fuelType).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, "pt-BR")),
        [data.vehicles]
    );

    const filteredVehicles = useMemo(() => {
        const query = search.trim().toLowerCase();

        return data.vehicles.filter((vehicle) => {
            if (brand !== "all" && vehicle.brand !== brand) return false;
            if (transmission !== "all" && vehicle.transmission !== transmission) return false;
            if (fuelType !== "all" && vehicle.fuelType !== fuelType) return false;
            if (!query) return true;

            return [
                vehicle.title,
                vehicle.brand,
                vehicle.model,
                vehicle.version,
                vehicle.city,
                vehicle.state,
                vehicle.bodyType,
                vehicle.color,
                vehicle.stockNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [brand, data.vehicles, fuelType, search, transmission]);

    useEffect(() => {
        if (tracking.sourceReference) {
            trackPublicLeadEvent(data.company.id, {
                eventType: "CATALOG_VIEW",
                sourceType: tracking.sourceType,
                sourceReference: tracking.sourceReference,
                pagePath: window.location.pathname,
                sourceUrl: window.location.href,
            });
        }
    }, [data.company.id, tracking.sourceReference, tracking.sourceType]);

    useEffect(() => {
        if (currentBannerIndex > Math.max(banners.length - 1, 0)) {
            setCurrentBannerIndex(0);
        }
    }, [banners.length, currentBannerIndex]);

    useEffect(() => {
        if (banners.length <= 1) return;

        const timer = window.setInterval(() => {
            setCurrentBannerIndex((current) => (current + 1) % banners.length);
        }, 6000);

        return () => window.clearInterval(timer);
    }, [banners.length]);

    const currentBanner = banners[currentBannerIndex] ?? null;
    const companyContactHref = buildTrackedWhatsappHref(
        data.company.whatsappNumber,
        "Ola! Vim pelo catalogo publico e gostaria de mais informacoes.",
        tracking
    );

    return (
        <main className="min-h-screen bg-[#fcfcfc] text-io-dark">
            <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
                <header className="rounded-[30px] border border-black/10 bg-white px-5 py-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)] md:px-7">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            {data.company.profileImageUrl ? (
                                <img src={data.company.profileImageUrl} alt={data.company.name} className="h-14 max-w-[180px] object-contain object-left" />
                            ) : (
                                <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-io-dark text-sm font-bold text-white shadow-sm">
                                    {getInitials(data.company.name)}
                                </div>
                            )}

                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black/32">Estoque público</p>
                                <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl tracking-tight">{data.company.name}</h1>
                            </div>
                        </div>

                        <a
                            href={companyContactHref ?? undefined}
                            target={companyContactHref ? "_blank" : undefined}
                            rel={companyContactHref ? "noreferrer" : undefined}
                            onClick={() =>
                                trackPublicLeadEvent(data.company.id, {
                                    eventType: "CONTACT_CLICK",
                                    sourceType: tracking.sourceType,
                                    sourceReference: tracking.sourceReference,
                                })
                            }
                            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition ${
                                companyContactHref
                                    ? "bg-io-purple text-white hover:opacity-90"
                                    : "cursor-not-allowed bg-black/[0.06] text-black/45"
                            }`}
                        >
                            <MessageCircle className="h-4 w-4" />
                            {companyContactHref ? "Contato via WhatsApp" : "Contato indisponivel"}
                        </a>
                    </div>
                </header>

                <section className="mt-6 rounded-[36px] border border-black/10 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-5">
                    {currentBanner ? (
                        <>
                            <CatalogBanner
                                banner={currentBanner}
                                companyName={data.company.name}
                                vehicleCount={filteredVehicles.length}
                                detailHref={
                                    currentBanner.kind === "VEHICLE" && currentBanner.vehicleId
                                        ? withPublicLeadTracking(`/estoque-publico/${data.company.publicSlug}/veiculo/${currentBanner.vehicleId}`, tracking)
                                        : `#${stockSectionId}`
                                }
                                contactHref={buildTrackedWhatsappHref(
                                    data.company.whatsappNumber,
                                    currentBanner.kind === "VEHICLE"
                                        ? `Ola! Tenho interesse no veiculo ${currentBanner.title}.`
                                        : "Ola! Vim pelo catalogo publico e gostaria de mais informacoes sobre os carros disponiveis.",
                                    tracking
                                )}
                                onContactClick={() =>
                                    trackPublicLeadEvent(data.company.id, {
                                        vehicleId: currentBanner.kind === "VEHICLE" ? currentBanner.vehicleId : null,
                                        eventType: "INTEREST_CLICK",
                                        sourceType: tracking.sourceType,
                                        sourceReference: tracking.sourceReference,
                                    })
                                }
                            />

                            {banners.length > 1 ? (
                                <div className="mt-4 flex items-center justify-between gap-4 px-2">
                                    <div className="flex items-center gap-2">
                                        {banners.map((banner, index) => (
                                            <button
                                                key={banner.id}
                                                type="button"
                                                onClick={() => setCurrentBannerIndex(index)}
                                                className={`h-2.5 rounded-full transition ${index === currentBannerIndex ? "w-10 bg-io-purple" : "w-2.5 bg-black/18 hover:bg-black/32"}`}
                                                aria-label={`Ir para banner ${index + 1}`}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentBannerIndex((current) => (current - 1 + banners.length) % banners.length)}
                                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/12 bg-white text-black/72 transition hover:border-black/20 hover:text-io-dark"
                                            aria-label="Banner anterior"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentBannerIndex((current) => (current + 1) % banners.length)}
                                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/12 bg-white text-black/72 transition hover:border-black/20 hover:text-io-dark"
                                            aria-label="Proximo banner"
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="rounded-[32px] bg-[#212121] px-6 py-12 text-center text-white">
                            <p className="text-sm text-white/72">Ainda nao ha banners para este catalogo.</p>
                        </div>
                    )}
                </section>

                <section className="mt-6 rounded-[32px] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full bg-io-purple/5 border border-io-purple/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Pesquisa e filtros
                            </p>
                            <h2 className="mt-3 font-display text-2xl font-bold md:text-3xl tracking-tight">Encontre o carro ideal</h2>
                            <p className="mt-2 text-sm text-black/56">Pesquise por modelo ou refine o resultado usando os filtros abaixo.</p>
                        </div>

                        <div className="rounded-full bg-black/[0.04] px-4 py-3 text-sm font-medium text-black/60">
                            {filteredVehicles.length} veiculo(s) disponivel(is)
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="grid gap-2">
                            <span className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-black/32">Busca</span>
                            <label className="flex h-14 items-center gap-3 rounded-full border border-black/10 bg-black/5 px-5 transition-within:border-black/20 transition-within:bg-white">
                                <Search className="h-4 w-4 text-black/42" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Marca ou modelo"
                                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-black/35"
                                />
                            </label>
                        </div>

                        <FilterSelect label="Marca" value={brand} onChange={setBrand} options={brandOptions} />
                        <FilterSelect label="Cambio" value={transmission} onChange={setTransmission} options={transmissionOptions} />
                        <FilterSelect label="Combustivel" value={fuelType} onChange={setFuelType} options={fuelOptions} />
                    </div>
                </section>

                <section id={stockSectionId} className="mt-6">
                    {filteredVehicles.length ? (
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {filteredVehicles.map((vehicle) => (
                                <VehicleCard
                                    key={vehicle.id}
                                    companyId={data.company.id}
                                    vehicle={vehicle}
                                    detailHref={withPublicLeadTracking(`/estoque-publico/${data.company.publicSlug}/veiculo/${vehicle.id}`, tracking)}
                                    contactHref={buildTrackedWhatsappHref(
                                        data.company.whatsappNumber,
                                        `Ola! Tenho interesse no veiculo ${vehicle.title}.`,
                                        tracking
                                    )}
                                    onContactClick={() =>
                                        trackPublicLeadEvent(data.company.id, {
                                            vehicleId: vehicle.id,
                                            eventType: "INTEREST_CLICK",
                                            sourceType: tracking.sourceType,
                                            sourceReference: tracking.sourceReference,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[32px] border border-dashed border-black/12 bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-black/[0.04]">
                                <Search className="h-6 w-6 text-black/42" />
                            </div>
                            <h3 className="mt-4 font-display text-2xl font-bold">Nenhum veiculo encontrado</h3>
                            <p className="mt-2 text-sm text-black/56">Tente ajustar os filtros para explorar todo o estoque disponivel.</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
}) {
    return (
        <label className="grid gap-2">
            <span className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-black/32">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-14 rounded-full border border-black/10 bg-black/5 px-5 text-sm font-medium text-io-dark outline-none transition focus:border-black/20 focus:bg-white"
            >
                <option value="all">Todos</option>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}
