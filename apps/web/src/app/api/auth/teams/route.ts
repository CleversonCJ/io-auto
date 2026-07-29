import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type TeamBody = {
    name?: string;
};

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function GET() {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const res = await fetch(`${apiBase}/teams`, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ message: data?.message ?? "Falha ao listar equipes" }, { status: res.status });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as TeamBody | null;
    if (!body?.name?.trim()) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    const res = await fetch(`${apiBase}/teams`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ name: body.name }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao criar equipe" }));
        return NextResponse.json({ message: data.message ?? "Falha ao criar equipe" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}
