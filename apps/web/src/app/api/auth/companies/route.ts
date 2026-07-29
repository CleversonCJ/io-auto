import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type CreateCompanyBody = {
    companyName?: string;
    profileImageUrl?: string;
    companyEmail?: string;
    contractEndDate?: string;
    cnpj?: string;
    openedAt?: string;
    whatsappNumber?: string;
    password?: string;
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

export async function GET() {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    let res = await fetch(`${apiBase}/companies`, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
    });

    if (res.status === 401) {
        const newAccess = await refreshAccessToken(apiBase);
        if (!newAccess) return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
        access = newAccess;
        res = await fetch(`${apiBase}/companies`, {
            headers: { Authorization: `Bearer ${access}` },
            cache: "no-store",
        });
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ message: data?.message ?? "Falha ao listar empresas" }, { status: res.status });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const apiBase = getServerApiBase();
    let access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as CreateCompanyBody | null;
    if (
        !body?.companyName ||
        !body?.companyEmail ||
        !body?.contractEndDate ||
        !body?.cnpj ||
        !body?.openedAt ||
        !body?.whatsappNumber ||
        !body?.password ||
        !body?.businessHoursStart ||
        !body?.businessHoursEnd ||
        !body?.businessHoursWeekly
    ) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    let res = await fetch(`${apiBase}/companies`, {
        method: "POST",
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
        res = await fetch(`${apiBase}/companies`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${access}`,
            },
            body: JSON.stringify(body),
        });
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao criar empresa" }));
        return NextResponse.json({ message: data.message ?? "Falha ao criar empresa" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
}
