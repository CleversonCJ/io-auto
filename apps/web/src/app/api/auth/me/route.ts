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
type RefreshOutcome =
    | { status: "refreshed"; accessToken: string }
    | { status: "expired" | "unavailable"; accessToken: null };

function previewToken(token?: string | null) {
    if (!token) return null;
    return `${token.slice(0, 12)}...(${token.length})`;
}

async function logAuthState(stage: string, request: Request) {
    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value ?? null;
    const refresh = store.get(REFRESH_COOKIE)?.value ?? null;
    const cookieHeader = request.headers.get("cookie") ?? "";

    console.error("[auth/me]", {
        stage,
        method: request.method,
        url: request.url,
        host: request.headers.get("host"),
        forwardedHost: request.headers.get("x-forwarded-host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
        forwardedPort: request.headers.get("x-forwarded-port"),
        cookieHeaderPresent: cookieHeader.length > 0,
        cookieHeaderLength: cookieHeader.length,
        hasAccessCookie: Boolean(access),
        hasRefreshCookie: Boolean(refresh),
        accessPreview: previewToken(access),
        refreshPreview: previewToken(refresh),
    });
}

async function refreshAccessToken(apiBase: string): Promise<RefreshOutcome> {
    const cookieStore = await cookies();
    const refresh = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!refresh) {
        await clearAuthCookies();
        return { status: "expired", accessToken: null };
    }

    const refreshRes = await fetchUpstream(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
    });

    const data = await readJsonSafely<RefreshResponse>(refreshRes);
    if (!refreshRes.ok) {
        if ([400, 401, 403].includes(refreshRes.status)) {
            await clearAuthCookies();
            return { status: "expired", accessToken: null };
        }
        return { status: "unavailable", accessToken: null };
    }
    if (!data?.accessToken || !data?.refreshToken) {
        return { status: "unavailable", accessToken: null };
    }

    await setAuthCookies(data.accessToken, data.refreshToken);
    return { status: "refreshed", accessToken: data.accessToken };
}

export async function GET(request: Request) {
    try {
        const apiBase = getServerApiBase();
        const cookieStore = await cookies();
        let token = cookieStore.get(ACCESS_COOKIE)?.value ?? null;
        let refreshed = false;

        if (!token) {
            await logAuthState("missing-access-before-refresh", request);
            console.error("[auth/me] io_access cookie is MISSING! Attempting to refresh using refresh token...");
            const refreshOutcome = await refreshAccessToken(apiBase);
            if (refreshOutcome.status === "unavailable") {
                return NextResponse.json({ message: "Servidor de autenticacao indisponivel no momento." }, { status: 503 });
            }
            token = refreshOutcome.accessToken;
            refreshed = refreshOutcome.status === "refreshed";
        }

        if (!token) {
            await logAuthState("missing-access-and-refresh-after-refresh-attempt", request);
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
            await logAuthState("upstream-returned-401-before-refresh", request);
            console.error("[auth/me] requestMe returned 401. Attempting refresh...");
            const refreshOutcome = await refreshAccessToken(apiBase);
            if (refreshOutcome.status !== "refreshed") {
                await logAuthState("refresh-failed-after-upstream-401", request);
                console.error("[auth/me] refreshAccessToken failed. Returning 401.");
                return NextResponse.json(
                    {
                        message: refreshOutcome.status === "unavailable"
                            ? "Servidor de autenticacao indisponivel no momento."
                            : "Sessao expirada",
                    },
                    { status: refreshOutcome.status === "unavailable" ? 503 : 401 },
                );
            }

            token = refreshOutcome.accessToken;
            refreshed = true;
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

        const response = NextResponse.json(data);
        if (refreshed) {
            response.headers.set("x-io-auth-refreshed", "1");
        }
        return response;
    } catch (error) {
        console.error("[auth/me] Unable to reach authentication backend.", error);
        return NextResponse.json({ message: "Servidor de autenticacao indisponivel no momento." }, { status: 503 });
    }
}
