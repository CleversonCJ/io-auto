import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

function previewToken(token?: string | null) {
    if (!token) return null;
    return `${token.slice(0, 12)}...(${token.length})`;
}

async function logAuthState(stage: string, request: Request) {
    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value ?? null;
    const refresh = store.get(REFRESH_COOKIE)?.value ?? null;
    const cookieHeader = request.headers.get("cookie") ?? "";

    console.error("[atendimentos/conversations]", {
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

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

async function refreshAccessToken(apiBase: string) {
    const store = await cookies();
    const refresh = store.get(REFRESH_COOKIE)?.value;
    if (!refresh) return null;

    const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!refreshRes.ok) {
        console.error(`[atendimentos/conversations] refreshAccessToken POST /auth/refresh failed with status: ${refreshRes.status}`);
        if ([400, 401, 403].includes(refreshRes.status)) {
            store.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
            store.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
        }
        return null;
    }

    const data = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
}

export async function GET(request: Request) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) {
        await logAuthState("missing-access-before-upstream", request);
        return NextResponse.json({ message: "Sem token" }, { status: 401 });
    }

    let res = await fetch(`${apiBase}/atendimentos/conversations`, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
    });

    if (res.status === 401) {
        await logAuthState("upstream-returned-401-before-refresh", request);
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) {
            await logAuthState("refresh-failed-after-upstream-401", request);
            return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
        }

        access = newAccess;
        res = await fetch(`${apiBase}/atendimentos/conversations`, {
            headers: { Authorization: `Bearer ${access}` },
            cache: "no-store",
        });
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        return NextResponse.json({ message: data?.message ?? "Falha ao listar conversas" }, { status: res.status });
    }

    return NextResponse.json(data);
}
