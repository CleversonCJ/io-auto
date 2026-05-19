"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Handshake, PencilLine, Plus, Save, Trophy } from "lucide-react";
import type { PartnerDashboardResponse, PartnerDecimalMetricPoint, PartnerLeadRow, PartnerMetricPoint, PartnerRow, SuperAdminPlanOption } from "@/modules/superadmin/partnerProgramTypes";

type PartnerFormState = {
    partnerId: string | null;
    partnerName: string;
    companyName: string;
    whatsapp: string;
    email: string;
    city: string;
    state: string;
    partnerType: string;
    defaultCommissionPercent: string;
    status: "ACTIVE" | "INACTIVE";
};

type LeadFormState = {
    leadId: string;
    leadStatus: string;
    salesOwner: string;
    notes: string;
    closedPlan: string;
    closedBillingRecurrence: "MONTHLY" | "ANNUAL";
    firstMonthlyFee: string;
    closedAt: string;
    commissionStatus: string;
    commissionDueDate: string;
};

const EMPTY_PARTNER_FORM: PartnerFormState = {
    partnerId: null,
    partnerName: "",
    companyName: "",
    whatsapp: "",
    email: "",
    city: "",
    state: "",
    partnerType: "",
    defaultCommissionPercent: "25",
    status: "ACTIVE",
};

const LEAD_STATUS_OPTIONS = [
    { value: "NEW", label: "Novo" },
    { value: "CONTACTED", label: "Em contato" },
    { value: "QUALIFIED", label: "Qualificado" },
    { value: "CONVERTED", label: "Convertido" },
    { value: "LOST", label: "Perdido" },
];

const COMMISSION_STATUS_OPTIONS = [
    { value: "PENDING", label: "Pendente" },
    { value: "PAID", label: "Paga" },
    { value: "CANCELED", label: "Cancelada" },
];

const BILLING_RECURRENCE_OPTIONS = [
    { value: "MONTHLY", label: "Mensal" },
    { value: "ANNUAL", label: "Anual" },
];

async function fetchJson<T>(url: string, init?: RequestInit, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store", ...init });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message ?? fallbackMessage);
    }
    return payload as T;
}

function toCurrency(cents?: number | null) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);
}

function toDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR");
}

function toDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR");
}

function formatPercent(value?: number | null) {
    return `${(value ?? 0).toFixed(2)}%`;
}

function statusTone(status: string) {
    if (status === "ACTIVE" || status === "CONVERTED" || status === "PAID") return "bg-emerald-100 text-emerald-800";
    if (status === "INACTIVE" || status === "LOST" || status === "CANCELED") return "bg-rose-100 text-rose-800";
    if (status === "QUALIFIED" || status === "PENDING") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
}

function statusLabel(status: string) {
    return ({
        ACTIVE: "Ativo",
        INACTIVE: "Inativo",
        NEW: "Novo",
        CONTACTED: "Em contato",
        QUALIFIED: "Qualificado",
        CONVERTED: "Convertido",
        LOST: "Perdido",
        PENDING: "Pendente",
        PAID: "Paga",
        CANCELED: "Cancelada",
    } as Record<string, string>)[status] ?? status;
}

function percentToBps(raw: string) {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return 2500;
    return Math.round(value * 100);
}

function centsFromCurrencyInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    return digits ? Number(digits) : null;
}

function currencyInputValue(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(digits) / 100);
}

