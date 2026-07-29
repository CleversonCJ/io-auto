import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

export async function POST() {
    try {
        const apiBase = getServerApiBase();
        const cookieStore = await cookies();
        const refresh = cookieStore.get(REFRESH_COOKIE)?.value;

        if (!refresh) {
            return NextResponse.json({ message: "Sem refresh token" }, { status: 401 });
        }

        const res = await fetchUpstream(`${apiBase}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: refresh }),
        });

        const data = await readJsonSafely<{ accessToken?: string; refreshToken?: string; message?: string }>(res);
        if (!res.ok) {
            if ([400, 401, 403].includes(res.status)) {
                await clearAuthCookies();
            }
            return NextResponse.json({ message: data?.message ?? "Sessao expirada" }, { status: res.status });
        }

        if (!data?.accessToken || !data?.refreshToken) {
            return NextResponse.json({ message: "Resposta invalida do servidor de autenticacao." }, { status: 502 });
        }

        await setAuthCookies(data.accessToken, data.refreshToken);
        return NextResponse.json(data);
    } catch (error) {
        console.error("[auth/refresh] Unable to reach authentication backend.", error);
        return NextResponse.json({ message: "Servidor de autenticacao indisponivel no momento." }, { status: 503 });
    }
}
