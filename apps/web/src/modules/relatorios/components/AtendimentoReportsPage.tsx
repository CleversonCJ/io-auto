"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts";
import "highcharts/modules/heatmap";
import "highcharts/highcharts-more";
import { ArrowRightToLine, CircleHelp, Equal, Minus, Plus, RefreshCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });
const REPORTS_AUTO_REFRESH_INTERVAL_MS = 15000;

type TeamOption = { id: string; name: string };
type UserOption = { id: string; fullName: string; teamId?: string | null; teamName?: string | null };
type OverviewResponse = {
    channels: Array<{ id: string; label: string }>;
    cards: { pendingBeforePeriod: number; newInPeriod: number; completedInPeriod: number; pendingAfterPeriod: number };
    capacitySeries: Array<{ date: string; newCount: number; completedCount: number; pendingCount: number }>;
    waitTime: { averageSeconds: number | null; series: Array<{ date: string; averageSeconds: number; startedCount: number }> };
    duration: { averageSeconds: number | null; series: Array<{ date: string; averageSeconds: number; completedCount: number }> };
    channelRanking: Array<{ id: string; label: string; total: number }>;
    tagRanking: Array<{ id: string; label: string; color: string | null; total: number }>;
    volumeHeatmap: { points: Array<{ date: string; hour: number; total: number }>; peak: { date: string; hour: number; total: number } | null };
};
type UserReportResponse = { rows: Array<{ userId: string; userName: string; completedCount: number; achievedCount: number; achievedPercentage: number; lostCount: number; averageFirstResponseSeconds: number | null; averageAttendanceSeconds: number | null }> };
type ResultsReportResponse = { unclassifiedCount: number; classifications: Array<{ key: string; categoryLabel: string; classificationTitle: string; total: number; percentage: number }>; unclassifiedAttendances: Array<{ sessionId: string; channel: string; contactName: string; responsibleUserName: string; startedAt: string | null; durationSeconds: number | null }> };
type TabKey = "geral" | "usuario" | "resultados";
type ReportFilters = { startDate: string; endDate: string; userId: string; teamId: string; channelId: string; timeZone: string };

function defaultRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const toInput = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return { startDate: toInput(start), endDate: toInput(end) };
}

