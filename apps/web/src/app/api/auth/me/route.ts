import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

type RefreshResponse = {
    accessToken?: string;
    refreshToken?: string;
    message?: string;
};

async function refreshAccessToken(apiBase: string) {
    const cookieStore = await cookies();
    const refresh = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!refresh) {
        await clearAuthCookies();
        return null;
    }

    const refreshRes = await fetchUpstream(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
    });

    const data = await readJsonSafely<RefreshResponse>(refreshRes);
    if (!refreshRes.ok || !data?.accessToken || !data?.refreshToken) {
        await clearAuthCookies();
        return null;
    }

    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
}

export async function GET() {
    try {
        const apiBase = getServerApiBase();
        const cookieStore = await cookies();
        let token = cookieStore.get(ACCESS_COOKIE)?.value ?? null;

        if (!token) {
            console.error("[auth/me] io_access cookie is MISSING! Attempting to refresh using refresh token...");
            token = await refreshAccessToken(apiBase);
        }

        if (!token) {
            console.error("[auth/me] Both access and refresh failed/missing. Returning 401.");
            return NextResponse.json({ message: "Sessao expirada" }, { status: 401 });
        }

        const requestMe = (accessToken: string) =>
            fetchUpstream(`${apiBase}/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            });

        let res = await requestMe(token);

        if (res.status === 401) {
            console.error("[auth/me] requestMe returned 401. Attempting refresh...");
            const newToken = await refreshAccessToken(apiBase);
            if (!newToken) {
                console.error("[auth/me] refreshAccessToken failed. Returning 401.");
                return NextResponse.json({ message: "Sessao expirada" }, { status: 401 });
            }

            token = newToken;
            res = await requestMe(token);
        }

        const data = await readJsonSafely<{ message?: string }>(res);

        if (res.status === 401) {
            await clearAuthCookies();
            return NextResponse.json({ message: "Sessao expirada" }, { status: 401 });
        }

        if (!res.ok) {
            return NextResponse.json({ message: data?.message ?? "Falha ao obter usuario" }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("[auth/me] Unable to reach authentication backend.", error);
        return NextResponse.json({ message: "Servidor de autenticacao indisponivel no momento." }, { status: 503 });
    }
}
