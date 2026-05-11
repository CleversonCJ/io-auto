import { NextResponse } from "next/server";
import { fetchAuthedUpstream } from "@/app/api/_utils/upstreamAuth";
import { setAuthCookies } from "@/core/auth/cookies";
import { readJsonSafely } from "@/core/http/upstream";

type ExitPayload = {
    actorUserId?: string;
    actorTenantId?: string;
    actorName?: string;
    actorEmail?: string;
    accessToken?: string;
    refreshToken?: string;
    accessExpiresInSeconds?: number;
    message?: string;
};

export async function POST() {
    const result = await fetchAuthedUpstream("/api/impersonation/exit", {
        method: "POST",
    });

    if (result.response) return result.response;

    const payload = await readJsonSafely<ExitPayload>(result.upstream!);
    if (!result.upstream!.ok) {
        return NextResponse.json({ message: payload?.message ?? "Falha ao encerrar impersonacao." }, { status: result.upstream!.status });
    }

    if (!payload?.accessToken || !payload?.refreshToken) {
        return NextResponse.json({ message: "Resposta invalida ao encerrar impersonacao." }, { status: 502 });
    }

    await setAuthCookies(payload.accessToken, payload.refreshToken);
    return NextResponse.json({
        ok: true,
        actorUserId: payload.actorUserId,
        actorTenantId: payload.actorTenantId,
        actorName: payload.actorName,
        actorEmail: payload.actorEmail,
        accessExpiresInSeconds: payload.accessExpiresInSeconds,
    });
}