function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function barWidth(value: number, max: number) {
    if (max <= 0) return "0%";
    return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

function chartValue(point: PartnerMetricPoint | PartnerDecimalMetricPoint) {
    return typeof point.value === "number" ? point.value : 0;
}

function normalizeBillingRecurrence(value?: string | null): "MONTHLY" | "ANNUAL" {
    return value === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

function resolvePlanPrice(plan: SuperAdminPlanOption | null | undefined, recurrence: "MONTHLY" | "ANNUAL") {
    if (!plan) return null;

    if (recurrence === "ANNUAL") {
        if (plan.annualPriceCents != null) return plan.annualPriceCents;
        if ((plan.billingRecurrence ?? "").toUpperCase() === "ANNUAL") {
            return plan.priceCents ?? plan.monthlyPriceCents ?? null;
        }
        return plan.priceCents != null && plan.monthlyPriceCents == null && plan.annualPriceCents == null
            ? plan.priceCents
            : plan.monthlyPriceCents ?? plan.priceCents ?? null;
    }

    if (plan.monthlyPriceCents != null) return plan.monthlyPriceCents;
    if ((plan.billingRecurrence ?? "").toUpperCase() === "MONTHLY") {
        return plan.priceCents ?? plan.annualPriceCents ?? null;
    }
    return plan.priceCents != null && plan.monthlyPriceCents == null && plan.annualPriceCents == null
        ? plan.priceCents
        : plan.annualPriceCents ?? plan.priceCents ?? null;
}

function buildLeadForm(lead: PartnerLeadRow): LeadFormState {
    const closedDate = lead.closedAt ? new Date(lead.closedAt).toISOString().slice(0, 10) : "";
    return {
        leadId: lead.leadId,
        leadStatus: lead.leadStatus || "NEW",
        salesOwner: lead.salesOwner === "-" ? "" : lead.salesOwner,
        notes: lead.notes === "-" ? "" : lead.notes,
        closedPlan: lead.closedPlan === "-" ? "" : lead.closedPlan,
        closedBillingRecurrence: normalizeBillingRecurrence(lead.closedBillingRecurrence),
        firstMonthlyFee: lead.firstMonthlyFeeCents ? currencyInputValue(String(lead.firstMonthlyFeeCents)) : "",
        closedAt: closedDate,
        commissionStatus: lead.commissionStatus && lead.commissionStatus !== "-" ? lead.commissionStatus : "PENDING",
        commissionDueDate: lead.commissionDueDate ?? "",
    };
}

function buildPartnerForm(partner: PartnerRow): PartnerFormState {
    return {
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
        companyName: partner.companyName === "-" ? "" : partner.companyName,
        whatsapp: partner.whatsapp === "-" ? "" : formatPhoneInput(partner.whatsapp),
        email: partner.email === "-" ? "" : partner.email,
        city: partner.city === "-" ? "" : partner.city,
        state: partner.state === "-" ? "" : partner.state,
        partnerType: partner.partnerType === "-" ? "" : partner.partnerType,
        defaultCommissionPercent: (partner.defaultCommissionBps / 100).toString().replace(".", ","),
        status: partner.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    };
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
    return (
        <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">{label}</p>
            <p className="mt-3 text-3xl font-bold text-io-dark">{value}</p>
            <p className="mt-2 text-sm text-black/56">{helper}</p>
        </article>
    );
}

function MiniChart({
    title,
    subtitle,
    points,
    valueFormatter,
}: {
    title: string;
    subtitle: string;
    points: Array<PartnerMetricPoint | PartnerDecimalMetricPoint>;
    valueFormatter: (value: number) => string;
}) {
    const safePoints = points.slice(0, 6);
    const max = Math.max(...safePoints.map((point) => chartValue(point)), 0);

    return (
        <article className="rounded-[30px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">{subtitle}</p>
            <h3 className="mt-2 text-xl font-bold text-io-dark">{title}</h3>
            <div className="mt-5 grid gap-3">
                {safePoints.map((point) => (
                    <div key={point.label} className="grid gap-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-black/62">{point.label}</span>
                            <span className="font-semibold text-io-dark">{valueFormatter(chartValue(point))}</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/6">
                            <div className="h-2 rounded-full bg-gradient-to-r from-io-purple-2 to-[#0f766e]" style={{ width: barWidth(chartValue(point), max) }} />
                        </div>
                    </div>
                ))}
            </div>
        </article>
    );
}

export function SuperAdminPartnersPage() {
    const [dashboard, setDashboard] = useState<PartnerDashboardResponse | null>(null);
    const [planOptions, setPlanOptions] = useState<SuperAdminPlanOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingPartner, setSavingPartner] = useState(false);
    const [savingLead, setSavingLead] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [origin, setOrigin] = useState("");
    const [partnerForm, setPartnerForm] = useState<PartnerFormState>(EMPTY_PARTNER_FORM);
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const [leadModal, setLeadModal] = useState<LeadFormState | null>(null);

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    async function loadDashboard() {
        setLoading(true);
        setError(null);
        try {
            const [dashboardPayload, plansPayload] = await Promise.all([
                fetchJson<PartnerDashboardResponse>("/api/superadmin/partners/dashboard", undefined, "Falha ao carregar o programa de parceiros."),
                fetchJson<SuperAdminPlanOption[]>("/api/superadmin/plans/options", undefined, "Falha ao carregar os planos do sistema."),
            ]);
            setDashboard(dashboardPayload);
            setPlanOptions(Array.isArray(plansPayload) ? plansPayload : []);
        } catch (requestError) {
            setDashboard(null);
            setPlanOptions([]);
            setError(requestError instanceof Error ? requestError.message : "Falha ao carregar o programa de parceiros.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadDashboard();
    }, []);

    const ranking = useMemo(() => {
        return [...(dashboard?.partners ?? [])].sort((left, right) => right.revenueGeneratedCents - left.revenueGeneratedCents);
    }, [dashboard]);

    const selectablePlans = useMemo(() => {
        return [...planOptions].sort((left, right) => left.planName.localeCompare(right.planName, "pt-BR"));
    }, [planOptions]);

    function updateLeadModal(recipe: (current: LeadFormState) => LeadFormState) {
        setLeadModal((current) => {
            if (!current) return current;
            const next = recipe(current);
            const selectedPlan = planOptions.find((item) => item.planName === next.closedPlan);
            const autoPrice = resolvePlanPrice(selectedPlan, next.closedBillingRecurrence);
            const hasSaleSignals = Boolean(next.closedPlan || next.firstMonthlyFee || next.closedAt);

            return {
                ...next,
                leadStatus: hasSaleSignals ? "CONVERTED" : next.leadStatus,
                firstMonthlyFee: next.closedPlan && autoPrice != null
                    ? currencyInputValue(String(autoPrice))
                    : next.firstMonthlyFee,
            };
        });
    }

    function openNewPartnerModal() {
        setPartnerForm(EMPTY_PARTNER_FORM);
        setPartnerModalOpen(true);
    }

    function openEditPartnerModal(partner: PartnerRow) {
        setPartnerForm(buildPartnerForm(partner));
        setPartnerModalOpen(true);
    }

    function closePartnerModal() {
        setPartnerModalOpen(false);
        setPartnerForm(EMPTY_PARTNER_FORM);
    }

    async function handlePartnerSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSavingPartner(true);
        setError(null);
        setFeedback(null);

        try {
            const payload = {
                partnerName: partnerForm.partnerName,
                companyName: partnerForm.companyName || null,
                whatsapp: partnerForm.whatsapp || null,
                email: partnerForm.email || null,
                city: partnerForm.city || null,
                state: partnerForm.state || null,
                partnerType: partnerForm.partnerType || null,
                defaultCommissionBps: percentToBps(partnerForm.defaultCommissionPercent),
                status: partnerForm.status,
            };

            const url = partnerForm.partnerId ? `/api/superadmin/partners/${partnerForm.partnerId}` : "/api/superadmin/partners";
            await fetchJson(url, {
                method: partnerForm.partnerId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }, "Falha ao salvar o parceiro.");

            setFeedback(partnerForm.partnerId ? "Parceiro atualizado com sucesso." : "Parceiro criado com sucesso.");
            closePartnerModal();
            await loadDashboard();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao salvar o parceiro.");
        } finally {
            setSavingPartner(false);
        }
    }

    async function handleLeadSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!leadModal) return;

        setSavingLead(true);
        setError(null);
        setFeedback(null);

        try {
            await fetchJson(`/api/superadmin/partners/leads/${leadModal.leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadStatus: leadModal.leadStatus,
                    salesOwner: leadModal.salesOwner || null,
                    notes: leadModal.notes || null,
                    closedPlan: leadModal.closedPlan || null,
                    closedBillingRecurrence: leadModal.closedBillingRecurrence || null,
                    firstMonthlyFeeCents: centsFromCurrencyInput(leadModal.firstMonthlyFee),
                    closedAt: leadModal.closedAt ? new Date(`${leadModal.closedAt}T12:00:00`).toISOString() : null,
                    commissionStatus: leadModal.commissionStatus || null,
                    commissionDueDate: leadModal.commissionDueDate || null,
                    commissionPaidAt: leadModal.commissionStatus === "PAID" ? new Date().toISOString() : null,
                }),
            }, "Falha ao atualizar o lead.");

            setFeedback("Lead atualizado com sucesso.");
            setLeadModal(null);
            await loadDashboard();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar o lead.");
        } finally {
            setSavingLead(false);
        }
    }

    async function copyPartnerLink(partner: PartnerRow) {
        const link = `${origin || window.location.origin}/parceiro?ref=${partner.referenceCode}`;
        try {
            await navigator.clipboard.writeText(link);
            setFeedback(`Link do parceiro ${partner.partnerName} copiado.`);
        } catch {
            setError("Nao foi possivel copiar o link do parceiro.");
        }
    }

    if (loading) {
        return (
            <div className="rounded-[30px] border border-black/10 bg-white p-10 text-center text-black/56 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                Carregando modulo de parceiros...
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                {error ?? "Nao foi possivel carregar o modulo de parceiros."}
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {error ? <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {feedback ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Parceiros ativos" value={String(dashboard.summary.activePartners)} helper="Parceiros aptos a gerar links e leads." />
                <MetricCard label="Leads gerados" value={String(dashboard.summary.leadsGenerated)} helper="Todos os leads recebidos via programa." />
                <MetricCard label="Leads convertidos" value={String(dashboard.summary.leadsConverted)} helper={`Conversao geral de ${formatPercent(dashboard.summary.conversionRate)}.`} />
                <MetricCard label="Receita por parceiros" value={toCurrency(dashboard.summary.revenueGeneratedCents)} helper="Primeira mensalidade somada das vendas fechadas." />
                <MetricCard label="Comissao total" value={toCurrency(dashboard.summary.commissionTotalCents)} helper="Comissoes geradas e validas." />
                <MetricCard label="Comissao paga" value={toCurrency(dashboard.summary.commissionPaidCents)} helper="Comissoes liquidadas para os parceiros." />
                <MetricCard label="Comissao pendente" value={toCurrency(dashboard.summary.commissionPendingCents)} helper="Valor ainda em aberto para pagamento." />
                <MetricCard label="Taxa de conversao" value={formatPercent(dashboard.summary.conversionRate)} helper="Proporcao entre leads recebidos e vendas fechadas." />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
                <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Cadastro do parceiro</p>
                            <h2 className="mt-2 text-2xl font-bold text-io-dark">Gerencie novas indicacoes</h2>
                            <p className="mt-2 text-sm text-black/56">Cadastre parceiros em um popup dedicado e gere links exclusivos para acompanhar leads, vendas e comissoes.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openNewPartnerModal}
                            className="inline-flex items-center gap-2 rounded-full bg-io-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
                        >
                            <Plus className="h-4 w-4" />
                            Novo parceiro
                        </button>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="rounded-[28px] border border-black/8 bg-black/[0.02] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">Fluxo</p>
                            <p className="mt-2 text-sm text-black/60">Crie o parceiro, compartilhe o link e acompanhe cada indicacao ate a comissao.</p>
                        </div>
                        <div className="rounded-[28px] border border-black/8 bg-black/[0.02] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">Link exclusivo</p>
                            <p className="mt-2 text-sm text-black/60">O sistema gera automaticamente a URL publica no primeiro cadastro do parceiro.</p>
                        </div>
                        <div className="rounded-[28px] border border-black/8 bg-black/[0.02] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">Operacao</p>
                            <p className="mt-2 text-sm text-black/60">Use o mesmo popup para criar novos parceiros ou editar um cadastro ja existente.</p>
                        </div>
                    </div>
                </article>

                <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Ranking de parceiros</p>
                            <h2 className="mt-2 text-2xl font-bold text-io-dark">Quem realmente traz resultado</h2>
                        </div>
                        <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            <Trophy className="mr-1 inline h-3.5 w-3.5" />
                            Top performance
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3">
                        {ranking.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-black/12 px-4 py-6 text-sm text-black/50">
                                Nenhum parceiro cadastrado ainda.
                            </div>
                        ) : ranking.slice(0, 5).map((partner, index) => (
                            <div key={partner.partnerId} className="flex items-center justify-between gap-4 rounded-[24px] border border-black/8 bg-black/[0.02] px-4 py-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-io-dark">{index + 1}. {partner.partnerName}</p>
                                    <p className="mt-1 truncate text-sm text-black/54">{partner.leadsSent} leads, {partner.salesClosed} vendas e {formatPercent(partner.conversionRate)} de conversao.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-io-dark">{toCurrency(partner.revenueGeneratedCents)}</p>
                                    <p className="mt-1 text-xs text-black/45">Comissao {toCurrency(partner.commissionGeneratedCents)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
                <MiniChart title="Leads por parceiro" subtitle="Volume de origem" points={dashboard.charts.leadsByPartner} valueFormatter={(value) => String(value)} />
                <MiniChart title="Conversoes por parceiro" subtitle="Fechamentos" points={dashboard.charts.conversionsByPartner} valueFormatter={(value) => String(value)} />
                <MiniChart title="Comissao por mes" subtitle="Evolucao financeira" points={dashboard.charts.commissionByMonth} valueFormatter={(value) => toCurrency(value)} />
                <MiniChart title="Receita gerada" subtitle="Primeira mensalidade" points={dashboard.charts.revenueByPartner} valueFormatter={(value) => toCurrency(value)} />
                <MiniChart title="Taxa de conversao" subtitle="Efetividade por parceiro" points={dashboard.charts.conversionRateByPartner} valueFormatter={(value) => formatPercent(value)} />
                <MiniChart title="Evolucao de leads" subtitle="Entradas ao longo do tempo" points={dashboard.charts.leadsOverTime} valueFormatter={(value) => String(value)} />
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Tabela principal</p>
                        <h2 className="mt-2 text-2xl font-bold text-io-dark">Parceiros cadastrados</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-sm text-black/56">
                        <Handshake className="h-4 w-4" />
                        {dashboard.partners.length} parceiros no programa
                    </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="text-black/44">
                            <tr className="border-b border-black/8">
                                <th className="px-3 py-3 font-semibold">Parceiro</th>
                                <th className="px-3 py-3 font-semibold">Link</th>
                                <th className="px-3 py-3 font-semibold">Leads</th>
                                <th className="px-3 py-3 font-semibold">Vendas</th>
                                <th className="px-3 py-3 font-semibold">Conversao</th>
                                <th className="px-3 py-3 font-semibold">Receita</th>
                                <th className="px-3 py-3 font-semibold">Comissao</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold text-right">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.partners.map((partner) => (
                                <tr key={partner.partnerId} className="border-b border-black/6 align-top last:border-b-0">
                                    <td className="px-3 py-4">
                                        <p className="font-semibold text-io-dark">{partner.partnerName}</p>
                                        <p className="mt-1 text-black/54">{partner.companyName}</p>
                                    </td>
                                    <td className="px-3 py-4 text-black/60">
                                        <p>{partner.referenceCode}</p>
                                        <p className="mt-1 text-xs text-black/42">{(origin || "https://ioauto.com.br")}/parceiro?ref={partner.referenceCode}</p>
                                    </td>
                                    <td className="px-3 py-4 text-black/60">{partner.leadsSent}</td>
                                    <td className="px-3 py-4 text-black/60">{partner.salesClosed}</td>
                                    <td className="px-3 py-4 text-black/60">{formatPercent(partner.conversionRate)}</td>
                                    <td className="px-3 py-4 text-black/60">{toCurrency(partner.revenueGeneratedCents)}</td>
                                    <td className="px-3 py-4 text-black/60">{toCurrency(partner.commissionGeneratedCents)}</td>
                                    <td className="px-3 py-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(partner.status)}`}>
                                            {statusLabel(partner.status)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void copyPartnerLink(partner)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/58 transition hover:border-black/20 hover:bg-black/[0.03]"
                                                title="Copiar link"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEditPartnerModal(partner)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/58 transition hover:border-black/20 hover:bg-black/[0.03]"
                                                title="Editar parceiro"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </button>
                                            <Link
                                                href={`/protected/superadmin/parceiros/${partner.partnerId}`}
                                                className="inline-flex items-center rounded-full bg-io-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                                            >
                                                Ver detalhes
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Parceiros &gt; Leads recebidos</p>
                    <h2 className="mt-2 text-2xl font-bold text-io-dark">Leads recebidos</h2>
                </div>

                <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="text-black/44">
                            <tr className="border-b border-black/8">
                                <th className="px-3 py-3 font-semibold">Data</th>
                                <th className="px-3 py-3 font-semibold">Lojista</th>
                                <th className="px-3 py-3 font-semibold">Loja</th>
                                <th className="px-3 py-3 font-semibold">WhatsApp</th>
                                <th className="px-3 py-3 font-semibold">Cidade</th>
                                <th className="px-3 py-3 font-semibold">Estoque</th>
                                <th className="px-3 py-3 font-semibold">Parceiro</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold">Comercial</th>
                                <th className="px-3 py-3 font-semibold">Observacoes</th>
                                <th className="px-3 py-3 font-semibold text-right">Acao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.leads.map((lead) => (
                                <tr key={lead.leadId} className="border-b border-black/6 align-top last:border-b-0">
                                    <td className="px-3 py-4 text-black/56">{toDateTime(lead.createdAt)}</td>
                                    <td className="px-3 py-4 font-medium text-io-dark">{lead.shopkeeperName}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.storeName}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.whatsapp}</td>
                                    <td className="px-3 py-4 text-black/60">{`${lead.city === "-" ? "" : lead.city}${lead.state && lead.state !== "-" ? `/${lead.state}` : ""}` || "-"}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.approximateStock ?? "-"}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.partnerName}</td>
                                    <td className="px-3 py-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(lead.leadStatus)}`}>
                                            {statusLabel(lead.leadStatus)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-black/60">{lead.salesOwner}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.notes}</td>
                                    <td className="px-3 py-4">
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setLeadModal(buildLeadForm(lead))}
                                                className="inline-flex items-center rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]"
                                            >
                                                Atualizar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {partnerModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
                    <div className="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Cadastro do parceiro</p>
                                <h3 className="mt-2 text-2xl font-bold text-io-dark">{partnerForm.partnerId ? "Editar parceiro" : "Novo parceiro"}</h3>
                                <p className="mt-2 text-sm text-black/56">Preencha os dados principais para gerar o link exclusivo e ativar o acompanhamento das indicacoes.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closePartnerModal}
                                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:bg-black/[0.03]"
                            >
                                Fechar
                            </button>
                        </div>

                        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handlePartnerSubmit}>
                            <label className="grid gap-2 text-sm text-black/62">
                                Nome do parceiro
                                <input
                                    value={partnerForm.partnerName}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, partnerName: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Ex.: Igor Barbosa"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Empresa
                                <input
                                    value={partnerForm.companyName}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, companyName: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Ex.: IB Partners"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                WhatsApp
                                <input
                                    value={partnerForm.whatsapp}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, whatsapp: formatPhoneInput(event.target.value) }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="(11) 99999-9999"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                E-mail
                                <input
                                    value={partnerForm.email}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, email: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="contato@parceiro.com"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Cidade
                                <input
                                    value={partnerForm.city}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, city: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Sao Paulo"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Estado
                                <input
                                    maxLength={2}
                                    value={partnerForm.state}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 uppercase outline-none transition focus:border-io-purple-2"
                                    placeholder="SP"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Tipo de parceiro
                                <input
                                    value={partnerForm.partnerType}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, partnerType: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Consultor, agencia, influenciador..."
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Comissao padrao (%)
                                <input
                                    value={partnerForm.defaultCommissionPercent}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, defaultCommissionPercent: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="25"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Status
                                <select
                                    value={partnerForm.status}
                                    onChange={(event) => setPartnerForm((current) => ({ ...current, status: event.target.value as "ACTIVE" | "INACTIVE" }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                >
                                    <option value="ACTIVE">Ativo</option>
                                    <option value="INACTIVE">Inativo</option>
                                </select>
                            </label>
                            <div className="flex items-end md:justify-end">
                                <p className="text-sm text-black/50">Links sao gerados automaticamente no primeiro cadastro.</p>
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={savingPartner}
                                    className="inline-flex items-center gap-2 rounded-full bg-io-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Save className="h-4 w-4" />
                                    {savingPartner ? "Salvando..." : partnerForm.partnerId ? "Salvar parceiro" : "Criar parceiro"}
                                </button>
                                <button
                                    type="button"
                                    onClick={closePartnerModal}
                                    className="inline-flex items-center rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-io-dark transition hover:border-black/20 hover:bg-black/[0.03]"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {leadModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
                    <div className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Atualizacao de lead</p>
                                <h3 className="mt-2 text-2xl font-bold text-io-dark">Editar conversao e comissao</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLeadModal(null)}
                                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:bg-black/[0.03]"
                            >
                                Fechar
                            </button>
                        </div>

                        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleLeadSubmit}>
                            <label className="grid gap-2 text-sm text-black/62">
                                Status do lead
                                <select
                                    value={leadModal.leadStatus}
                                    onChange={(event) => setLeadModal((current) => current ? { ...current, leadStatus: event.target.value } : current)}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                >
                                    {LEAD_STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Responsavel comercial
                                <input
                                    value={leadModal.salesOwner}
                                    onChange={(event) => setLeadModal((current) => current ? { ...current, salesOwner: event.target.value } : current)}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Ex.: Rafael"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Plano fechado
                                <select
                                    value={leadModal.closedPlan}
                                    onChange={(event) => updateLeadModal((current) => ({ ...current, closedPlan: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                >
                                    <option value="">Selecione um plano</option>
                                    {selectablePlans.map((plan) => (
                                        <option key={plan.planId} value={plan.planName}>{plan.planName}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Recorrencia do pagamento
                                <select
                                    value={leadModal.closedBillingRecurrence}
                                    onChange={(event) => updateLeadModal((current) => ({ ...current, closedBillingRecurrence: event.target.value as "MONTHLY" | "ANNUAL" }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                >
                                    {BILLING_RECURRENCE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Primeira mensalidade
                                <input
                                    value={leadModal.firstMonthlyFee}
                                    onChange={(event) => updateLeadModal((current) => ({ ...current, firstMonthlyFee: currencyInputValue(event.target.value) }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="R$ 397,00"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Data de fechamento
                                <input
                                    type="date"
                                    value={leadModal.closedAt}
                                    onChange={(event) => updateLeadModal((current) => ({ ...current, closedAt: event.target.value }))}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Status da comissao
                                <select
                                    value={leadModal.commissionStatus}
                                    onChange={(event) => setLeadModal((current) => current ? { ...current, commissionStatus: event.target.value } : current)}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                >
                                    {COMMISSION_STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-2 text-sm text-black/62 md:col-span-2">
                                Observacoes
                                <textarea
                                    value={leadModal.notes}
                                    onChange={(event) => setLeadModal((current) => current ? { ...current, notes: event.target.value } : current)}
                                    rows={4}
                                    className="rounded-[24px] border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                    placeholder="Resumo do andamento comercial..."
                                />
                            </label>
                            <label className="grid gap-2 text-sm text-black/62">
                                Data prevista de pagamento
                                <input
                                    type="date"
                                    value={leadModal.commissionDueDate}
                                    onChange={(event) => setLeadModal((current) => current ? { ...current, commissionDueDate: event.target.value } : current)}
                                    className="rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-io-purple-2"
                                />
                            </label>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={savingLead}
                                    className="inline-flex items-center gap-2 rounded-full bg-io-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Save className="h-4 w-4" />
                                    {savingLead ? "Salvando..." : "Salvar lead"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
