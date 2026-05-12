"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Building2,
    Cable,
    CarFront,
    ChartColumnBig,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    HandCoins,
    LayoutDashboard,
    Lightbulb,
    Link2,
    MapPinned,
    MessageSquareText,
    MonitorCog,
    PackageSearch,
    Rocket,
    Settings2,
    Users2,
    Workflow,
} from "lucide-react";
import { superAdminNavItems } from "@/modules/superadmin/data";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "ioauto.sidebar.collapsed";

type CurrentUser = {
    fullName?: string | null;
    email?: string | null;
    profileImageUrl?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    roles?: string[] | null;
};

type NavItem = {
    label: string;
    href: string;
    icon:
        | "dashboard"
        | "conversas"
        | "crm"
        | "estoque"
        | "financeiro"
        | "links"
        | "publicacoes"
        | "integracoes"
        | "equipe"
        | "superadmin"
        | "clientes"
        | "produto"
        | "marketplaces"
        | "crescimento"
        | "cobranca"
        | "operacional"
        | "insights"
        | "planos"
        | "tenants";
};

function getInitials(fullName?: string | null, email?: string | null) {
    const source = (fullName?.trim() || email?.trim() || "IOAuto").split(/\s+/).filter(Boolean);
    const first = source[0]?.[0] ?? "I";
    const second = source[1]?.[0] ?? "O";
    return `${first}${second}`.toUpperCase();
}

function isActive(pathname: string | null, href: string) {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
}

function hasAdminRole(roles?: string[] | null) {
    return (roles ?? []).some((role) => {
        const normalized = role.toUpperCase();
        return normalized === "ADMIN" || normalized === "SUPERADMIN";
    });
}

function hasSuperAdminRole(roles?: string[] | null) {
    return (roles ?? []).some((role) => role.toUpperCase() === "SUPERADMIN");
}

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
    if (icon === "dashboard") return <LayoutDashboard className="h-5 w-5" strokeWidth={2} />;
    if (icon === "conversas") return <MessageSquareText className="h-5 w-5" strokeWidth={2} />;
    if (icon === "crm") return <Users2 className="h-5 w-5" strokeWidth={2} />;
    if (icon === "estoque") return <CarFront className="h-5 w-5" strokeWidth={2} />;
    if (icon === "financeiro") return <HandCoins className="h-5 w-5" strokeWidth={2} />;
    if (icon === "links") return <Link2 className="h-5 w-5" strokeWidth={2} />;
    if (icon === "publicacoes") return <Workflow className="h-5 w-5" strokeWidth={2} />;
    if (icon === "integracoes") return <Cable className="h-5 w-5" strokeWidth={2} />;
    if (icon === "superadmin") return <Building2 className="h-5 w-5" strokeWidth={2} />;
    if (icon === "clientes") return <Users2 className="h-5 w-5" strokeWidth={2} />;
    if (icon === "produto") return <PackageSearch className="h-5 w-5" strokeWidth={2} />;
    if (icon === "marketplaces") return <ChartColumnBig className="h-5 w-5" strokeWidth={2} />;
    if (icon === "crescimento") return <Rocket className="h-5 w-5" strokeWidth={2} />;
    if (icon === "cobranca") return <CreditCard className="h-5 w-5" strokeWidth={2} />;
    if (icon === "operacional") return <MonitorCog className="h-5 w-5" strokeWidth={2} />;
    if (icon === "insights") return <Lightbulb className="h-5 w-5" strokeWidth={2} />;
    if (icon === "planos") return <Settings2 className="h-5 w-5" strokeWidth={2} />;
    if (icon === "tenants") return <MapPinned className="h-5 w-5" strokeWidth={2} />;
    return <Users2 className="h-5 w-5" strokeWidth={2} />;
}

function getDefaultSidebarItems(): NavItem[] {
    return [
        { label: "Dashboard", href: "/protected/dashboard", icon: "dashboard" },
        { label: "Leads", href: "/protected/leads", icon: "conversas" },
        { label: "CRM", href: "/protected/crm", icon: "crm" },
        { label: "Estoque", href: "/protected/estoque", icon: "estoque" },
        { label: "Financeiro", href: "/protected/financeiro", icon: "financeiro" },
        { label: "Links", href: "/protected/links-publicos", icon: "links" },
        { label: "Publicações", href: "/protected/publicacoes", icon: "publicacoes" },
        { label: "Integrações", href: "/protected/integracoes", icon: "integracoes" },
    ];
}

