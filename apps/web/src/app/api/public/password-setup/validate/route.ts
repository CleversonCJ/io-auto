import { NextResponse } from "next/server";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim() ?? "";

    if (!token) {
        return NextResponse.json({ message: "Token inválido." }, { status: 400 });
    }

    try {
        const apiBase = getServerApiBase();
        const upstream = await fetchUpstream(`${apiBase}/public/password-setup/validate?token=${encodeURIComponent(token)}`, {
            cache: "no-store",
        });

        const payload = await readJsonSafely<Record<string, unknown>>(upstream);
        if (!upstream.ok) {
            return NextResponse.json(
                { message: String(payload?.message ?? "Não foi possível validar o link de definição de senha.") },
                { status: upstream.status }
            );
        }

        return NextResponse.json(payload);
    } catch {
        return NextResponse.json(
            { message: "Não foi possível validar o link de definição de senha no momento." },
            { status: 503 }
        );
    }
}
