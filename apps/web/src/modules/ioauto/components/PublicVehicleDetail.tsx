"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    CarFront,
    Gauge,
    Info,
    MapPin,
    MessageCircle,
    Palette,
    Settings2,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { formatMoney } from "@/modules/ioauto/formatters";
import {
    buildTrackedWhatsappHref,
    readPublicLeadTracking,
    trackPublicLeadEvent,
    withPublicLeadTracking,
} from "@/modules/ioauto/publicLeadTracking";
import { PublicCatalogLeadCaptureModal } from "@/modules/ioauto/components/PublicCatalogLeadCaptureModal";
import type { PublicVehicleDetail } from "@/modules/ioauto/types";

function getVehicleImages(detail: PublicVehicleDetail["vehicle"]) {
    return Array.from(new Set([detail.coverImageUrl, ...detail.gallery].filter(Boolean))) as string[];
}

function formatMileage(value?: number | null) {
    if (value == null || Number.isNaN(Number(value))) return "Quilometragem não informada";
    return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleYears(detail: Pick<PublicVehicleDetail["vehicle"], "modelYear" | "manufactureYear">) {
    if (detail.manufactureYear && detail.modelYear) return `${detail.manufactureYear}/${detail.modelYear}`;
    if (detail.modelYear) return String(detail.modelYear);
    if (detail.manufactureYear) return String(detail.manufactureYear);
    return "Ano não informado";
}

function buildVehicleLocation(detail: Pick<PublicVehicleDetail["vehicle"], "city" | "state">) {
    const parts = [detail.city, detail.state].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Localização não informada";
}

function getInitials(name?: string | null) {
    const parts = String(name ?? "IO Auto")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return `${parts[0]?.[0] ?? "I"}${parts[1]?.[0] ?? "O"}`.toUpperCase();
}

export function PublicVehicleDetailView({ data }: { data: PublicVehicleDetail }) {
    const searchParams = useSearchParams();
    const tracking = useMemo(() => readPublicLeadTracking(searchParams), [searchParams]);

    const images = useMemo(() => getVehicleImages(data.vehicle), [data.vehicle]);
    const [selectedImage, setSelectedImage] = useState(images[0] ?? null);
    const [leadCaptureEventType, setLeadCaptureEventType] = useState<"CONTACT_CLICK" | "INTEREST_CLICK" | null>(null);

    useEffect(() => {
        setSelectedImage(images[0] ?? null);
    }, [images]);

    useEffect(() => {
        if (tracking.sourceReference) {
            trackPublicLeadEvent(data.company.id, {
                vehicleId: data.vehicle.id,
                eventType: "VEHICLE_VIEW",
                sourceType: tracking.sourceType,
                sourceReference: tracking.sourceReference,
                pagePath: window.location.pathname,
                sourceUrl: window.location.href,
            });
        }
    }, [data.company.id, data.vehicle.id, tracking.sourceReference, tracking.sourceType]);

    const contactHref = buildTrackedWhatsappHref(
        data.company.whatsappNumber,
        `Olá! Tenho interesse no veículo ${data.vehicle.title}.`,
        tracking
    );

    const specifications = [
        { label: "Marca", value: data.vehicle.brand, icon: <CarFront className="h-4 w-4" /> },
        { label: "Modelo", value: data.vehicle.model, icon: <Info className="h-4 w-4" /> },
        { label: "Ano", value: formatVehicleYears(data.vehicle), icon: <CalendarDays className="h-4 w-4" /> },
        { label: "Quilometragem", value: formatMileage(data.vehicle.mileage), icon: <Gauge className="h-4 w-4" /> },
        { label: "Câmbio", value: data.vehicle.transmission ?? "Não informado", icon: <Settings2 className="h-4 w-4" /> },
        { label: "Combustível", value: data.vehicle.fuelType ?? "Não informado", icon: <Sparkles className="h-4 w-4" /> },
        { label: "Carroceria", value: data.vehicle.bodyType ?? "Não informado", icon: <ShieldCheck className="h-4 w-4" /> },
        { label: "Portas", value: data.vehicle.doors != null ? `${data.vehicle.doors}` : "Não informado", icon: <CarFront className="h-4 w-4" /> },
        { label: "Cor", value: data.vehicle.color ?? "Não informado", icon: <Palette className="h-4 w-4" /> },
        { label: "Localização", value: buildVehicleLocation(data.vehicle), icon: <MapPin className="h-4 w-4" /> },
        { label: "Final da placa", value: data.vehicle.plateFinal ?? "Não informado", icon: <Info className="h-4 w-4" /> },
    ];

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
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black/32">Catálogo público</p>
                                <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl tracking-tight">{data.company.name}</h1>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setLeadCaptureEventType("CONTACT_CLICK")}
                            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition ${
                                contactHref
                                    ? "bg-io-purple text-white hover:opacity-90"
                                    : "cursor-not-allowed bg-black/[0.06] text-black/45"
                            }`}
                            disabled={!contactHref}
                        >
                            <MessageCircle className="h-4 w-4" />
                            {contactHref ? "Contato via WhatsApp" : "Contato indisponível"}
                        </button>
                    </div>
                </header>

                <div className="mt-6">
                    <Link
                        href={withPublicLeadTracking(`/estoque-publico/${data.company.publicSlug}`, tracking)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-black/65 shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition hover:text-io-dark"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao catálogo
                    </Link>
                </div>

                <section className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
                    <div className="flex flex-col rounded-[34px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.09)] md:p-5">
                        <div className="overflow-hidden rounded-[28px] bg-black/5">
                            {selectedImage ? (
                                <img src={selectedImage} alt={data.vehicle.title} className="h-[320px] w-full object-cover md:h-[520px]" />
                            ) : (
                                <div className="flex h-[320px] items-center justify-center bg-white text-white/70 md:h-[520px]">
                                    Sem imagens disponíveis
                                </div>
                            )}
                        </div>

                        {images.length ? (
                            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                                {images.map((imageUrl) => (
                                    <button
                                        key={imageUrl}
                                        type="button"
                                        onClick={() => setSelectedImage(imageUrl)}
                                        className={`overflow-hidden rounded-[20px] border transition ${
                                            imageUrl === selectedImage ? "border-black shadow-[0_12px_30px_rgba(15,23,42,0.16)]" : "border-black/10"
                                        }`}
                                    >
                                        <img src={imageUrl} alt={data.vehicle.title} className="h-20 w-24 object-cover md:h-24 md:w-32" />
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <aside className="flex flex-col rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.09)] lg:sticky lg:top-6">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-io-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                                {data.vehicle.brand}
                            </span>
                            {data.vehicle.featured ? (
                                <span className="rounded-full bg-io-purple px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                                    Destaque
                                </span>
                            ) : null}
                        </div>

                        <h2 className="mt-4 font-display text-4xl font-bold leading-none md:text-5xl">{data.vehicle.modelYear ?? "Sem ano"}</h2>
                        <p className="mt-3 text-lg font-semibold text-black/72">{data.vehicle.title}</p>

                        <div className="mt-5 flex flex-wrap gap-3 text-sm text-black/58">
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
                                <CalendarDays className="h-4 w-4" />
                                {formatVehicleYears(data.vehicle)}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2">
                                <Gauge className="h-4 w-4" />
                                {formatMileage(data.vehicle.mileage)}
                            </span>
                        </div>

                        <div className="mt-6 flex-1 rounded-[28px] border border-black/10 bg-black/5 px-5 py-5 flex flex-col justify-center">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/38">Preço sugerido</p>
                            <p className="mt-2 text-4xl font-bold tracking-tight text-io-dark">{formatMoney(data.vehicle.priceCents)}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setLeadCaptureEventType("INTEREST_CLICK")}
                            className={`mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition shadow-md ${
                                contactHref
                                    ? "bg-io-purple text-white hover:opacity-90"
                                    : "cursor-not-allowed bg-black/[0.06] text-black/45"
                            }`}
                            disabled={!contactHref}
                        >
                            <MessageCircle className="h-4 w-4" />
                            Tenho Interesse
                        </button>

                        <div className="mt-6 rounded-[26px] bg-black/5 px-4 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/38">Resumo rápido</p>
                            <div className="mt-3 grid gap-2 text-sm text-black/62 font-medium">
                                <span>{buildVehicleLocation(data.vehicle)}</span>
                                <span>{data.vehicle.transmission ?? "Câmbio não informado"}</span>
                                <span>{data.vehicle.fuelType ?? "Combustível não informado"}</span>
                            </div>
                        </div>
                    </aside>
                </section>

                <section className="mt-7">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-1 rounded-full bg-io-purple" />
                        <h3 className="font-display text-2xl font-bold md:text-3xl">Especificações detalhadas</h3>
                    </div>

                    <div className="mt-5 rounded-[34px] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-6">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {specifications.map((item) => (
                                <div key={item.label} className="rounded-[24px] bg-black/5 px-4 py-4 transition hover:bg-black/[0.07]">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-black/32">
                                        {item.icon}
                                        {item.label}
                                    </div>
                                    <p className="mt-3 text-sm font-bold text-io-dark">{item.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[28px] bg-[#212121] px-5 py-5 text-white">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Descrição</p>
                                <p className="mt-4 text-sm leading-7 text-white/76">
                                    {data.vehicle.description?.trim() || "Este veículo está disponível para atendimento e negociação. Fale com a loja para receber fotos, condições e simulações."}
                                </p>
                            </div>

                            <div className="rounded-[28px] border border-black/10 bg-black/5 px-5 py-5">
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-black/32">Itens e opcionais</p>
                                {data.vehicle.optionals.length ? (
                                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                                        {data.vehicle.optionals.map((optional) => (
                                            <div key={optional} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black/68 shadow-sm">
                                                {optional}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-4 text-sm text-black/56">Os opcionais detalhados deste veículo não foram informados.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <PublicCatalogLeadCaptureModal
                open={leadCaptureEventType !== null}
                companyId={data.company.id}
                redirectUrl={contactHref}
                vehicleId={data.vehicle.id}
                vehicleTitle={data.vehicle.title}
                eventType={leadCaptureEventType ?? "INTEREST_CLICK"}
                tracking={tracking}
                onClose={() => setLeadCaptureEventType(null)}
            />
        </main>
    );
}
