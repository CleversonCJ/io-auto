"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { superAdminNavItems } from "@/modules/superadmin/data";

function isActive(pathname: string | null, href: string) {
    if (!pathname) return false;
    return pathname === href;
}

export function SuperAdminSectionNav() {
    const pathname = usePathname();

    return (
        <div className="rounded-[30px] border border-black/10 bg-white/90 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.06)] backdrop-blur">
            <div className="flex flex-wrap gap-2">
                {superAdminNavItems.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`min-w-[150px] flex-1 rounded-[22px] border px-4 py-3 transition ${
                                active
                                    ? "border-transparent bg-io-dark text-white shadow-[0_14px_30px_rgba(33,33,33,0.22)]"
                                    : "border-black/10 bg-white text-io-dark hover:border-black/20 hover:bg-black/[0.02]"
                            }`}
                        >
                            <p className="text-sm font-semibold">{item.label}</p>
                            <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-black/50"}`}>{item.summary}</p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
