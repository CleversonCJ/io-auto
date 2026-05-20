"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    CalendarDays,
    CarFront,
    CheckCircle2,
    ExternalLink,
    Gauge,
    LoaderCircle,
    MapPin,
    MessageCircle,
    Palette,
    Phone,
    RefreshCw,
    Search,
    Settings2,
    ShieldCheck,
    Sparkles,
    UserRound,
    X,
} from "lucide-react";
import { subscribeRealtime } from "@/core/realtime/client";
import { formatDateTime, formatMoney } from "@/modules/ioauto/formatters";
import type { PublicCatalogLeadList, VehicleRecord } from "@/modules/ioauto/types";

const PRESET_OPTIONS = [
    { value: "LAST_7_DAYS", label: "Últimos 7 dias" },
    { value: "LAST_30_DAYS", label: "Últimos 30 dias" },
    { value: "LAST_MONTH", label: "Mês passado" },
    { value: "CUSTOM", label: "Período personalizado" },
] as const;

type LeadItem = PublicCatalogLeadList["leads"][number];
type TeamMember = {
    id: string;
    fullName: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
};

function formatDate(value?: string | null) {
    if (!value) return "-";

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function formatPhone(value?: string | null) {
    const digits = String(value ?? "").replace(/\D/g, "");

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    if (digits.length === 13 && digits.startsWith("55")) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }

    if (digits.length === 12 && digits.startsWith("55")) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }

    return value || "-";
}

function sourceTypeLabel(value?: string | null) {
    const normalized = String(value ?? "").trim().toUpperCase();

    if (normalized === "CAMPAIGN") return "Campanha";
    if (normalized === "INFLUENCER") return "Influenciador";
    if (normalized === "DIRECT") return "Direto";
    if (!normalized) return "Sem origem";
    return normalized.replaceAll("_", " ");
}

function formatMileage(value?: number | null) {
    if (value == null || Number.isNaN(Number(value))) return "Quilometragem não informada";
    return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleYears(vehicle: Pick<VehicleRecord, "modelYear" | "manufactureYear">) {
    if (vehicle.manufactureYear && vehicle.modelYear) return `${vehicle.manufactureYear}/${vehicle.modelYear}`;
    if (vehicle.modelYear) return String(vehicle.modelYear);
    if (vehicle.manufactureYear) return String(vehicle.manufactureYear);
    return "Ano não informado";
}

function buildVehicleLocation(vehicle: Pick<VehicleRecord, "city" | "state">) {
    const parts = [vehicle.city, vehicle.state].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Localização não informada";
}

function getVehicleImages(vehicle: VehicleRecord | null) {
    if (!vehicle) return [];
    return Array.from(new Set([vehicle.coverImageUrl, ...vehicle.gallery].filter(Boolean))) as string[];
}

function buildWhatsappLeadHref(lead: LeadItem, vehicle?: VehicleRecord | null) {
    const rawDigits = String(lead.customerPhone ?? "").replace(/\D/g, "");
    if (!rawDigits) return null;

    const digits = rawDigits.length <= 11 ? `55${rawDigits}` : rawDigits;
    const message = vehicle?.title
        ? `Olá, ${lead.customerName}! Vi seu interesse no veículo ${vehicle.title} e posso te ajudar com os próximos passos.`
        : `Olá, ${lead.customerName}! Vi seu interesse no catálogo e posso te ajudar com os próximos passos.`;

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function indexVehicles(items: VehicleRecord[]) {
    const next: Record<string, VehicleRecord> = {};
    for (const item of items) {
        next[item.id] = item;
    }
    return next;
}

function LeadMetricCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper: string;
}) {
    return (
        <div className="rounded-[28px] border border-[#6b00e3]/10 bg-white/92 px-5 py-5 shadow-[0_18px_36px_rgba(107,0,227,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/36">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-io-dark">{value}</p>
            <p className="mt-2 text-sm text-black/55">{helper}</p>
        </div>
    );
}

