"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { SubscriptionCenter } from "@/modules/ioauto/components/SubscriptionCenter";
import type { BillingSnapshot } from "@/modules/ioauto/types";

type CurrentUser = {
    userId: string;
    companyId: string;
    companyName?: string | null;
    email: string;
    fullName: string;
    profileImageUrl?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    createdAt?: string | null;
    roles: string[];
};

function getInitials(fullName?: string | null, email?: string | null) {
    const source = (fullName?.trim() || email?.trim() || "IOAuto").split(/\s+/).filter(Boolean);
    const first = source[0]?.[0] ?? "I";
    const second = source[1]?.[0] ?? "O";
    return `${first}${second}`.toUpperCase();
}

function formatPermissionPreset(value?: string | null) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "admin") return "Administrador";
    if (normalized === "default") return "Padrao";
    if (normalized === "custom") return "Personalizado";
    return "Nao informado";
}

function formatEntryDate(value?: string | null) {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(parsed);
}

export function ProfileCenter() {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [billing, setBilling] = useState<BillingSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        Promise.all([
            fetch("/api/auth/me", { cache: "no-store" }),
            fetch("/api/ioauto/billing", { cache: "no-store" }),
        ])
            .then(async ([meResponse, billingResponse]) => {
                if (!meResponse.ok) {
                    const payload = await meResponse.json().catch(() => ({ message: "Falha ao carregar o perfil." }));
                    throw new Error(payload.message ?? "Falha ao carregar o perfil.");
                }

                const mePayload = (await meResponse.json()) as CurrentUser;
                const billingPayload = billingResponse.ok
                    ? (await billingResponse.json()) as BillingSnapshot
                    : null;

                return { mePayload, billingPayload };
            })
            .then(({ mePayload, billingPayload }) => {
                if (!active) return;
                setUser(mePayload);
                setBilling(billingPayload);
                setError(null);
            })
            .catch((cause: Error) => {
                if (!active) return;
                setError(cause.message);
            });

        return () => {
            active = false;
        };
    }, []);

    const permissionList = useMemo(() => {
        return (user?.modulePermissions ?? []).filter((item) => item.trim().length > 0);
    }, [user?.modulePermissions]);

    const enabledModules = useMemo(() => {
        return (billing?.enabledModules ?? []).filter((item) => item.trim().length > 0);
    }, [billing?.enabledModules]);

    if (error) {
        return <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">{error}</div>;
    }

    return (
        <div className="grid gap-6">
            <section className="rounded-[36px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-4">
                        {user?.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.profileImageUrl} alt={user.fullName ?? "Usuario"} className="h-20 w-20 rounded-[28px] object-cover" />
                        ) : (
                            <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-io-dark text-xl font-bold text-white">
                                {getInitials(user?.fullName, user?.email)}
                            </div>
                        )}

                        <div>
                            <h1 className="mt-2 font-display text-4xl font-bold text-io-dark">
                                {user?.fullName ?? "Carregando perfil"}
                            </h1>
                            <p className="mt-2 text-sm text-black/55">{user?.email ?? "Sem e-mail disponivel"}</p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-1">
                        <ProfileStat
                            icon={<ShieldCheck className="h-4 w-4" />}
                            label="Perfil de acesso"
                            value={formatPermissionPreset(user?.permissionPreset)}
                        />
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr] xl:items-stretch">
                <article className="h-full rounded-[34px] border border-black/10 bg-white p-6 shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-io-purple text-white">
                            <UserCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-display text-3xl font-bold text-io-dark">Informacoes da conta</h2>
                            <p className="mt-1 text-sm text-black/55">Resumo do usuario autenticado e dos acessos disponiveis na operacao.</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <InfoCard label="Nome" value={user?.fullName ?? "-"} />
                        <InfoCard label="E-mail" value={user?.email ?? "-"} />
                        <InfoCard label="Data de entrada" value={formatEntryDate(user?.createdAt)} />
                        <InfoCard label="Empresa vinculada" value={user?.companyName ?? "-"} />
                    </div>
                </article>

                <aside className="flex h-full min-h-[320px] flex-col rounded-[34px] border border-black/10 bg-io-dark p-6 text-white shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
                    <p className="text-xs uppercase tracking-[0.28em] text-white/45">Permissoes</p>
                    <h2 className="mt-3 font-display text-3xl font-bold">Acesso atual</h2>
                    <p className="mt-4 text-sm leading-7 text-white/70">
                        Estas informacoes refletem o perfil carregado na sessao atual e ajudam a conferir o escopo de operacao da sua conta.
                    </p>

                    <div className="mt-6 grid flex-1 content-start gap-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-2 text-sm text-white/80">
                            <Mail className="h-4 w-4" />
                            <span>{user?.email ?? "Sem e-mail disponivel"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(user?.roles ?? []).length ? (
                                user!.roles.map((role) => (
                                    <span key={role} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                                        <BadgeCheck className="h-3.5 w-3.5" />
                                        {role}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-white/60">Nenhuma role vinculada.</span>
                            )}
                        </div>
                        <div className="grid gap-2 pt-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Modulos habilitados na conta</p>
                            {enabledModules.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {enabledModules.map((moduleName) => (
                                        <span key={moduleName} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">
                                            {moduleName}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-sm text-white/60">Nao foi possivel carregar os modulos do plano.</span>
                            )}
                        </div>
                        {permissionList.length ? (
                            <div className="grid gap-2 pt-2">
                                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Permissoes customizadas do usuario</p>
                                <div className="flex flex-wrap gap-2">
                                    {permissionList.map((permission) => (
                                        <span key={permission} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/75">
                                            {permission}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </aside>
            </section>

            <SubscriptionCenter
                title="Assinatura e cobranca"
                description="Todos os dados financeiros e de plano do tenant ficam concentrados no perfil para facilitar a gestao da conta."
                currentUserRoles={user?.roles}
                onBillingChange={setBilling}
            />
        </div>
    );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-black/40">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-3 break-all text-sm font-semibold text-io-dark">{value}</p>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-black/40">{label}</p>
            <p className="mt-3 break-all text-sm font-semibold text-io-dark">{value}</p>
        </div>
    );
}
