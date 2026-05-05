import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream } from "@/core/http/upstream";

export type SuperAdminUser = {
    userId: string;
    companyId: string;
    email: string;
    fullName: string;
    profileImageUrl?: string | null;
    permissionPreset?: string | null;
    modulePermissions?: string[] | null;
    roles: string[];
};

async function getCurrentUser() {
    try {
        const token = (await cookies()).get(ACCESS_COOKIE)?.value;
        if (!token) return null;

        const apiBase = getServerApiBase();
        const response = await fetchUpstream(`${apiBase}/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (response.status === 401) return "unauthenticated" as const;
        if (!response.ok) return null;

        return (await response.json()) as SuperAdminUser;
    } catch (error) {
        unstable_rethrow(error);
        console.error("[superadmin/server] Unable to load current user.", error);
        return null;
    }
}

function isSuperAdmin(user: SuperAdminUser | null) {
    return (user?.roles ?? []).some((role) => role.toUpperCase() === "SUPERADMIN");
}

export async function requireSuperAdmin() {
    const user = await getCurrentUser();

    if (user === "unauthenticated") {
        redirect("/api/auth/logout");
    }

    if (!isSuperAdmin(user)) {
        redirect("/protected/dashboard");
    }

    return user;
}
