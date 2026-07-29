import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

export async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function refreshAccessToken(apiBase: string) {
    const c = await cookies();
    const refresh = c.get(REFRESH_COOKIE)?.value;
    if (!refresh) return null;

    const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!refreshRes.ok) {
        if ([400, 401, 403].includes(refreshRes.status)) {
            c.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
            c.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
        }
        return null;
    }

    const data = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
}

export async function fetchWithAuthRetry(input: string, init: RequestInit = {}) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) {
        return {
            apiBase,
            response: new Response(JSON.stringify({ message: "Sem token" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }),
        };
    }

    const makeRequest = (token: string) => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers, cache: "no-store" });
    };

    let response = await makeRequest(access);
    if (response.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) {
            return {
                apiBase,
                response: new Response(JSON.stringify({ message: "Sessão expirada" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }),
            };
        }
        access = newAccess;
        response = await makeRequest(access);
    }

    return { apiBase, response };
}
