import { NextResponse } from "next/server";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);

    if (!body?.token || !body?.password) {
        return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    try {
        const apiBase = getServerApiBase();
        const upstream = await fetchUpstream(`${apiBase}/public/password-setup/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        const payload = await readJsonSafely<Record<string, unknown>>(upstream);
        if (!upstream.ok) {
            return NextResponse.json(
                { message: String(payload?.message ?? "Não foi possível definir sua senha.") },
                { status: upstream.status }
            );
        }

        return NextResponse.json(payload);
    } catch {
        return NextResponse.json(
            { message: "Não foi possível concluir a definição de senha no momento." },
            { status: 503 }
        );
    }
}
