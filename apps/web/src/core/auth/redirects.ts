import { decodeJwt } from "jose";

const SUPERADMIN_HOME = "/protected/superadmin/financeiro";
const DEFAULT_HOME = "/protected/dashboard";

function extractRoles(token: string | null | undefined) {
    if (!token) return [];

    try {
        const payload = decodeJwt(token);
        const roles = payload.roles;
        return Array.isArray(roles) ? roles.map((role) => String(role).toUpperCase()) : [];
    } catch {
        return [];
    }
}

export function resolveProtectedHomePath(token: string | null | undefined) {
    return extractRoles(token).includes("SUPERADMIN") ? SUPERADMIN_HOME : DEFAULT_HOME;
}
