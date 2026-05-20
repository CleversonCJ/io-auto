import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";

type UpdateProfileImageBody = {
    profileImageUrl?: string;
    syncCompanyLogo?: boolean;
};

async function getAccessToken() {
    return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function PUT(req: Request) {
    const apiBase = getServerApiBase();
    const access = await getAccessToken();
    if (!access) return NextResponse.json({ message: "Sem token" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as UpdateProfileImageBody | null;
    if (!body?.profileImageUrl) {
        return NextResponse.json({ message: "Imagem de perfil invalida." }, { status: 400 });
    }

    const response = await fetch(`${apiBase}/users/me/profile-image`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
            profileImageUrl: body.profileImageUrl,
            syncCompanyLogo: Boolean(body.syncCompanyLogo),
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        return NextResponse.json({ message: payload?.message ?? "Falha ao atualizar foto de perfil." }, { status: response.status });
    }

    return NextResponse.json(payload ?? { ok: true });
}