function getSuperAdminSidebarItems(): NavItem[] {
    return superAdminNavItems.map((item) => {
        if (item.href.endsWith("/financeiro")) return { label: item.label, href: item.href, icon: "financeiro" };
        if (item.href.endsWith("/clientes")) return { label: item.label, href: item.href, icon: "clientes" };
        if (item.href.endsWith("/produto")) return { label: item.label, href: item.href, icon: "produto" };
        if (item.href.endsWith("/marketplaces")) return { label: item.label, href: item.href, icon: "marketplaces" };
        if (item.href.endsWith("/crescimento")) return { label: item.label, href: item.href, icon: "crescimento" };
        if (item.href.endsWith("/cobranca")) return { label: item.label, href: item.href, icon: "cobranca" };
        if (item.href.endsWith("/operacional")) return { label: item.label, href: item.href, icon: "operacional" };
        if (item.href.endsWith("/insights")) return { label: item.label, href: item.href, icon: "insights" };
        if (item.href.endsWith("/planos")) return { label: item.label, href: item.href, icon: "planos" };
        return { label: item.label, href: item.href, icon: "tenants" };
    });
}

export function ProtectedSidebar({ user }: { user: CurrentUser | null }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const isSuperAdmin = hasSuperAdminRole(user?.roles);

    useEffect(() => {
        const storedValue = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
        setCollapsed(storedValue === "true");
    }, []);

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    }, [collapsed]);

    const items: NavItem[] = isSuperAdmin ? getSuperAdminSidebarItems() : getDefaultSidebarItems();

    if (!isSuperAdmin && hasAdminRole(user?.roles)) {
        items.push({ label: "Equipe", href: "/protected/configuracoes", icon: "equipe" });
    }

    return (
        <aside className={`bg-io-dark text-white md:h-screen md:border-r md:border-white/10 ${collapsed ? "md:w-[96px]" : "md:w-[304px]"}`}>
            <div className="flex items-center justify-between px-5 py-5">
                <button
                    type="button"
                    onClick={() => setCollapsed((value) => !value)}
                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 md:inline-flex"
                    aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>

            <div className={`relative mx-4 rounded-[28px] border border-white/10 bg-white/5 text-white shadow-none transition-all ${collapsed ? "grid place-items-center p-2" : "px-4 py-4"}`}>
                {!collapsed && (
                    <Link
                        href="/protected/perfil"
                        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/75 transition hover:border-white/30 hover:bg-white/20 hover:text-white"
                        aria-label="Abrir perfil"
                        title="Perfil"
                    >
                        <Settings2 className="h-4 w-4" strokeWidth={2} />
                    </Link>
                )}

                {user?.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={user.profileImageUrl}
                        alt={user.fullName ?? "Usuário"}
                        className={`rounded-2xl object-cover transition-all ${collapsed ? "h-10 w-10" : "h-12 w-12"}`}
                    />
                ) : (
                    <div className={`grid place-items-center rounded-2xl bg-white font-bold text-io-dark transition-all ${collapsed ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm"}`}>
                        {getInitials(user?.fullName, user?.email)}
                    </div>
                )}

                {!collapsed ? (
                    <div className="mt-3 min-w-0">
                        <p className="truncate text-sm font-semibold">{user?.fullName ?? "Operação IOAuto"}</p>
                        <p className="truncate text-xs text-white/60">{user?.email ?? "sem-email@local"}</p>
                    </div>
                ) : null}
            </div>

            <nav className={`mt-5 grid gap-2 px-3 pb-6 ${collapsed ? "justify-items-center" : ""}`}>
                {items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition ${
                                active
                                    ? "bg-gradient-to-r from-io-purple-2 to-[#5402b6] text-white shadow-md"
                                    : "text-white/65 hover:bg-white/5 hover:text-white"
                            } ${collapsed ? "h-12 w-12 justify-center px-0" : "gap-3"}`}
                            title={item.label}
                        >
                            <NavIcon icon={item.icon} />
                            {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
