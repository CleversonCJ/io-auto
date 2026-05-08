"use client";

import { useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    CarFront,
    ExternalLink,
    LoaderCircle,
    Phone,
    RefreshCw,
    Search,
    Sparkles,
    UserRound,
} from "lucide-react";
import { formatDateTime } from "@/modules/ioauto/formatters";
import type { PublicCatalogLeadList } from "@/modules/ioauto/types";

const PRESET_OPTIONS = [
    { value: "LAST_7_DAYS", label: "\u00DAltimos 7 dias" },
    { value: "LAST_30_DAYS", label: "\u00DAltimos 30 dias" },
    { value: "LAST_MONTH", label: "M\u00EAs passado" },
    { value: "CUSTOM", label: "Per\u00EDodo personalizado" },
] as const;

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
                    const payload = await response.json().catch(() => ({ message: "Falha ao carregar os leads do cat\u00E1logo." }));
                    throw new Error(payload.message ?? "Falha ao carregar os leads do cat\u00E1logo.");
                }

                const payload = await response.json() as PublicCatalogLeadList;
                if (!active) return;

                setData(payload);
                setError(null);
            } catch (cause) {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : "Falha ao carregar os leads do cat\u00E1logo.");
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
        if (!data) return "Per\u00EDodo carregando...";
        return `${formatDate(data.fromDate)} at\u00E9 ${formatDate(data.toDate)}`;
    }, [data]);

    return (
        <div className="grid gap-6">
            <section className="overflow-hidden rounded-[34px] border border-[#6b00e3]/10 bg-[radial-gradient(circle_at_top_left,_rgba(154,92,255,0.18),_transparent_46%),linear-gradient(180deg,_#ffffff_0%,_#fbf7ff_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(107,0,227,0.08)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-io-purple">
                            <Sparkles className="h-3.5 w-3.5" />
                            {"Leads do cat\u00E1logo"}
                        </span>
                        <h1 className="mt-4 font-display text-[1.95rem] font-bold leading-tight text-io-dark md:text-[2.35rem]">
                            {"Leads captados antes do WhatsApp"}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-black/58">
                            {"Acompanhe quem preencheu o formul\u00E1rio do cat\u00E1logo p\u00FAblico, veja o ve\u00EDculo de interesse e filtre o resultado pelo per\u00EDodo que fizer mais sentido para a opera\u00E7\u00E3o."}
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-3 rounded-[28px] border border-[#6b00e3]/10 bg-white/80 px-5 py-4 shadow-[0_14px_28px_rgba(107,0,227,0.06)] md:items-end">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/36">
                                {"Per\u00EDodo aplicado"}
                            </p>
                            <p className="mt-2 text-base font-semibold text-io-dark">{periodLabel}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setRefreshTick((value) => value + 1)}
                            className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-[#f8f2ff] px-4 py-2 text-sm font-semibold text-io-purple transition hover:border-[#6b00e3]/25 hover:bg-white"
                        >
                            <RefreshCw className="h-4 w-4" />
                            {"Atualizar"}
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LeadMetricCard
                    label="Total de leads"
                    value={String(data?.totalLeads ?? 0)}
                    helper={"Todos os formul\u00E1rios conclu\u00EDdos no per\u00EDodo filtrado."}
                />
                <LeadMetricCard
                    label="Com ve\u00EDculo"
                    value={String(data?.leadsWithVehicle ?? 0)}
                    helper={"Leads que vieram de um an\u00FAncio de ve\u00EDculo espec\u00EDfico."}
                />
                <LeadMetricCard
                    label="Com campanha"
                    value={String(data?.leadsWithCampaign ?? 0)}
                    helper={"Leads com refer\u00EAncia de origem rastreada no link p\u00FAblico."}
                />
                <LeadMetricCard
                    label="Telefones \u00FAnicos"
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
                                {"Use os atalhos r\u00E1pidos ou selecione um per\u00EDodo personalizado para revisar os leads."}
                            </p>
                        </div>

                        <div className="rounded-full bg-[#f7f0ff] px-4 py-3 text-sm font-medium text-io-purple">
                            {`${filteredLeads.length} lead(s) vis\u00EDvel(is)`}
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
                                    placeholder="Nome, telefone, ve\u00EDculo ou campanha"
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
                            {"Carregando leads do cat\u00E1logo..."}
                        </div>
                    </div>
                ) : filteredLeads.length ? (
                    <div className="mt-6 grid gap-4">
                        {filteredLeads.map((lead) => (
                            <article
                                key={lead.id}
                                className="rounded-[28px] border border-[#6b00e3]/10 bg-[linear-gradient(180deg,_#ffffff_0%,_#fcf9ff_100%)] px-5 py-5 shadow-[0_16px_34px_rgba(107,0,227,0.05)]"
                            >
                                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.95fr_0.9fr_auto] xl:items-center">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-full bg-[#f4ebff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-io-purple">
                                                <UserRound className="h-3.5 w-3.5" />
                                                {"Lead"}
                                            </span>
                                            <span className="text-xs font-medium text-black/42">
                                                {formatDateTime(lead.createdAt)}
                                            </span>
                                        </div>

                                        <p className="mt-3 text-lg font-bold text-io-dark">{lead.customerName}</p>
                                        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-black/58">
                                            <Phone className="h-4 w-4 text-io-purple" />
                                            {formatPhone(lead.customerPhone)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">
                                            {"Interesse"}
                                        </p>
                                        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f7f0ff] px-3 py-2 text-sm font-semibold text-io-dark">
                                            <CarFront className="h-4 w-4 text-io-purple" />
                                            {lead.vehicleTitle || "Cat\u00E1logo geral"}
                                        </p>
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/34">
                                            {"Origem"}
                                        </p>
                                        <p className="mt-3 text-sm font-semibold text-io-dark">
                                            {sourceTypeLabel(lead.sourceType)}
                                        </p>
                                        <p className="mt-1 truncate text-sm text-black/52">
                                            {lead.sourceReference || "Sem refer\u00EAncia de campanha"}
                                        </p>
                                        <p className="mt-2 truncate text-xs text-black/42">
                                            {lead.pagePath || "P\u00E1gina p\u00FAblica"}
                                        </p>
                                    </div>

                                    <div className="flex xl:justify-end">
                                        {lead.sourceUrl ? (
                                            <a
                                                href={lead.sourceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-full border border-[#6b00e3]/12 bg-white px-4 py-2 text-sm font-semibold text-io-purple transition hover:border-[#6b00e3]/24 hover:bg-[#faf6ff]"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                {"Abrir origem"}
                                            </a>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-[#f7f0ff] px-4 py-2 text-sm font-medium text-black/45">
                                                {"Origem indispon\u00EDvel"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
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
                            {"Ajuste os filtros para revisar outro per\u00EDodo ou aguarde novos formul\u00E1rios vindos do cat\u00E1logo p\u00FAblico."}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
