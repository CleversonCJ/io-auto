import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type UpdateUserBody = {
    email?: string;
    fullName?: string;
    profileImageUrl?: string;
    jobTitle?: string;
    birthDate?: string;
    password?: string;
    permissionPreset?: string;
    modulePermissions?: string[];
    teamId?: string;
    roles?: string[];
};

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as UpdateUserBody | null;
    if (!body?.email || !body?.fullName || !body?.teamId || !Array.isArray(body.roles) || body.roles.length === 0) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    const payload = {
        email: body.email,
        fullName: body.fullName,
        profileImageUrl: body.profileImageUrl,
        jobTitle: body.jobTitle,
        birthDate: body.birthDate,
        password: body.password?.trim() ? body.password : undefined,
        permissionPreset: body.permissionPreset,
        modulePermissions: body.modulePermissions,
        teamId: body.teamId,
        roles: body.roles,
    };

    const res = await fetch(`${apiBase}/users/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao atualizar colaborador" }));
        return NextResponse.json({ message: data.message ?? "Falha ao atualizar colaborador" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const { id } = await ctx.params;
    const res = await fetch(`${apiBase}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}` },
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Falha ao excluir colaborador" }));
        return NextResponse.json({ message: data.message ?? "Falha ao excluir colaborador" }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}
