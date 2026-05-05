"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileSpreadsheet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

export function FinancialSubNav() {
    const pathname = usePathname();

    const links = [
        { href: "/protected/financeiro", label: "Dashboard", icon: LayoutDashboard },
        { href: "/protected/financeiro/fluxo-caixa", label: "Fluxo de Caixa", icon: ArrowUpCircle },
        { href: "/protected/financeiro/dre", label: "DRE", icon: FileSpreadsheet },
        { href: "/protected/financeiro/contas", label: "Contas", icon: ArrowDownCircle },
    ];

    return (
        <nav className="mb-6 flex items-center gap-2 overflow-x-auto rounded-3xl border border-black/10 bg-white p-2 shadow-sm">
            {links.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                            isActive
                                ? "bg-black text-white"
                                : "text-black/60 hover:bg-black/5 hover:text-io-dark"
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        <span>{link.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