export function PublicCatalogLeadsPage() {
    const [preset, setPreset] = useState<(typeof PRESET_OPTIONS)[number]["value"]>("LAST_30_DAYS");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [search, setSearch] = useState("");
    const [refreshTick, setRefreshTick] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<PublicCatalogLeadList | null>(null);
    const [liveStatus, setLiveStatus] = useState("Atualização em tempo real ativa");
    const [vehiclesById, setVehiclesById] = useState<Record<string, VehicleRecord>>({});
    const [previewLead, setPreviewLead] = useState<LeadItem | null>(null);
    const [previewVehicle, setPreviewVehicle] = useState<VehicleRecord | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [saleLead, setSaleLead] = useState<LeadItem | null>(null);
    const [saleSellerUserId, setSaleSellerUserId] = useState("");
    const [saleSubmitting, setSaleSubmitting] = useState(false);
    const [saleMessage, setSaleMessage] = useState<string | null>(null);
    const previewRequestRef = useRef(0);

    useEffect(() => {
        let active = true;

        async function loadLeads() {
            setLoading(true);

            try {
                const params = new URLSearchParams();
                params.set("preset", preset);

                if (preset === "CUSTOM") {
                    if (fromDate) params.set("from", fromDate);
                    if (toDate) params.set("to", toDate);
                }

                const response = await fetch(`/api/ioauto/public-catalog-leads?${params.toString()}`, {
                    cache: "no-store",
                    credentials: "include",
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao carregar os leads do catálogo." }));
                    throw new Error(payload.message ?? "Falha ao carregar os leads do catálogo.");
                }

                const payload = await response.json() as PublicCatalogLeadList;
                if (!active) return;

                setData(payload);
                setError(null);
            } catch (cause) {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : "Falha ao carregar os leads do catálogo.");
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadLeads();

        return () => {
            active = false;
        };
    }, [fromDate, preset, refreshTick, toDate]);

    useEffect(() => {
        let refreshTimer: number | null = null;

        const unsubscribe = subscribeRealtime((event) => {
            if (event.type !== "public.catalog.lead.created") return;

            if (refreshTimer != null) {
                window.clearTimeout(refreshTimer);
            }

            refreshTimer = window.setTimeout(() => {
                setLiveStatus("Novo lead recebido agora");
                setRefreshTick((value) => value + 1);
            }, 160);
        });

        return () => {
            if (refreshTimer != null) {
                window.clearTimeout(refreshTimer);
            }
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        let active = true;

        fetch("/api/atendimentos/users", {
            cache: "no-store",
            credentials: "include",
        })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao carregar a equipe." }));
                    throw new Error(payload.message ?? "Falha ao carregar a equipe.");
                }
                return response.json() as Promise<TeamMember[]>;
            })
            .then((payload) => {
                if (!active) return;
                setTeamMembers(payload);
            })
            .catch(() => {
                if (!active) return;
                setTeamMembers([]);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (liveStatus !== "Novo lead recebido agora") return;

        const timer = window.setTimeout(() => {
            setLiveStatus("Atualização em tempo real ativa");
        }, 4000);

        return () => window.clearTimeout(timer);
    }, [liveStatus]);

    useEffect(() => {
        const images = getVehicleImages(previewVehicle);
        setPreviewImage(images[0] ?? null);
    }, [previewVehicle]);

    const filteredLeads = useMemo(() => {
        const leads = data?.leads ?? [];
        const query = search.trim().toLowerCase();

        if (!query) {
            return leads;
        }

        return leads.filter((lead) =>
            [
                lead.customerName,
                lead.customerPhone,
                lead.vehicleTitle,
                lead.sourceReference,
                sourceTypeLabel(lead.sourceType),
                lead.pagePath,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
        );
    }, [data?.leads, search]);

    const periodLabel = useMemo(() => {
        if (!data) return "Período carregando...";
        return `${formatDate(data.fromDate)} até ${formatDate(data.toDate)}`;
    }, [data]);

    async function openVehiclePreview(lead: LeadItem) {
        if (!lead.vehicleId) return;

        const requestId = previewRequestRef.current + 1;
        previewRequestRef.current = requestId;
        setPreviewLead(lead);
        setPreviewError(null);

        const cachedVehicle = vehiclesById[lead.vehicleId];
        if (cachedVehicle) {
            setPreviewVehicle(cachedVehicle);
            setPreviewLoading(false);
            return;
        }

        setPreviewVehicle(null);
        setPreviewLoading(true);

        try {
            const response = await fetch("/api/ioauto/vehicles", {
                cache: "no-store",
                credentials: "include",
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao carregar os veículos para a pré-visualização." }));
                throw new Error(payload.message ?? "Falha ao carregar os veículos para a pré-visualização.");
            }

            const payload = await response.json() as VehicleRecord[];
            if (previewRequestRef.current !== requestId) return;

            const nextVehiclesById = indexVehicles(payload);
            const selectedVehicle = nextVehiclesById[lead.vehicleId];

            setVehiclesById(nextVehiclesById);

            if (!selectedVehicle) {
                throw new Error("O veículo deste lead não está mais disponível para visualização.");
            }

            setPreviewVehicle(selectedVehicle);
        } catch (cause) {
            if (previewRequestRef.current !== requestId) return;
            setPreviewError(cause instanceof Error ? cause.message : "Falha ao carregar a pré-visualização do veículo.");
        } finally {
            if (previewRequestRef.current === requestId) {
                setPreviewLoading(false);
            }
        }
    }

    function closeVehiclePreview() {
        previewRequestRef.current += 1;
        setPreviewLead(null);
        setPreviewVehicle(null);
        setPreviewError(null);
        setPreviewLoading(false);
        setPreviewImage(null);
    }

    function openSaleModal(lead: LeadItem) {
        if (!lead.vehicleId || lead.convertedToSale) return;
        setSaleLead(lead);
        setSaleSellerUserId(lead.sellerUserId ?? "");
        setSaleMessage(null);
    }

    function closeSaleModal() {
        if (saleSubmitting) return;
        setSaleLead(null);
        setSaleSellerUserId("");
        setSaleMessage(null);
    }

    async function handleCloseSale() {
        if (!saleLead) return;
        if (!saleLead.vehicleId) {
            setSaleMessage("Este lead não possui um veículo vinculado para fechar a venda.");
            return;
        }
        if (!saleSellerUserId) {
            setSaleMessage("Selecione o vendedor responsável para concluir a venda.");
            return;
        }

        setSaleSubmitting(true);
        setSaleMessage(null);

        try {
            const response = await fetch(`/api/ioauto/public-catalog-leads/${saleLead.id}/close-sale`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sellerUserId: saleSellerUserId,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ message: "Falha ao concluir a venda." }));
                throw new Error(payload.message ?? "Falha ao concluir a venda.");
            }

            setData((current) => {
                if (!current) return current;
                return {
                    ...current,
                    leads: current.leads.map((lead) =>
                        lead.id === saleLead.id
                            ? {
                                ...lead,
                                sellerUserId: saleSellerUserId,
                                convertedToSale: true,
                            }
                            : lead
                    ),
                };
            });
            closeSaleModal();
            setRefreshTick((value) => value + 1);
        } catch (cause) {
            setSaleMessage(cause instanceof Error ? cause.message : "Falha ao concluir a venda.");
        } finally {
            setSaleSubmitting(false);
        }
    }

    const previewImages = getVehicleImages(previewVehicle);
    const previewWhatsappHref = previewLead ? buildWhatsappLeadHref(previewLead, previewVehicle) : null;

    return (
        <div className="grid gap-6">
            <section className="overflow-hidden rounded-[34px] border border-[#6b00e3]/10 bg-[radial-gradient(circle_at_top_left,_rgba(154,92,255,0.18),_transparent_46%),linear-gradient(180deg,_#ffffff_0%,_#fbf7ff_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(107,0,227,0.08)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                            <Sparkles className="h-3.5 w-3.5" />
                            {"Leads do catálogo"}
                        </span>
                        <h1 className="mt-4 font-display text-[1.95rem] font-bold leading-tight text-io-dark md:text-[2.35rem]">
                            {"Leads captados antes do WhatsApp"}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-black/58">
                            {"Acompanhe quem preencheu o formulário do catálogo público, veja o veículo de interesse e filtre o resultado pelo período que fizer mais sentido para a operação."}
                        </p>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LeadMetricCard
                    label="Total de leads"
                    value={String(data?.totalLeads ?? 0)}
                    helper={"Todos os formulários concluídos no período filtrado."}
                />
                <LeadMetricCard
                    label="Com veículo"
                    value={String(data?.leadsWithVehicle ?? 0)}
                    helper={"Leads que vieram de um anúncio de veículo específico."}
                />
                <LeadMetricCard
                    label="Com campanha"
                    value={String(data?.leadsWithCampaign ?? 0)}
                    helper={"Leads com referência de origem rastreada no link público."}
                />
                <LeadMetricCard
                    label="Telefones únicos"
                    value={String(data?.uniquePhones ?? 0)}
                    helper={"Quantidade distinta de contatos no intervalo atual."}
                />
            </section>

            <section className="rounded-[32px] border border-[#6b00e3]/10 bg-white p-5 shadow-[0_18px_50px_rgba(107,0,227,0.06)] md:p-6">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/34">
                                {"Filtros"}
                            </p>
                            <h2 className="mt-2 font-display text-2xl font-bold text-io-dark">
                                {"Refine a listagem"}
                            </h2>
                            <p className="mt-2 text-sm text-black/56">
                                {"Use os atalhos rápidos ou selecione um período personalizado para revisar os leads."}
                            </p>
                        </div>

                        <div className="rounded-full bg-[#f7f0ff] px-4 py-3 text-sm font-medium text-io-purple">
                            {`${filteredLeads.length} lead(s) visível(is)`}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {PRESET_OPTIONS.map((option) => {
                            const active = preset === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setPreset(option.value)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                        active
                                            ? "bg-io-purple text-white shadow-[0_12px_22px_rgba(107,0,227,0.22)]"
                                            : "border border-[#6b00e3]/12 bg-[#faf6ff] text-io-purple hover:border-[#6b00e3]/24 hover:bg-white"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
                        <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-black/38">
                                {"Buscar"}
                            </span>
                            <div className="flex h-14 items-center gap-3 rounded-[24px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4 transition focus-within:border-[#6b00e3]/24 focus-within:bg-white">
                                <Search className="h-4 w-4 text-io-purple" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Nome, telefone, veículo ou campanha"
                                    className="w-full bg-transparent text-sm font-medium text-io-dark outline-none placeholder:text-black/36"
                                />
                            </div>
                        </label>

                        <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-black/38">
                                {"Data inicial"}
                            </span>
                            <div className="flex h-14 items-center gap-3 rounded-[24px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4 transition focus-within:border-[#6b00e3]/24 focus-within:bg-white">
                                <CalendarDays className="h-4 w-4 text-io-purple" />
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(event) => {
                                        setPreset("CUSTOM");
                                        setFromDate(event.target.value);
                                    }}
                                    className="w-full bg-transparent text-sm font-medium text-io-dark outline-none"
                                />
                            </div>
                        </label>

                        <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-black/38">
                                {"Data final"}
                            </span>
                            <div className="flex h-14 items-center gap-3 rounded-[24px] border border-[#6b00e3]/12 bg-[#faf6ff] px-4 transition focus-within:border-[#6b00e3]/24 focus-within:bg-white">
                                <CalendarDays className="h-4 w-4 text-io-purple" />
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(event) => {
                                        setPreset("CUSTOM");
                                        setToDate(event.target.value);
                                    }}
                                    className="w-full bg-transparent text-sm font-medium text-io-dark outline-none"
                                />
                            </div>
                        </label>
                    </div>
                </div>
            </section>

            <section className="rounded-[32px] border border-[#6b00e3]/10 bg-white p-5 shadow-[0_18px_50px_rgba(107,0,227,0.06)] md:p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/34">
                            {"Listagem"}
                        </p>
                        <h2 className="mt-2 font-display text-2xl font-bold text-io-dark">
                            {"Leads recebidos"}
                        </h2>
                    </div>
                </div>

                {error ? (
                    <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="mt-6 grid min-h-[280px] place-items-center rounded-[28px] border border-dashed border-[#6b00e3]/12 bg-[#fcf9ff]">
                        <div className="flex items-center gap-3 text-sm font-medium text-io-purple">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            {"Carregando leads do catálogo..."}
                        </div>
                    </div>
                ) : filteredLeads.length ? (
                    <div className="mt-6 grid gap-4">
                        {filteredLeads.map((lead) => {
                            const previewVehicleData = lead.vehicleId ? vehiclesById[lead.vehicleId] ?? null : null;
                            const whatsappHref = buildWhatsappLeadHref(lead, previewVehicleData);
                            const saleSeller = lead.sellerUserId ? teamMembers.find((member) => member.id === lead.sellerUserId) ?? null : null;

                            return (
                                <article
                                    key={lead.id}
                                    className="rounded-[28px] border border-[#6b00e3]/10 bg-[linear-gradient(180deg,_#ffffff_0%,_#fcf9ff_100%)] px-5 py-5 shadow-[0_16px_34px_rgba(107,0,227,0.05)]"
                                >
                                    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.95fr_0.95fr_auto] xl:items-center">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-2 rounded-full bg-[#f4ebff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-io-purple">
                                                    <UserRound className="h-3.5 w-3.5" />
                                                    {"Lead"}
                                                </span>
                                                {lead.convertedToSale ? (
                                                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        {"Venda concluída"}
                                                    </span>
                                                ) : null}
                                                <span className="text-xs font-medium text-black/42">
                                                    {formatDateTime(lead.createdAt)}
                                                </span>
                                            </div>

                                            <p className="mt-3 text-lg font-bold text-io-dark">{lead.customerName}</p>
                                            <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-black/58">
                                                <Phone className="h-4 w-4 text-io-purple" />
                                                {formatPhone(lead.customerPhone)}
                                            </p>
                                            {lead.convertedToSale ? (
                                                <p className="mt-2 text-sm text-black/52">
                                                    {saleSeller ? `Vendedor: ${saleSeller.fullName}` : "Venda vinculada ao lead"}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">
                                                {"Interesse"}
                                            </p>
                                            {lead.vehicleId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void openVehiclePreview(lead)}
                                                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f7f0ff] px-3 py-2 text-sm font-semibold text-io-dark transition hover:bg-[#efe4ff]"
                                                >
                                                    <CarFront className="h-4 w-4 text-io-purple" />
                                                    <span className="max-w-[240px] truncate">
                                                        {lead.vehicleTitle || "Veículo de interesse"}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f7f0ff] px-3 py-2 text-sm font-semibold text-io-dark">
                                                    <CarFront className="h-4 w-4 text-io-purple" />
                                                    {"Catálogo geral"}
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">
                                                {"Origem"}
                                            </p>
                                            <p className="mt-3 text-sm font-semibold text-io-dark">
                                                {sourceTypeLabel(lead.sourceType)}
                                            </p>
                                            <p className="mt-1 truncate text-sm text-black/52">
                                                {lead.sourceReference || "Sem referência de campanha"}
                                            </p>
                                            <p className="mt-2 truncate text-xs text-black/42">
                                                {lead.pagePath || "Página pública"}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                            {lead.vehicleId && !lead.convertedToSale ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openSaleModal(lead)}
                                                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    {"Fechar venda"}
                                                </button>
                                            ) : null}
                                            {whatsappHref ? (
                                                <a
                                                    href={whatsappHref}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white px-4 py-2 text-sm font-semibold text-io-purple transition hover:border-[#6b00e3]/24 hover:bg-[#faf6ff]"
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    {"Conversar no WhatsApp"}
                                                </a>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-[#f7f0ff] px-4 py-2 text-sm font-medium text-black/45">
                                                    {"Telefone indisponível"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-6 rounded-[28px] border border-dashed border-[#6b00e3]/12 bg-[#fcf9ff] px-6 py-14 text-center">
                        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f4ebff] text-io-purple">
                            <Search className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 font-display text-2xl font-bold text-io-dark">
                            {"Nenhum lead encontrado"}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-black/56">
                            {"Ajuste os filtros para revisar outro período ou aguarde novos formulários vindos do catálogo público."}
                        </p>
                    </div>
                )}
            </section>

            {saleLead ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d0a52]/38 px-4 py-6 backdrop-blur-[3px]">
                    <div className="w-full max-w-xl rounded-[32px] border border-[#6b00e3]/10 bg-white p-6 shadow-[0_30px_80px_rgba(61,16,122,0.24)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-black/35">Fechamento comercial</p>
                                <h3 className="mt-2 font-display text-3xl font-bold text-io-dark">Fechar venda do lead</h3>
                                <p className="mt-2 text-sm text-black/55">
                                    Vincule o vendedor responsável e conclua a venda usando o veículo de interesse já informado neste lead.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="rounded-full border border-black/10 px-3 py-2 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="mt-5 rounded-[24px] bg-black/[0.03] px-4 py-4">
                            <p className="text-sm font-semibold text-io-dark">{saleLead.customerName}</p>
                            <p className="mt-1 text-sm text-black/55">{formatPhone(saleLead.customerPhone)}</p>
                            <p className="mt-2 text-sm text-black/55">{saleLead.vehicleTitle || "Veículo de interesse"}</p>
                        </div>

                        <div className="mt-5 grid gap-2">
                            <label className="text-xs uppercase tracking-[0.22em] text-black/40">Vendedor responsável</label>
                            <select
                                value={saleSellerUserId}
                                onChange={(event) => setSaleSellerUserId(event.target.value)}
                                className="rounded-[22px] border border-black/10 bg-white px-4 py-3 text-sm text-io-dark outline-none transition focus:border-black/25"
                            >
                                <option value="">Selecione um vendedor</option>
                                {teamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.fullName}{member.teamName ? ` • ${member.teamName}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {saleMessage ? (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saleMessage}</div>
                        ) : null}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeSaleModal}
                                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:text-io-dark"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseSale}
                                disabled={saleSubmitting}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/20"
                            >
                                {saleSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Concluir venda
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {previewLead ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d0a52]/38 px-4 py-6 backdrop-blur-[3px]">
                    <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[34px] border border-[#6b00e3]/10 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbf7ff_100%)] shadow-[0_32px_90px_rgba(61,16,122,0.24)]">
                        <button
                            type="button"
                            onClick={closeVehiclePreview}
                            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#6b00e3]/12 bg-white/90 text-io-purple transition hover:bg-white"
                            aria-label="Fechar pré-visualização"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="max-h-[92vh] overflow-y-auto p-5 md:p-6">
                            <div className="flex flex-col gap-3 border-b border-[#6b00e3]/10 pb-5">
                                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {"Pré-visualização do veículo"}
                                </span>
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="font-display text-2xl font-bold text-io-dark md:text-3xl">
                                            {previewLead.vehicleTitle || "Veículo de interesse"}
                                        </h3>
                                        <p className="mt-2 text-sm text-black/56">
                                            {`Lead: ${previewLead.customerName} • ${formatPhone(previewLead.customerPhone)}`}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {previewLead.publicVehiclePath ? (
                                            <a
                                                href={previewLead.publicVehiclePath}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white px-4 py-2 text-sm font-semibold text-io-purple transition hover:border-[#6b00e3]/24 hover:bg-[#faf6ff]"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                {"Abrir página pública"}
                                            </a>
                                        ) : null}
                                        {previewWhatsappHref ? (
                                            <a
                                                href={previewWhatsappHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-full bg-io-purple px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                                {"Falar com o lead"}
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {previewLoading ? (
                                <div className="grid min-h-[360px] place-items-center">
                                    <div className="flex items-center gap-3 text-sm font-medium text-io-purple">
                                        <LoaderCircle className="h-5 w-5 animate-spin" />
                                        {"Carregando pré-visualização do veículo..."}
                                    </div>
                                </div>
                            ) : previewError ? (
                                <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                    {previewError}
                                </div>
                            ) : previewVehicle ? (
                                <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
                                    <div className="rounded-[30px] border border-[#6b00e3]/10 bg-white p-4 shadow-[0_18px_44px_rgba(107,0,227,0.06)]">
                                        <div className="overflow-hidden rounded-[24px] bg-[#f5efff]">
                                            {previewImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={previewImage}
                                                    alt={previewVehicle.title}
                                                    className="h-[280px] w-full object-cover md:h-[420px]"
                                                />
                                            ) : (
                                                <div className="grid h-[280px] place-items-center text-sm font-medium text-black/42 md:h-[420px]">
                                                    {"Sem imagens disponíveis"}
                                                </div>
                                            )}
                                        </div>

                                        {previewImages.length > 1 ? (
                                            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                                                {previewImages.map((imageUrl) => (
                                                    <button
                                                        key={imageUrl}
                                                        type="button"
                                                        onClick={() => setPreviewImage(imageUrl)}
                                                        className={`overflow-hidden rounded-[18px] border transition ${
                                                            imageUrl === previewImage
                                                                ? "border-[#6b00e3]/40 shadow-[0_12px_28px_rgba(107,0,227,0.16)]"
                                                                : "border-[#6b00e3]/10"
                                                        }`}
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={imageUrl}
                                                            alt={previewVehicle.title}
                                                            className="h-20 w-24 object-cover md:h-24 md:w-32"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-col gap-5 rounded-[30px] border border-[#6b00e3]/10 bg-white p-5 shadow-[0_18px_44px_rgba(107,0,227,0.06)]">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-[#f4ebff] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-io-purple">
                                                {previewVehicle.brand}
                                            </span>
                                            {previewVehicle.featured ? (
                                                <span className="rounded-full bg-io-purple px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                                                    {"Destaque"}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div>
                                            <p className="text-3xl font-bold tracking-tight text-io-dark md:text-4xl">
                                                {formatMoney(previewVehicle.priceCents)}
                                            </p>
                                            <h4 className="mt-3 font-display text-2xl font-bold text-io-dark">
                                                {previewVehicle.title}
                                            </h4>
                                            <p className="mt-2 text-sm leading-6 text-black/58">
                                                {previewVehicle.description || "Este veículo não possui descrição cadastrada no momento."}
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Ano</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <CalendarDays className="h-4 w-4 text-io-purple" />
                                                    {formatVehicleYears(previewVehicle)}
                                                </p>
                                            </div>
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Quilometragem</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <Gauge className="h-4 w-4 text-io-purple" />
                                                    {formatMileage(previewVehicle.mileage)}
                                                </p>
                                            </div>
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Câmbio</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <Settings2 className="h-4 w-4 text-io-purple" />
                                                    {previewVehicle.transmission || "Não informado"}
                                                </p>
                                            </div>
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Combustível</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <Sparkles className="h-4 w-4 text-io-purple" />
                                                    {previewVehicle.fuelType || "Não informado"}
                                                </p>
                                            </div>
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Cor</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <Palette className="h-4 w-4 text-io-purple" />
                                                    {previewVehicle.color || "Não informado"}
                                                </p>
                                            </div>
                                            <div className="rounded-[22px] bg-[#faf6ff] px-4 py-3">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">Localização</p>
                                                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                                                    <MapPin className="h-4 w-4 text-io-purple" />
                                                    {buildVehicleLocation(previewVehicle)}
                                                </p>
                                            </div>
                                        </div>

                                        {previewVehicle.optionals.length ? (
                                            <div className="rounded-[24px] border border-[#6b00e3]/10 bg-[#fcf9ff] px-4 py-4">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">
                                                    {"Destaques da ficha"}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {previewVehicle.optionals.slice(0, 8).map((optional) => (
                                                        <span
                                                            key={optional}
                                                            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-io-dark shadow-[0_8px_18px_rgba(107,0,227,0.05)]"
                                                        >
                                                            <ShieldCheck className="h-3.5 w-3.5 text-io-purple" />
                                                            {optional}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6 rounded-[24px] border border-[#6b00e3]/10 bg-[#fcf9ff] px-4 py-5 text-sm text-black/58">
                                    {"Ainda não foi possível montar a pré-visualização deste veículo."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
