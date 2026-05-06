"use client";

import { BellRing, LogOut } from "lucide-react";

export function ProtectedNotificationsRail() {
    return (
        <aside className="hidden w-[80px] shrink-0 border-l border-white/10 bg-io-dark xl:flex xl:h-screen xl:flex-col xl:items-center xl:justify-between xl:px-4 xl:py-8">
            <button
                type="button"
                aria-label="Notificações"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-io-purple hover:text-white"
            >
                <BellRing className="h-5 w-5" strokeWidth={2} />
            </button>

            <a
                href="/api/auth/logout"
                aria-label="Sair do sistema"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-red-500/30 hover:bg-red-500 hover:text-white"
            >
                <LogOut className="h-5 w-5" strokeWidth={2} />
            </a>
        </aside>
    );
}
