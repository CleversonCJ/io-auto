import { NextResponse } from "next/server";
import { fetchAuthedUpstream } from "@/app/api/_utils/upstreamAuth";
import { setAuthCookies } from "@/core/auth/cookies";
import { readJsonSafely } from "@/core/http/upstream";

type StartBody = {
    tenantId?: string;
};

type ImpersonationPayload = {
    tenantId?: string;
    impersonatedUserId?: string;
    impersonatedUserName?: string;
    impersonatedUserEmail?: string;
    accessToken?: string;
    refreshToken?: string;
    accessExpiresInSeconds?: number;
    message?: string;
};

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as StartBody | null;
    if (!body?.tenantId) {
        return NextResponse.json({ message: "tenantId obrigatorio" }, { status: 400 });
    }

    const result = await fetchAuthedUpstream(`/api/superadmin/tenants/${encodeURIComponent(body.tenantId)}/impersonate`, {
        method: "POST",
    });

    if (result.response) return result.response;

    const payload = await readJsonSafely<ImpersonationPayload>(result.upstream!);
    if (!result.upstream!.ok) {
        return NextResponse.json({ message: payload?.message ?? "Falha ao iniciar impersonacao." }, { status: result.upstream!.status });
    }

    if (!payload?.accessToken || !payload?.refreshToken) {
        return NextResponse.json({ message: "Resposta invalida ao iniciar impersonacao." }, { status: 502 });
    }

    await setAuthCookies(payload.accessToken, payload.refreshToken);
    return NextResponse.json({
        ok: true,
        tenantId: payload.tenantId,
        impersonatedUserId: payload.impersonatedUserId,
        impersonatedUserName: payload.impersonatedUserName,
        impersonatedUserEmail: payload.impersonatedUserEmail,
        accessExpiresInSeconds: payload.accessExpiresInSeconds,
    });
}
