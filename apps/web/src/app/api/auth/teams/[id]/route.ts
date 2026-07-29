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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as TeamBody | null;
    if (!body?.name?.trim()) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    const res = await fetch(`${apiBase}/teams/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ name: body.name }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar equipe" }));
        return NextResponse.json({ message: data.message ?? "Falha ao atualizar equipe" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    const res = await fetch(`${apiBase}/teams/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}` },
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao excluir equipe" }));
        return NextResponse.json({ message: data.message ?? "Falha ao excluir equipe" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}
