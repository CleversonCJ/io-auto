import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type UpdateCompanyBody = {
    companyName?: string;
    profileImageUrl?: string;
    companyEmail?: string;
    contractEndDate?: string;
    cnpj?: string;
    openedAt?: string;
    whatsappNumber?: string;
    businessHoursStart?: string;
    businessHoursEnd?: string;
    businessHoursWeekly?: unknown;
};

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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as UpdateCompanyBody | null;
    if (
        !body?.companyName ||
        !body?.companyEmail ||
        !body?.contractEndDate ||
        !body?.cnpj ||
        !body?.openedAt ||
        !body?.whatsappNumber ||
        !body?.businessHoursStart ||
        !body?.businessHoursEnd ||
        !body?.businessHoursWeekly
    ) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    let res = await fetch(`${apiBase}/companies/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(body),
    });

    if (res.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
        access = newAccess;
        res = await fetch(`${apiBase}/companies/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${access}`,
            },
            body: JSON.stringify(body),
        });
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar empresa" }));
        return NextResponse.json({ message: data.message ?? "Falha ao atualizar empresa" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    let res = await fetch(`${apiBase}/companies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}` },
    });

    if (res.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
        access = newAccess;
        res = await fetch(`${apiBase}/companies/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${access}` },
        });
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao excluir empresa" }));
        return NextResponse.json({ message: data.message ?? "Falha ao excluir empresa" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}
