"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { PartnerDetailResponse, PartnerMetricPoint } from "@/modules/superadmin/partnerProgramTypes";
import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

async function fetchJson<T>(url: string, fallbackMessage = "Falha ao carregar dados.") {
    const response = await fetch(url, { cache: "no-store" });
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

function MiniChart({ title, points, formatter }: { title: string; points: PartnerMetricPoint[]; formatter: (value: number) => string }) {
    const max = Math.max(...points.map((point) => point.value), 0);
    return (
        <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
            <h3 className="text-lg font-bold text-io-dark">{title}</h3>
            <div className="mt-5 grid gap-3">
                {points.map((point) => (
                    <div key={point.label}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-black/56">{point.label}</span>
                            <span className="font-semibold text-io-dark">{formatter(point.value)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-black/6">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-io-purple-2 to-[#0f766e]"
                                style={{ width: max > 0 ? `${Math.max(8, Math.round((point.value / max) * 100))}%` : "0%" }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </article>
    );
}

export function SuperAdminPartnerDetailPage({ partnerId }: { partnerId: string }) {
    const [data, setData] = useState<PartnerDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);

        fetchJson<PartnerDetailResponse>(`/api/superadmin/partners/${partnerId}`, "Falha ao carregar o parceiro.")
            .then((payload) => {
                if (!active) return;
                setData(payload);
            })
            .catch((requestError) => {
                if (!active) return;
                setError(requestError instanceof Error ? requestError.message : "Falha ao carregar o parceiro.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [partnerId]);

    if (loading) {
        return <SystemPageLoader label="Carregando parceiro" description="Preparando o histórico e os resultados..." />;
    }

    if (!data) {
        return <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error ?? "Não foi possível carregar o parceiro."}</div>;
    }

    return (
        <div className="grid gap-6">
            <Link href="/protected/superadmin/parceiros" className="inline-flex items-center gap-2 text-sm font-semibold text-io-dark">
                <ArrowLeft className="h-4 w-4" />
                Voltar para parceiros
            </Link>

            <section className="rounded-[34px] border border-black/10 bg-white p-7 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex justify-end">
                    <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusTone(data.partner.status)}`}>
                        {statusLabel(data.partner.status)}
                    </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Total de leads</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{data.partner.leadsSent}</p>
                    </div>
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Total de vendas</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{data.partner.salesClosed}</p>
                    </div>
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Taxa de conversão</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{formatPercent(data.partner.conversionRate)}</p>
                    </div>
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Comissão gerada</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{toCurrency(data.partner.commissionGeneratedCents)}</p>
                    </div>
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Comissão paga</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{toCurrency(data.partner.commissionPaidCents)}</p>
                    </div>
                    <div className="rounded-[24px] bg-black/[0.02] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/42">Comissão pendente</p>
                        <p className="mt-2 text-2xl font-bold text-io-dark">{toCurrency(data.partner.commissionPendingCents)}</p>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
                <MiniChart title="Leads por mês" points={data.charts.leadsByMonth} formatter={(value) => String(value)} />
                <MiniChart title="Conversões por mês" points={data.charts.conversionsByMonth} formatter={(value) => String(value)} />
                <MiniChart title="Comissão por mês" points={data.charts.commissionByMonth} formatter={(value) => toCurrency(value)} />
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Histórico de leads</p>
                    <h2 className="mt-2 text-2xl font-bold text-io-dark">Todos os leads indicados</h2>
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
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold">Comercial</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.leads.map((lead) => (
                                <tr key={lead.leadId} className="border-b border-black/6 last:border-b-0">
                                    <td className="px-3 py-4 text-black/56">{toDateTime(lead.createdAt)}</td>
                                    <td className="px-3 py-4 font-medium text-io-dark">{lead.shopkeeperName}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.storeName}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.whatsapp}</td>
                                    <td className="px-3 py-4 text-black/60">{`${lead.city === "-" ? "" : lead.city}${lead.state && lead.state !== "-" ? `/${lead.state}` : ""}` || "-"}</td>
                                    <td className="px-3 py-4 text-black/60">{lead.approximateStock ?? "-"}</td>
                                    <td className="px-3 py-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(lead.leadStatus)}`}>
                                            {statusLabel(lead.leadStatus)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-black/60">{lead.salesOwner}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Histórico de comissões</p>
                    <h2 className="mt-2 text-2xl font-bold text-io-dark">Vendas fechadas e pagamento</h2>
                </div>
                <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="text-black/44">
                            <tr className="border-b border-black/8">
                                <th className="px-3 py-3 font-semibold">Cliente fechado</th>
                                <th className="px-3 py-3 font-semibold">Plano</th>
                                <th className="px-3 py-3 font-semibold">Mensalidade</th>
                                <th className="px-3 py-3 font-semibold">Comissão</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold">Pagamento previsto</th>
                                <th className="px-3 py-3 font-semibold">Fechamento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.commissions.map((commission) => (
                                <tr key={commission.leadId} className="border-b border-black/6 last:border-b-0">
                                    <td className="px-3 py-4 font-medium text-io-dark">{commission.closedClient}</td>
                                    <td className="px-3 py-4 text-black/60">{commission.closedPlan}</td>
                                    <td className="px-3 py-4 text-black/60">{toCurrency(commission.firstMonthlyFeeCents)}</td>
                                    <td className="px-3 py-4 text-black/60">{toCurrency(commission.commissionCents)}</td>
                                    <td className="px-3 py-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(commission.status)}`}>
                                            {statusLabel(commission.status)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-black/60">{toDate(commission.commissionDueDate)}</td>
                                    <td className="px-3 py-4 text-black/60">{toDate(commission.closedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
