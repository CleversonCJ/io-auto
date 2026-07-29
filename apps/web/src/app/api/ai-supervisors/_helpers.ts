import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type BackendJsonOptions = {
    path: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    fallbackMessage: string;
};

export type BackendJsonResult = {
    status: number;
    data: unknown;
};

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

async function refreshAccessToken(apiBase: string) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return null;

    const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) {
        if ([400, 401, 403].includes(refreshRes.status)) {
            cookieStore.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
            cookieStore.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
        }
        return null;
    }

    const data = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken;
}

async function readJsonSafely(res: Response) {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { message: text };
    }
}

export async function requestBackendJson({
    path,
    method = "GET",
    body,
    fallbackMessage,
}: BackendJsonOptions): Promise<BackendJsonResult> {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) {
        return { status: 401, data: { message: "Sem token" } };
    }

    const headers = new Headers();
    if (body !== undefined) headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${access}`);

    const makeRequest = (token: string) =>
        fetch(`${apiBase}${path}`, {
            method,
            headers: (() => {
                const nextHeaders = new Headers(headers);
                nextHeaders.set("Authorization", `Bearer ${token}`);
                return nextHeaders;
            })(),
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: "no-store",
        });

    let res = await makeRequest(access);

    if (res.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) {
            return { status: 401, data: { message: "Sessão expirada" } };
        }
        access = newAccess;
        res = await makeRequest(access);
    }

    const data = await readJsonSafely(res);
    if (!res.ok) {
        const message =
            data && typeof data === "object" && "message" in data
                ? String((data as { message?: unknown }).message ?? fallbackMessage)
                : fallbackMessage;
        return { status: res.status, data: { ...(typeof data === "object" && data ? data as Record<string, unknown> : {}), message } };
    }

    return { status: res.status, data };
}

export async function proxyBackendJson(options: BackendJsonOptions) {
    const result = await requestBackendJson(options);
    return NextResponse.json(result.data, { status: result.status });
}
