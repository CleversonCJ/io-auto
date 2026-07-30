import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

type JsonRecord = Record<string, unknown>;
type DebugContext = {
    label?: string;
    request?: Request;
};
type RefreshAccessResult =
    | { status: "refreshed"; accessToken: string }
    | { status: "expired" | "unavailable"; accessToken: null };
type RefreshTokenRequestResult =
    | { status: "refreshed"; accessToken: string; refreshToken: string }
    | { status: "expired" | "unavailable"; accessToken: null; refreshToken: null };

const REFRESH_REUSE_WINDOW_MS = 10_000;
const refreshRequests = new Map<string, Promise<RefreshTokenRequestResult>>();

function previewToken(token?: string | null) {
    if (!token) return null;
    return `${token.slice(0, 12)}...(${token.length})`;
}

async function logAuthState(stage: string, path: string, context?: DebugContext) {
    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value ?? null;
    const refresh = store.get(REFRESH_COOKIE)?.value ?? null;
    const cookieHeader = context?.request?.headers.get("cookie") ?? "";

    console.error(`[${context?.label ?? "upstreamAuth"}] ${stage}`, {
        path,
        method: context?.request?.method ?? "GET",
        url: context?.request?.url ?? null,
        host: context?.request?.headers.get("host") ?? null,
        forwardedHost: context?.request?.headers.get("x-forwarded-host") ?? null,
        forwardedProto: context?.request?.headers.get("x-forwarded-proto") ?? null,
        forwardedPort: context?.request?.headers.get("x-forwarded-port") ?? null,
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

function requestRefreshedTokens(apiBase: string, refreshToken: string) {
    const pending = refreshRequests.get(refreshToken);
    if (pending) return pending;

    const request = (async (): Promise<RefreshTokenRequestResult> => {
        try {
            const refreshResponse = await fetchUpstream(`${apiBase}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
                cache: "no-store",
            });

            if (!refreshResponse.ok) {
                return {
                    status: [400, 401, 403].includes(refreshResponse.status) ? "expired" : "unavailable",
                    accessToken: null,
                    refreshToken: null,
                };
            }

            const data = await readJsonSafely<{ accessToken: string; refreshToken: string }>(refreshResponse);
            if (!data?.accessToken || !data.refreshToken) {
                return { status: "unavailable", accessToken: null, refreshToken: null };
            }

            return {
                status: "refreshed",
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            };
        } catch {
            return { status: "unavailable", accessToken: null, refreshToken: null };
        }
    })();

    refreshRequests.set(refreshToken, request);
    void request.finally(() => {
        setTimeout(() => {
            if (refreshRequests.get(refreshToken) === request) {
                refreshRequests.delete(refreshToken);
            }
        }, REFRESH_REUSE_WINDOW_MS);
    });
    return request;
}

async function refreshAccessToken(apiBase: string): Promise<RefreshAccessResult> {
    const store = await cookies();
    const refresh = store.get(REFRESH_COOKIE)?.value;
    if (!refresh) {
        await clearAuthCookies();
        return { status: "expired", accessToken: null };
    }

    const result = await requestRefreshedTokens(apiBase, refresh);
    if (result.status === "refreshed") {
        // Every concurrent route response writes the same rotated pair to the
        // browser, even though only one request reached the auth service.
        await setAuthCookies(result.accessToken, result.refreshToken);
        return { status: "refreshed", accessToken: result.accessToken };
    }
    if (result.status === "expired") {
        await clearAuthCookies();
    }
    return { status: result.status, accessToken: null };
}

function refreshFailureResponse(result: Exclude<RefreshAccessResult, { status: "refreshed" }>) {
    if (result.status === "unavailable") {
        return NextResponse.json({ message: "Servidor de autenticação indisponível no momento." }, { status: 503 });
    }
    return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
}

export async function fetchAuthedUpstream(path: string, init: RequestInit = {}, context?: DebugContext) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) {
        await logAuthState("missing-access-before-upstream", path, context);
        const refreshResult = await refreshAccessToken(apiBase);
        if (refreshResult.status !== "refreshed") {
            return {
                upstream: null,
                response: refreshFailureResponse(refreshResult),
            };
        }
        access = refreshResult.accessToken;
    }

    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
        headers.set("Content-Type", "application/json");
    }
    headers.set("Authorization", `Bearer ${access}`);

    let upstream = await fetchUpstream(`${apiBase}${path}`, {
        ...init,
        headers,
        cache: "no-store",
    });

    if (upstream.status === 401) {
        await logAuthState("upstream-returned-401-before-refresh", path, context);
        const refreshResult = await refreshAccessToken(apiBase);
        if (refreshResult.status !== "refreshed") {
            await logAuthState("refresh-failed-after-upstream-401", path, context);
            return {
                upstream: null,
                response: refreshFailureResponse(refreshResult),
            };
        }
        headers.set("Authorization", `Bearer ${refreshResult.accessToken}`);
        upstream = await fetchUpstream(`${apiBase}${path}`, {
            ...init,
            headers,
            cache: "no-store",
        });
    }

    return { upstream, response: null };
}

export async function jsonFromAuthedUpstream(
    path: string,
    init: RequestInit = {},
    fallbackMessage = "Falha ao processar a requisição.",
    context?: DebugContext,
) {
    const result = await fetchAuthedUpstream(path, init, context);
    if (result.response) return result.response;

    const payload = await readJsonSafely<JsonRecord | JsonRecord[] | unknown[]>(result.upstream!);
    if (!result.upstream!.ok) {
        const message = typeof payload === "object" && payload && "message" in (payload as JsonRecord)
            ? String((payload as JsonRecord).message ?? fallbackMessage)
            : fallbackMessage;
        const code = typeof payload === "object" && payload && "code" in (payload as JsonRecord)
            ? String((payload as JsonRecord).code ?? "")
            : "";
        return NextResponse.json(code ? { code, message } : { message }, { status: result.upstream!.status });
    }

    return NextResponse.json(payload);
}

export async function jsonFromPublicUpstream(path: string, init: RequestInit = {}, fallbackMessage = "Falha ao processar a requisição.") {
    const apiBase = getServerApiBase();
    const upstream = await fetchUpstream(`${apiBase}${path}`, {
        ...init,
        cache: "no-store",
    });

    const payload = await readJsonSafely<JsonRecord | JsonRecord[] | unknown[]>(upstream);
    if (!upstream.ok) {
        const message = typeof payload === "object" && payload && "message" in (payload as JsonRecord)
            ? String((payload as JsonRecord).message ?? fallbackMessage)
            : fallbackMessage;
        const code = typeof payload === "object" && payload && "code" in (payload as JsonRecord)
            ? String((payload as JsonRecord).code ?? "")
            : "";
        return NextResponse.json(code ? { code, message } : { message }, { status: upstream.status });
    }

    return NextResponse.json(payload);
}
