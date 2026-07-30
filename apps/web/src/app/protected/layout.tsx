import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache, Suspense } from "react";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream } from "@/core/http/upstream";
import { AuthSessionWatcher } from "@/modules/auth/components/AuthSessionWatcher";
import { ImpersonationBanner } from "@/modules/protected/components/ImpersonationBanner";
import { ProtectedSidebar } from "@/modules/protected/components/ProtectedSidebar";
import { ProtectedNotificationsRail } from "@/modules/protected/components/ProtectedNotificationsRail";
import { BillingAccessBlockerPopup } from "@/modules/ioauto/components/BillingAccessBlockerPopup";
import { BillingPlanChangeNoticePopup } from "@/modules/ioauto/components/BillingPlanChangeNoticePopup";
import type { BillingSnapshot } from "@/modules/ioauto/types";

type MeResponse = {
    userId: string;
    companyId: string;
    email: string;
    fullName: string;
    profileImageUrl?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    roles: string[];
    companyName?: string | null;
    impersonation?: boolean;
    actorSuperAdminId?: string | null;
    impersonatedTenantId?: string | null;
};

const getCurrentUser = cache(async function getCurrentUser() {
    try {
        const token = (await cookies()).get(ACCESS_COOKIE)?.value;
        if (!token) return null;

        const apiBase = getServerApiBase();

        const res = await fetchUpstream(`${apiBase}/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        // Avoid forcing a logout during the first protected render.
        // Client-side auth routes already know how to refresh the session
        // and clear cookies only when the browser really lost auth state.
        if (res.status === 401) return null;
        if (!res.ok) return null;

        const data = (await res.json()) as MeResponse;
        return data;
    } catch (error) {
        unstable_rethrow(error);
        console.error("[protected/layout] Unable to load the current user from the backend.", error);
        return null;
    }
});

const getBillingSnapshot = cache(async function getBillingSnapshot() {
    try {
        const token = (await cookies()).get(ACCESS_COOKIE)?.value;
        if (!token) return null;

        const apiBase = getServerApiBase();
        const response = await fetchUpstream(`${apiBase}/ioauto/billing`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!response.ok) return null;
        return (await response.json()) as BillingSnapshot;
    } catch (error) {
        unstable_rethrow(error);
        console.error("[protected/layout] Unable to load billing snapshot for sidebar gating.", error);
        return null;
    }
});

async function ProtectedSidebarData() {
    const [me, billing] = await Promise.all([getCurrentUser(), getBillingSnapshot()]);
    return <ProtectedSidebar user={me} billing={billing} />;
}

async function ProtectedBillingNotice() {
    const billing = await getBillingSnapshot();
    return <BillingPlanChangeNoticePopup initialBilling={billing} />;
}

async function ProtectedImpersonationNotice() {
    const me = await getCurrentUser();
    return me?.impersonation ? <ImpersonationBanner companyName={me.companyName} /> : null;
}

function ProtectedSidebarFallback() {
    return (
        <aside
            className="hidden w-[304px] shrink-0 border-r border-white/10 bg-io-dark md:block md:h-screen"
            aria-hidden="true"
        />
    );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen overflow-x-hidden bg-io-light md:h-screen md:overflow-hidden">
            <AuthSessionWatcher />
            <BillingAccessBlockerPopup />
            <Suspense fallback={null}>
                <ProtectedBillingNotice />
            </Suspense>

            <div className="relative flex min-h-screen min-w-0 flex-col overflow-x-hidden md:h-screen md:min-h-0 md:flex-row md:overflow-hidden">
                <Suspense fallback={<ProtectedSidebarFallback />}>
                    <ProtectedSidebarData />
                </Suspense>
                <main className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden p-4 md:h-screen md:overflow-x-hidden md:overflow-y-auto md:p-6">
                    <div className="grid min-w-0 gap-4">
                        <Suspense fallback={null}>
                            <ProtectedImpersonationNotice />
                        </Suspense>
                        {children}
                    </div>
                </main>
                <ProtectedNotificationsRail />
            </div>
        </div>
    );
}
