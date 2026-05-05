"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, DoorOpen, KeyRound, ShieldBan, Sparkles } from "lucide-react";
import { superAdminSections, superAdminTenantSeed, type SuperAdminTenantRow } from "@/modules/superadmin/data";
import { SuperAdminDashboardSection } from "@/modules/superadmin/components/SuperAdminDashboardSection";

type CompanyResponse = {
    id: string;
    name: string;
    email?: string | null;
    createdAt?: string | null;
    contractEndDate?: string | null;
};

type TenantFilter = "todos" | "ativo" | "atencao" | "cancelado" | "bloqueado";

function formatEntryDate(value?: string | null) {
    if (!value) return "Sem data";
    return value.includes("T") ? value.slice(0, 10) : value;
}

function buildRowsFromCompanies(companies: CompanyResponse[]): SuperAdminTenantRow[] {
    return companies.map((company, index) => {
        const seed = superAdminTenantSeed[index % superAdminTenantSeed.length];
        return {
            id: company.id,
            name: company.name,
            plan: seed.plan,
            status: company.contractEndDate && company.contractEndDate < "2026-04-29" ? "cancelado" : seed.status,
            entryDate: formatEntryDate(company.createdAt ?? seed.entryDate),
            lastAccess: seed.lastAccess,
            mrr: seed.mrr,
            note: seed.note,
        };
    });
}

function getStatusClasses(status: SuperAdminTenantRow["status"]) {
    if (status === "ativo") return "bg-emerald-100 text-emerald-700";
    if (status === "atencao") return "bg-amber-100 text-amber-700";
    if (status === "bloqueado") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
}

function getFilterLabel(filter: TenantFilter) {
    if (filter === "atencao") return "Em atenção";
    return filter;
}

function getStatusLabel(status: SuperAdminTenantRow["status"]) {
    if (status === "atencao") return "Em atenção";
    return status;
}

export function SuperAdminTenantsPage() {
    const [companies, setCompanies] = useState<CompanyResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<TenantFilter>("todos");
    const [query, setQuery] = useState("");
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadCompanies() {
            try {
                const response = await fetch("/api/auth/companies", {
                    cache: "no-store",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Falha ao carregar empresas");
                }

                const data = (await response.json()) as CompanyResponse[];
                setCompanies(Array.isArray(data) ? data : []);
            } catch (error) {
                if ((error as Error).name === "AbortError") return;
                setCompanies([]);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadCompanies();

        return () => controller.abort();
    }, []);

    const rows = useMemo(() => {
        const source = companies.length ? buildRowsFromCompanies(companies) : superAdminTenantSeed;
        return source.filter((row) => {
            const normalizedQuery = query.trim().toLowerCase();
            const matchesFilter = filter === "todos" ? true : row.status === filter;
            const matchesQuery = normalizedQuery.length === 0
                ? true
                : row.name.toLowerCase().includes(normalizedQuery) || row.plan.toLowerCase().includes(normalizedQuery);
            return matchesFilter && matchesQuery;
        });
    }, [companies, filter, query]);

    function announceAction(action: string, tenant: SuperAdminTenantRow) {
        setActionFeedback(`${action} preparado para ${tenant.name}. Para executar de verdade, precisamos ligar esse botão a um endpoint seguro de superadmin.`);
    }

    return (
        <div className="grid gap-6">
            <SuperAdminDashboardSection section={superAdminSections.tenants} />

            <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Operação da carteira</p>
                        <h2 className="mt-2 font-display text-3xl font-bold text-io-dark">Tabela de tenants</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-black/56">
                            Quando a API de empresas responde, esta lista reaproveita os tenants reais do sistema. Os botões de ação já estão posicionados para receber os endpoints de impersonação, bloqueio e reset.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4 text-sm text-black/58 xl:max-w-sm">
                        <div className="flex items-center gap-2 font-semibold text-io-dark">
                            <Sparkles className="h-4 w-4 text-violet-600" />
                            Estado atual
                        </div>
                        <p className="mt-2">
                            {companies.length
                                ? `Mostrando ${companies.length} empresas reais com enriquecimento operacional de demo.`
                                : "Sem dados vivos disponíveis agora; a tela usa uma carteira demonstrativa para validar UX e fluxo."}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                                {(["todos", "ativo", "atencao", "bloqueado", "cancelado"] as TenantFilter[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setFilter(item)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    filter === item
                                        ? "bg-io-dark text-white"
                                        : "border border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-io-dark"
                                }`}
                            >
                                {getFilterLabel(item)}
                            </button>
                        ))}
                    </div>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar por empresa ou plano"
                        className="h-11 rounded-2xl border border-black/10 px-4 text-sm text-io-dark outline-none transition focus:border-black/25 xl:w-[320px]"
                    />
                </div>

                {actionFeedback ? (
                    <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {actionFeedback}
                    </div>
                ) : null}

                <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.18em] text-black/40">
                                <th className="px-3 py-2">Empresa</th>
                                <th className="px-3 py-2">Plano</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Entrada</th>
                                <th className="px-3 py-2">Último acesso</th>
                                <th className="px-3 py-2">MRR</th>
                                <th className="px-3 py-2">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-black/45">
                                        Carregando tenants...
                                    </td>
                                </tr>
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <tr key={row.id} className="rounded-[24px] bg-black/[0.02]">
                                        <td className="rounded-l-[22px] px-3 py-4">
                                            <div className="flex items-start gap-3">
                                                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-io-dark shadow-sm">
                                                    <Building2 className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <p className="text-sm font-semibold text-io-dark">{row.name}</p>
                                                    <p className="mt-1 text-sm text-black/54">{row.note}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-sm font-medium text-io-dark">{row.plan}</td>
                                        <td className="px-3 py-4">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusClasses(row.status)}`}>
                                                {getStatusLabel(row.status)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-black/60">{row.entryDate}</td>
                                        <td className="px-3 py-4 text-sm text-black/60">{row.lastAccess}</td>
                                        <td className="px-3 py-4 text-sm font-bold text-io-dark">{row.mrr}</td>
                                        <td className="rounded-r-[22px] px-3 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => announceAction("Entrar como admin", row)}
                                                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20"
                                                >
                                                    <DoorOpen className="h-3.5 w-3.5" />
                                                    Entrar como admin
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => announceAction("Alterar plano", row)}
                                                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20"
                                                >
                                                    Alterar plano
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => announceAction("Bloquear conta", row)}
                                                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                                >
                                                    <ShieldBan className="h-3.5 w-3.5" />
                                                    Bloquear
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => announceAction("Resetar senha", row)}
                                                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20"
                                                >
                                                    <KeyRound className="h-3.5 w-3.5" />
                                                    Resetar senha
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => announceAction("Ver logs da conta", row)}
                                                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-io-dark transition hover:border-black/20"
                                                >
                                                    Ver logs
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-black/45">
                                        Nenhum tenant encontrado para esse filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