function formatDay(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
function formatDateTime(value: string | null) { return value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"; }
function formatNumber(value: number | null | undefined) { return Number(value ?? 0).toLocaleString("pt-BR"); }
function formatPercent(value: number | null | undefined) { return `${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
function movingAverage(
    values: Array<{ averageSeconds: number }>,
    countResolver: (item: { averageSeconds: number } & Record<string, unknown>) => number,
    windowSize = 3
) {
    return values.map((_, index) => {
        const validWindow: number[] = [];
        for (let cursor = index; cursor >= 0 && validWindow.length < windowSize; cursor -= 1) {
            const item = values[cursor] as { averageSeconds: number } & Record<string, unknown>;
            if (countResolver(item) > 0 && Number.isFinite(item.averageSeconds) && item.averageSeconds > 0) {
                validWindow.unshift(item.averageSeconds);
            }
        }
        if (!validWindow.length) return 0;
        return validWindow.reduce((sum, current) => sum + current, 0) / validWindow.length;
    });
}
function formatSeconds(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return "-";
    const total = Math.max(0, Math.round(value));
    if (total < 60) return `${total}s`;
    if (total < 3600) return `${Math.floor(total / 60)}min${total % 60 ? ` ${total % 60}s` : ""}`;
    return `${Math.floor(total / 3600)}h${Math.floor((total % 3600) / 60) ? ` ${Math.floor((total % 3600) / 60)}min` : ""}`;
}
function queryString(filters: { startDate: string; endDate: string; userId: string; teamId: string; channelId: string; timeZone: string }) {
    const query = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate, timeZone: filters.timeZone });
    if (filters.userId) query.set("userId", filters.userId);
    if (filters.teamId) query.set("teamId", filters.teamId);
    if (filters.channelId) query.set("channelId", filters.channelId);
    return query.toString();
}
async function fetchJson<T>(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message ?? "Falha ao carregar dados");
    return data as T;
}
function chartBase(title: string): Highcharts.Options {
    return {
        chart: { backgroundColor: "transparent", style: { fontFamily: "inherit" } },
        title: { text: title, align: "left", style: { color: "#2B2B2B", fontSize: "16px", fontWeight: "600" } },
        credits: { enabled: false },
        xAxis: { labels: { style: { color: "#5c6272" } }, lineColor: "#E5E7EB", tickColor: "#E5E7EB" },
        yAxis: { title: { text: undefined }, labels: { style: { color: "#5c6272" } }, gridLineColor: "#EEF2F7" },
        tooltip: { borderRadius: 14, backgroundColor: "rgba(43,43,43,0.94)", style: { color: "#FFFFFF" } },
        legend: { itemStyle: { color: "#2B2B2B", fontWeight: "500" } },
    };
}
function escapeHtmlAttribute(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function legendWithHelp(helpBySeriesName: Record<string, string>): Highcharts.LegendOptions {
    return {
        ...(chartBase("").legend ?? {}),
        useHTML: true,
        labelFormatter: function () {
            const name = String(this.name ?? "");
            const help = helpBySeriesName[name];
            if (!help) return name;
            return `<span style="display:inline-flex;align-items:center;gap:6px;">${name}<span title="${escapeHtmlAttribute(help)}" style="display:inline-grid;place-items:center;width:16px;height:16px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:700;cursor:help;line-height:1;">?</span></span>`;
        },
    };
}
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-black/10 bg-white p-5 shadow-soft ${className}`}>{children}</section>; }

export function AtendimentoReportsPage() {
    const initialRange = useMemo(() => defaultRange(), []);
    const initialFilters = useMemo<ReportFilters>(() => ({ ...initialRange, userId: "", teamId: "", channelId: "", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo" }), [initialRange]);
    const [tab, setTab] = useState<TabKey>("geral");
    const [filters, setFilters] = useState<ReportFilters>(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(initialFilters);
    const [overview, setOverview] = useState<OverviewResponse | null>(null);
    const [userReport, setUserReport] = useState<UserReportResponse | null>(null);
    const [results, setResults] = useState<ResultsReportResponse | null>(null);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showUnclassified, setShowUnclassified] = useState(false);
    const appliedFiltersRef = useRef<ReportFilters>(initialFilters);
    const pendingFiltersRef = useRef<ReportFilters | null>(null);
    const refreshInFlightRef = useRef(false);
    const filteredUsers = useMemo(
        () => (filters.teamId ? users.filter((user) => user.teamId === filters.teamId) : users),
        [filters.teamId, users]
    );

    async function loadReports(nextFilters = appliedFiltersRef.current, options?: { background?: boolean }) {
        if (refreshInFlightRef.current) {
            pendingFiltersRef.current = nextFilters;
            return;
        }

        refreshInFlightRef.current = true;
        pendingFiltersRef.current = null;
        const hasLoadedData = Boolean(overview || userReport || results);
        if (!hasLoadedData && !options?.background) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }
        setError(null);
        try {
            const query = queryString(nextFilters);
            const [overviewData, userData, resultsData] = await Promise.all([
                fetchJson<OverviewResponse>(`/api/relatorios/atendimentos/overview?${query}`),
                fetchJson<UserReportResponse>(`/api/relatorios/atendimentos/users?${query}`),
                fetchJson<ResultsReportResponse>(`/api/relatorios/atendimentos/results?${query}`),
            ]);
            setOverview(overviewData);
            setUserReport(userData);
            setResults(resultsData);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar relatórios");
        } finally {
            refreshInFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
            if (pendingFiltersRef.current) {
                const queuedFilters = pendingFiltersRef.current;
                pendingFiltersRef.current = null;
                window.setTimeout(() => {
                    void loadReports(queuedFilters, { background: true });
                }, 180);
            }
        }
    }

    useEffect(() => {
        appliedFiltersRef.current = appliedFilters;
    }, [appliedFilters]);

    useEffect(() => {
        void loadReports(appliedFilters);
    }, [appliedFilters]);

    useEffect(() => {
        Promise.all([
            fetchJson<UserOption[]>("/api/atendimentos/users").catch(() => []),
            fetchJson<TeamOption[]>("/api/atendimentos/teams").catch(() => []),
        ]).then(([usersData, teamsData]) => {
            setUsers(usersData);
            setTeams(teamsData);
        });
    }, []);
    useEffect(() => {
        if (!filters.userId) return;
        if (filteredUsers.some((user) => user.id === filters.userId)) return;
        setFilters((current) => ({ ...current, userId: "" }));
    }, [filteredUsers, filters.userId]);
    useEffect(() => {
        function triggerRefresh() {
            if (document.hidden) return;
            void loadReports(appliedFiltersRef.current, { background: true });
        }

        const intervalId = window.setInterval(triggerRefresh, REPORTS_AUTO_REFRESH_INTERVAL_MS);
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                triggerRefresh();
            }
        };
        const handleFocus = () => {
            if (!document.hidden) {
                triggerRefresh();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    const capacityOptions = useMemo<Highcharts.Options>(() => ({ ...chartBase("Capacidade de atendimento"), legend: legendWithHelp({ Novos: "Quantidade de atendimentos que chegaram no dia dentro do período filtrado.", Concluídos: "Quantidade de atendimentos concluídos no dia dentro do período filtrado.", Pendentes: "Backlog acumulado de atendimentos pendentes ao final de cada dia." }), xAxis: { ...chartBase("").xAxis, categories: overview?.capacitySeries.map((item) => formatDay(item.date)) ?? [] }, series: [{ type: "column", name: "Novos", data: overview?.capacitySeries.map((item) => item.newCount) ?? [], color: "#6b00e3" }, { type: "column", name: "Concluídos", data: overview?.capacitySeries.map((item) => item.completedCount) ?? [], color: "#0ea5e9" }, { type: "spline", name: "Pendentes", data: overview?.capacitySeries.map((item) => item.pendingCount) ?? [], color: "#6b00e3" }] }), [overview]);
    const waitTrendSeconds = useMemo(
        () => movingAverage(overview?.waitTime.series ?? [], (item) => Number(item.startedCount ?? 0), 3),
        [overview]
    );
    const waitOptions = useMemo<Highcharts.Options>(() => ({
        ...chartBase("Tempo médio de espera"),
        chart: { ...(chartBase("").chart ?? {}), backgroundColor: "transparent", height: 360 },
        subtitle: {
            useHTML: true,
            align: "left",
            text: `Foram considerados <b>${formatNumber((overview?.waitTime.series ?? []).reduce((sum, item) => sum + item.startedCount, 0))}</b> atendimentos iniciados pelo cliente no período selecionado e que tiveram participação humana.`,
            style: { color: "#5c6272", fontSize: "13px" },
        },
        xAxis: {
            ...chartBase("").xAxis,
            categories: overview?.waitTime.series.map((item) => formatDay(item.date)) ?? [],
        },
        yAxis: [
            {
                title: { text: "Tempo de espera" },
                labels: {
                    style: { color: "#5c6272" },
                    formatter: function () {
                        return formatSeconds(Number(this.value ?? 0));
                    },
                },
                gridLineColor: "#EEF2F7",
            },
            {
                title: { text: "Iniciados" },
                labels: { style: { color: "#5c6272" } },
                allowDecimals: false,
                opposite: true,
            },
        ],
        plotOptions: {
            column: {
                borderRadius: 8,
                pointPadding: 0.14,
                groupPadding: 0.12,
            },
            spline: {
                marker: { enabled: false },
            },
        },
        legend: legendWithHelp({
            "Tempo de espera": "Média diária do tempo entre a chegada do cliente e o início do atendimento humano.",
            "Tendência de espera": "Média móvel simples de 3 dias da série de tempo médio de espera.",
            "Atendimentos iniciados": "Quantidade de atendimentos do dia que tiveram participação humana.",
        }),
        tooltip: { shared: true },
        series: [
            {
                type: "spline",
                name: "Tempo de espera",
                data: overview?.waitTime.series.map((item) => item.averageSeconds) ?? [],
                color: "#f97316",
                lineWidth: 3,
                zIndex: 3,
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatSeconds(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
            {
                type: "spline",
                name: "Tendência de espera",
                data: waitTrendSeconds,
                color: "#93c5fd",
                dashStyle: "ShortDash",
                lineWidth: 3,
                zIndex: 2,
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatSeconds(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
            {
                type: "column",
                name: "Atendimentos iniciados",
                yAxis: 1,
                data: overview?.waitTime.series.map((item) => item.startedCount) ?? [],
                color: "#facc15",
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatNumber(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
        ],
    }), [overview, waitTrendSeconds]);
    const durationTrendSeconds = useMemo(
        () => movingAverage(overview?.duration.series ?? [], (item) => Number(item.completedCount ?? 0), 3),
        [overview]
    );
    const durationOptions = useMemo<Highcharts.Options>(() => ({
        ...chartBase("Duração média do atendimento"),
        chart: { ...(chartBase("").chart ?? {}), backgroundColor: "transparent", height: 360 },
        subtitle: {
            useHTML: true,
            align: "left",
            text: `Foram considerados <b>${formatNumber((overview?.duration.series ?? []).reduce((sum, item) => sum + item.completedCount, 0))}</b> atendimentos iniciados pelo cliente no período selecionado, com participação humana e conclusão registrada.`,
            style: { color: "#5c6272", fontSize: "13px" },
        },
        xAxis: {
            ...chartBase("").xAxis,
            categories: overview?.duration.series.map((item) => formatDay(item.date)) ?? [],
        },
        yAxis: [
            {
                title: { text: "Duração" },
                labels: {
                    style: { color: "#5c6272" },
                    formatter: function () {
                        return formatSeconds(Number(this.value ?? 0));
                    },
                },
                gridLineColor: "#EEF2F7",
            },
            {
                title: { text: "Concluídos" },
                labels: { style: { color: "#5c6272" } },
                allowDecimals: false,
                opposite: true,
            },
        ],
        plotOptions: {
            column: {
                borderRadius: 8,
                pointPadding: 0.14,
                groupPadding: 0.12,
            },
            spline: {
                marker: { enabled: false },
            },
        },
        legend: legendWithHelp({
            "Duração média": "Média diária da duração entre o início humano e a conclusão dos atendimentos elegíveis.",
            "Tendência de duração": "Média móvel simples de 3 dias da duração média diária.",
            "Atendimentos concluídos": "Quantidade de atendimentos elegíveis concluídos em cada dia do agrupamento.",
        }),
        tooltip: { shared: true },
        series: [
            {
                type: "spline",
                name: "Duração média",
                data: overview?.duration.series.map((item) => item.averageSeconds) ?? [],
                color: "#06b6d4",
                lineWidth: 3,
                zIndex: 3,
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatSeconds(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
            {
                type: "spline",
                name: "Tendência de duração",
                data: durationTrendSeconds,
                color: "#7dd3fc",
                dashStyle: "ShortDash",
                lineWidth: 3,
                zIndex: 2,
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatSeconds(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
            {
                type: "column",
                name: "Atendimentos concluídos",
                yAxis: 1,
                data: overview?.duration.series.map((item) => item.completedCount) ?? [],
                color: "#6b00e3",
                tooltip: {
                    pointFormatter: function () {
                        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatNumber(Number(this.y ?? 0))}</b><br/>`;
                    },
                },
            },
        ],
    }), [durationTrendSeconds, overview]);
    const channelOptions = useMemo<Highcharts.Options>(() => ({ ...chartBase("Atendimento por canal"), legend: legendWithHelp({ Atendimentos: "Quantidade de atendimentos elegíveis agrupados por canal no período filtrado." }), chart: { ...(chartBase("").chart ?? {}), type: "bar", backgroundColor: "transparent" }, xAxis: { ...chartBase("").xAxis, categories: overview?.channelRanking.map((item) => item.label) ?? [] }, series: [{ type: "bar", name: "Atendimentos", data: overview?.channelRanking.map((item) => item.total) ?? [], color: "#6b00e3" }] }), [overview]);
    const tagOptions = useMemo<Highcharts.Options>(() => ({ ...chartBase("Etiquetas mais utilizadas"), legend: legendWithHelp({ Etiquetas: "Quantidade de atendimentos do período que utilizaram cada etiqueta." }), chart: { ...(chartBase("").chart ?? {}), type: "bar", backgroundColor: "transparent" }, xAxis: { ...chartBase("").xAxis, categories: overview?.tagRanking.map((item) => item.label) ?? [] }, yAxis: { ...chartBase("").yAxis, allowDecimals: false }, tooltip: { pointFormatter: function () { return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatNumber(Number(this.y ?? 0))}</b><br/>`; } }, series: [{ type: "bar", name: "Etiquetas", data: overview?.tagRanking.map((item) => ({ y: item.total, color: item.color ?? "#64748b" })) ?? [] }] }), [overview]);
    const heatmapOptions = useMemo<Highcharts.Options>(() => {
        const dates = Array.from(new Set(overview?.volumeHeatmap.points.map((item) => item.date) ?? []));
        return { ...chartBase("Volume diário de atendimentos"), chart: { ...(chartBase("").chart ?? {}), type: "heatmap", backgroundColor: "transparent", height: 360 }, xAxis: { ...chartBase("").xAxis, categories: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}h`) }, yAxis: { ...chartBase("").yAxis, categories: dates.map(formatDay), reversed: true }, colorAxis: { min: 0, minColor: "#F4F0FF", maxColor: "#6b00e3" }, legend: { align: "right", layout: "vertical", verticalAlign: "middle" }, series: [{ type: "heatmap", name: "Chegadas", borderWidth: 6, borderColor: "#FFFFFF", data: (overview?.volumeHeatmap.points ?? []).map((item) => [item.hour, dates.indexOf(item.date), item.total]), dataLabels: { enabled: false } }] };
    }, [overview]);
    return (
        <section className="space-y-6">
            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-soft">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <p className="text-sm font-semibold text-black/55">Filtros do relatório</p>
                    <button type="button" onClick={() => void loadReports(appliedFiltersRef.current, { background: true })} className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-semibold text-io-dark transition hover:bg-black/5"><RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />{refreshing ? "Atualizando..." : "Atualizar"}</button>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
                    <input type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} className="h-11 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    <input type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} className="h-11 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    <select value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))} className="h-11 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-sm outline-none focus:border-black/25 focus:bg-white"><option value="">Todos os usuários</option>{filteredUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select>
                    <select value={filters.teamId} onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))} className="h-11 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-sm outline-none focus:border-black/25 focus:bg-white"><option value="">Todas as equipes</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
                    <select value={filters.channelId} onChange={(event) => setFilters((current) => ({ ...current, channelId: event.target.value }))} className="h-11 rounded-xl border border-black/10 bg-[#fafafa] px-3 text-sm outline-none focus:border-black/25 focus:bg-white"><option value="">Todos os canais</option>{(overview?.channels ?? []).map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select>
                    <button type="button" onClick={() => setAppliedFilters({ ...filters })} className="h-11 rounded-xl bg-io-purple px-5 text-sm font-semibold text-white transition hover:brightness-110">Aplicar</button>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">{(["geral", "usuario", "resultados"] as TabKey[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`h-11 rounded-full px-5 text-sm font-semibold transition ${tab === item ? "bg-io-purple text-white shadow-soft" : "border border-black/10 bg-white text-black/60 hover:bg-black/5"}`}>{item === "geral" ? "Geral" : item === "usuario" ? "Usuário" : "Resultados"}</button>)}</div>
            </div>

            {loading ? (
                <SystemPageLoader
                    compact
                    label="Carregando relatórios"
                    description="Calculando indicadores e comparativos..."
                    className="rounded-2xl border border-black/10 bg-white shadow-soft"
                />
            ) : null}
            {!loading && error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 shadow-soft">{error}</div> : null}

            {!loading && !error && tab === "geral" && overview ? (
                <div className="space-y-6">
                    <div className="grid gap-4 xl:grid-cols-4">
                        {[
                            {
                                title: "Pendentes",
                                subtitle: "antes do período",
                                value: overview.cards.pendingBeforePeriod,
                                icon: ArrowRightToLine,
                                palette: "bg-indigo-100 text-indigo-700",
                            },
                            {
                                title: "Novos",
                                subtitle: "no período",
                                value: overview.cards.newInPeriod,
                                icon: Plus,
                                palette: "bg-sky-100 text-sky-700",
                            },
                            {
                                title: "Concluídos",
                                subtitle: "no período",
                                value: overview.cards.completedInPeriod,
                                icon: Minus,
                                palette: "bg-emerald-100 text-emerald-700",
                            },
                            {
                                title: "Pendentes",
                                subtitle: "após o período",
                                value: overview.cards.pendingAfterPeriod,
                                icon: Equal,
                                palette: "bg-amber-100 text-amber-700",
                            },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={`${item.title}-${item.subtitle}`} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                                    <div className="flex items-center justify-between">
                                        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${item.palette}`}>
                                            <Icon className="h-5 w-5" strokeWidth={2.4} />
                                        </span>
                                        <p className="text-4xl font-bold tracking-tight text-io-dark">{formatNumber(Number(item.value))}</p>
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-black/80">{item.title}</p>
                                    <p className="text-xs text-black/55">{item.subtitle}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                        <Panel><HighchartsReact highcharts={Highcharts} options={capacityOptions} /></Panel>
                        <Panel><p className="text-sm font-semibold text-io-dark">Resumo de tempo</p><div className="mt-4 space-y-4"><div className="rounded-2xl bg-[#f6f1ff] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Tempo médio de espera</p><p className="mt-3 text-2xl font-semibold text-io-dark">{formatSeconds(overview.waitTime.averageSeconds)}</p></div><div className="rounded-2xl bg-[#eef8ff] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Duração média</p><p className="mt-3 text-2xl font-semibold text-io-dark">{formatSeconds(overview.duration.averageSeconds)}</p></div><div className="rounded-2xl bg-[#fff8ea] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Pico de atendimento</p><p className="mt-3 text-2xl font-semibold text-io-dark">{overview.volumeHeatmap.peak ? `${formatDay(overview.volumeHeatmap.peak.date)} • ${String(overview.volumeHeatmap.peak.hour).padStart(2, "0")}h` : "-"}</p><p className="mt-1 text-sm text-black/55">{overview.volumeHeatmap.peak ? `${formatNumber(overview.volumeHeatmap.peak.total)} chegada(s)` : "Sem pico calculado."}</p></div></div></Panel>
                    </div>
                    <div className="grid gap-6"><Panel><HighchartsReact highcharts={Highcharts} options={waitOptions} /></Panel><Panel><HighchartsReact highcharts={Highcharts} options={durationOptions} /></Panel></div>
                    <div className="grid gap-6 xl:grid-cols-2"><Panel>{overview.channelRanking.length ? <HighchartsReact highcharts={Highcharts} options={channelOptions} /> : <p className="text-sm text-black/55">Sem dados de canal no período.</p>}</Panel><Panel>{overview.tagRanking.length ? <HighchartsReact highcharts={Highcharts} options={tagOptions} /> : <p className="text-sm text-black/55">Sem etiquetas associadas no período.</p>}</Panel></div>
                    <Panel>{overview.volumeHeatmap.points.length ? <HighchartsReact highcharts={Highcharts} options={heatmapOptions} /> : <p className="text-sm text-black/55">Sem volume suficiente para montar o mapa de calor.</p>}</Panel>
                </div>
            ) : null}

            {!loading && !error && tab === "usuario" ? (
                userReport && userReport.rows.length ? (
                    <Panel className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-0">
                            <thead><tr className="text-left text-xs uppercase tracking-[0.12em] text-black/45"><th className="border-b border-black/10 px-4 py-3">Nome do usuário</th><th className="border-b border-black/10 px-4 py-3">Concluídos</th><th className="border-b border-black/10 px-4 py-3">Objetivos atingidos</th><th className="border-b border-black/10 px-4 py-3">Objetivos perdidos</th><th className="border-b border-black/10 px-4 py-3">Primeira resposta</th><th className="border-b border-black/10 px-4 py-3">Tempo de atendimento</th></tr></thead>
                            <tbody>{userReport.rows.map((row) => <tr key={row.userId} className="text-sm text-io-dark"><td className="border-b border-black/5 px-4 py-4 font-semibold">{row.userName}</td><td className="border-b border-black/5 px-4 py-4">{formatNumber(row.completedCount)}</td><td className="border-b border-black/5 px-4 py-4"><div>{formatNumber(row.achievedCount)}</div><div className="text-xs text-emerald-700">{formatPercent(row.achievedPercentage)}</div></td><td className="border-b border-black/5 px-4 py-4">{formatNumber(row.lostCount)}</td><td className="border-b border-black/5 px-4 py-4">{formatSeconds(row.averageFirstResponseSeconds)}</td><td className="border-b border-black/5 px-4 py-4">{formatSeconds(row.averageAttendanceSeconds)}</td></tr>)}</tbody>
                        </table>
                    </Panel>
                ) : <Panel><p className="text-sm text-black/55">Nenhum usuário com dados no período selecionado.</p></Panel>
            ) : null}

            {!loading && !error && tab === "resultados" && results ? (
                <div className="space-y-6">
                    <Panel className="p-4 sm:p-5">
                        <div className="rounded-[24px] border border-black/5 bg-[#f5f7fb] p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xl font-semibold text-io-dark">Classificação de atendimentos</p>
                                    <p className="mt-1 text-sm text-black/55">Distribuição dos atendimentos concluídos no período com base na classificação final registrada.</p>
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">Base</p>
                                    <p className="mt-1 text-lg font-semibold text-io-dark">{formatNumber(results.classifications.reduce((sum, item) => sum + item.total, 0))}</p>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 xl:grid-cols-4">
                                {results.classifications.map((item) => {
                                    const categoryLabel = item.categoryLabel;
                                    const classificationTitle = item.classificationTitle;
                                    const tone = item.key === "OBJECTIVE_ACHIEVED"
                                        ? {
                                            icon: ThumbsUp,
                                            iconContainer: "bg-emerald-100/90",
                                            accentBg: "bg-emerald-100",
                                            accentText: "text-emerald-700",
                                            progressBg: "bg-emerald-500",
                                            surfaceBg: "bg-emerald-50/45",
                                        }
                                        : item.key === "OBJECTIVE_LOST"
                                            ? {
                                                icon: ThumbsDown,
                                                iconContainer: "bg-rose-100/90",
                                                accentBg: "bg-rose-100",
                                                accentText: "text-rose-700",
                                                progressBg: "bg-rose-500",
                                                surfaceBg: "bg-rose-50/45",
                                            }
                                            : item.key === "QUESTION"
                                                ? {
                                                    icon: CircleHelp,
                                                    iconContainer: "bg-sky-100/90",
                                                    accentBg: "bg-sky-100",
                                                    accentText: "text-sky-700",
                                                    progressBg: "bg-sky-500",
                                                    surfaceBg: "bg-sky-50/45",
                                                }
                                                : {
                                                    icon: Equal,
                                                    iconContainer: "bg-amber-100/90",
                                                    accentBg: "bg-amber-100",
                                                    accentText: "text-amber-700",
                                                    progressBg: "bg-amber-500",
                                                    surfaceBg: "bg-amber-50/45",
                                                };
                                    const Icon = tone.icon;
                                    return (
                                        <div key={item.key} className="rounded-[22px] border border-black/5 bg-[#eaf0f7] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                                            <div className="flex min-h-[72px] items-center justify-center gap-3 px-3 py-3 text-center">
                                                <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone.iconContainer} ${tone.accentText}`}>
                                                    <Icon className="h-5 w-5" strokeWidth={2.3} />
                                                </div>
                                                <div>
                                                    <p className="text-base font-semibold text-io-dark">{categoryLabel}</p>
                                                    <p className="mt-1 text-xs text-black/45">Classificação final registrada</p>
                                                </div>
                                            </div>

                                            <div className={`flex min-h-[280px] flex-col rounded-[20px] bg-white px-4 py-6 shadow-sm ${tone.surfaceBg}`}>
                                                <p className="text-center text-4xl font-semibold tracking-[-0.04em] text-io-dark">{formatNumber(item.total)}</p>
                                                <p className="mt-2 text-center text-xs uppercase tracking-[0.12em] text-black/45">Atendimentos no período</p>

                                                <div className="mt-6 rounded-[18px] border border-black/5 bg-white p-3">
                                                    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                                                        <span>Participação</span>
                                                        <span>{formatPercent(item.percentage)}</span>
                                                    </div>
                                                    <div className="mt-3 h-4 overflow-hidden rounded-full bg-black/8">
                                                        <div className={`flex h-full items-center rounded-full px-2 text-[11px] font-semibold text-white ${tone.progressBg}`} style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}>
                                                            {item.percentage > 0 ? formatPercent(item.percentage) : ""}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                                        <span className="text-io-dark">{classificationTitle}</span>
                                                        <span className="font-semibold text-black/60">{formatNumber(item.total)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex-1" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {results.unclassifiedCount > 0 ? (
                                <div className="mt-4 rounded-[20px] border border-black/5 bg-white px-5 py-4 shadow-sm">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl font-semibold tracking-[-0.04em] text-io-dark">{formatNumber(results.unclassifiedCount)}</div>
                                            <div>
                                                <p className="text-base font-medium text-io-dark">atendimento(s) não classificados</p>
                                                <p className="text-sm text-black/55">Visualize os ciclos concluídos sem classificação final.</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setShowUnclassified(true)} className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-io-purple transition hover:bg-[#f6f1ff]">Visualizar</button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </Panel>
                </div>
            ) : null}

            {showUnclassified && results ? (
                <div className="fixed inset-0 z-50 bg-black/35 px-4 py-6">
                    <div className="mx-auto flex h-full max-w-5xl flex-col rounded-[28px] border border-black/10 bg-white shadow-soft">
                        <header className="flex items-center justify-between border-b border-black/10 px-6 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">Não classificados</p><h2 className="mt-1 text-xl font-semibold text-io-dark">Atendimentos concluídos sem classificação</h2></div><button type="button" onClick={() => setShowUnclassified(false)} className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-black/60 transition hover:bg-black/5"><X className="h-4 w-4" strokeWidth={2} /></button></header>
                        <div className="min-h-0 flex-1 overflow-auto p-6">{results.unclassifiedAttendances.length ? <div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-0"><thead><tr className="text-left text-xs uppercase tracking-[0.12em] text-black/45"><th className="border-b border-black/10 px-4 py-3">Canal</th><th className="border-b border-black/10 px-4 py-3">Contato</th><th className="border-b border-black/10 px-4 py-3">Usuário responsável</th><th className="border-b border-black/10 px-4 py-3">Início</th><th className="border-b border-black/10 px-4 py-3">Tempo</th></tr></thead><tbody>{results.unclassifiedAttendances.map((item) => <tr key={item.sessionId} className="text-sm text-io-dark"><td className="border-b border-black/5 px-4 py-4">{item.channel}</td><td className="border-b border-black/5 px-4 py-4 font-semibold">{item.contactName}</td><td className="border-b border-black/5 px-4 py-4">{item.responsibleUserName}</td><td className="border-b border-black/5 px-4 py-4">{formatDateTime(item.startedAt)}</td><td className="border-b border-black/5 px-4 py-4">{formatSeconds(item.durationSeconds)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-black/55">Não existem atendimentos pendentes de classificação para este filtro.</p>}</div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
