"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleAlert, Sparkles } from "lucide-react";
import { superAdminExecutiveAlerts, superAdminNavItems, superAdminPillars } from "@/modules/superadmin/data";

function getAlertPalette(severity: "critical" | "attention" | "stable") {
    if (severity === "critical") return "border-red-200 bg-red-50 text-red-900";
    if (severity === "attention") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function SuperAdminOverview() {
    return (
        <div className="grid gap-6">
            <section className="overflow-hidden rounded-[36px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(107,0,227,0.18),_transparent_38%),linear-gradient(135deg,#111827,#1f2937_55%,#4c1d95)] p-7 text-white shadow-[0_24px_60px_rgba(17,24,39,0.24)]">
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/55">IO Auto superadmin</p>
                        <h1 className="mt-3 font-display text-[2.15rem] font-bold leading-tight">Visão geral para operar receita, base, produto e crescimento.</h1>
                        <p className="mt-3 max-w-2xl text-sm text-white/72">
                            Essa central foi desenhada para o time vendedor do sistema enxergar o negócio inteiro e agir rápido:
                            MRR, risco de churn, valor de produto e saúde operacional no mesmo lugar.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link
                                href="/protected/superadmin/financeiro"
                                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-io-dark transition hover:bg-white/90"
                            >
                                Abrir financeiro
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/protected/superadmin/tenants"
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
                            >
                                Operar tenants
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="rounded-[28px] border border-white/12 bg-white/8 p-5">
                            <div className="flex items-center gap-3 text-sm font-semibold text-white">
                                <Sparkles className="h-4 w-4" />
                                Prioridade do dia
                            </div>
                            <p className="mt-3 text-2xl font-bold">MRR em alta, mas pequenas revendas pedem ajuste de pricing.</p>
                            <p className="mt-2 text-sm text-white/68">
                                O cluster até 20 carros concentra a maior diferença entre custo de aquisição, inadimplência e valor percebido.
                            </p>
                        </div>
                        <div className="rounded-[28px] border border-white/12 bg-black/20 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Fila executiva</p>
                            <div className="mt-3 grid gap-3 text-sm text-white/72">
                                <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
                                    <span>11 contas com risco alto de churn</span>
                                    <span className="rounded-full bg-red-500/18 px-3 py-1 text-xs font-semibold text-red-100">Agir hoje</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
                                    <span>19 clientes prontos para upgrade</span>
                                    <span className="rounded-full bg-emerald-500/18 px-3 py-1 text-xs font-semibold text-emerald-100">Receita</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
                                    <span>R$ 32,6 mil em atraso para tratar</span>
                                    <span className="rounded-full bg-amber-500/18 px-3 py-1 text-xs font-semibold text-amber-100">Cobrança</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {superAdminPillars.map((pillar) => (
                    <article key={pillar.label} className="rounded-[30px] border border-black/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-io-dark">{pillar.label}</p>
                            <span className="rounded-full bg-io-dark px-3 py-1 text-xs font-semibold text-white">{pillar.score}/100</span>
                        </div>
                        <p className="mt-4 text-4xl font-bold text-io-dark">{pillar.score}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-black/45">{pillar.change}</p>
                        <p className="mt-4 text-sm leading-6 text-black/58">{pillar.summary}</p>
                    </article>
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Mapa de módulos</p>
                            <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">Central de dashboards</h2>
                        </div>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/55">9 páginas</span>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {superAdminNavItems.slice(1).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="group rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4 transition hover:border-black/18 hover:bg-black/[0.03]"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-base font-semibold text-io-dark">{item.label}</p>
                                    <ArrowRight className="h-4 w-4 text-black/35 transition group-hover:translate-x-0.5 group-hover:text-io-dark" />
                                </div>
                                <p className="mt-2 text-sm text-black/54">{item.summary}</p>
                            </Link>
                        ))}
                    </div>
                </article>

                <article className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-3">
                        <CircleAlert className="h-5 w-5 text-amber-600" />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Watchlist</p>
                            <h2 className="mt-1 font-display text-3xl font-bold text-io-dark">Alertas estratégicos</h2>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3">
                        {superAdminExecutiveAlerts.map((alert) => (
                            <div key={alert.title} className={`rounded-[24px] border px-4 py-4 ${getAlertPalette(alert.severity)}`}>
                                <p className="text-sm font-semibold">{alert.title}</p>
                                <p className="mt-2 text-sm leading-6 opacity-80">{alert.description}</p>
                            </div>
                        ))}
                    </div>
                </article>
            </section>
        </div>
    );
}
