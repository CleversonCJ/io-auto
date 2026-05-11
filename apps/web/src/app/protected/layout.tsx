import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream } from "@/core/http/upstream";
import { AuthSessionWatcher } from "@/modules/auth/components/AuthSessionWatcher";
import { ImpersonationBanner } from "@/modules/protected/components/ImpersonationBanner";
import { ProtectedSidebar } from "@/modules/protected/components/ProtectedSidebar";
import { ProtectedNotificationsRail } from "@/modules/protected/components/ProtectedNotificationsRail";

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

async function getCurrentUser() {
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
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const me = await getCurrentUser();

    return (
        <div className="min-h-screen bg-io-light md:h-screen md:overflow-hidden">
            <AuthSessionWatcher />


            <div className="relative flex min-h-screen flex-col md:h-screen md:min-h-0 md:flex-row md:overflow-hidden">
                <ProtectedSidebar user={me} />
                <main className="min-h-0 min-w-0 flex-1 p-4 md:h-screen md:overflow-y-auto md:p-6">
                    <div className="grid gap-4">
                        {me?.impersonation ? <ImpersonationBanner companyName={me.companyName} /> : null}
                        {children}
                    </div>
                </main>
                <ProtectedNotificationsRail />
            </div>
        </div>
    );
}
