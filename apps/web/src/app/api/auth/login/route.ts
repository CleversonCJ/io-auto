import { NextResponse } from "next/server";
import { setAuthCookies } from "@/core/auth/cookies";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);

    if (!body?.email || !body?.password) {
        return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    try {
        const apiBase = getServerApiBase();
        const res = await fetchUpstream(`${apiBase}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const data = await readJsonSafely<{ code?: string; message?: string }>(res);
            return NextResponse.json(
                {
                    code: data?.code ?? null,
                    message: data?.message ?? "Falha no login",
                },
                { status: res.status },
            );
        }

        const data = await readJsonSafely<{ accessToken?: string; refreshToken?: string }>(res);
        if (!data?.accessToken || !data?.refreshToken) {
            console.error("[auth/login] Backend returned an invalid login payload.");
            return NextResponse.json({ message: "Resposta inválida do servidor de autenticação." }, { status: 502 });
        }

        await setAuthCookies(data.accessToken, data.refreshToken);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[auth/login] Unable to reach authentication backend.", error);
        return NextResponse.json({ message: "Servidor de autenticação indisponível no momento." }, { status: 503 });
    }
}
