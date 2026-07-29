import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type Params = { params: Promise<{ id: string }> };

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

async function refreshAccessToken(apiBase: string) {
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

export async function DELETE(_: Request, { params }: Params) {
    const { id } = await params;
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    let res = await fetch(`${apiBase}/atendimentos/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}` },
    });

    if (res.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) return NextResponse.json({ message: "Sessao expirada" }, { status: 401 });
        access = newAccess;
        res = await fetch(`${apiBase}/atendimentos/conversations/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${access}` },
        });
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ message: data?.message ?? "Falha ao excluir conversa" }, { status: res.status });
    return NextResponse.json({ ok: true });
}
