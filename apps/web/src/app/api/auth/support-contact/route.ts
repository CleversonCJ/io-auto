import { NextResponse } from "next/server";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

export async function GET() {
    try {
        const apiBase = getServerApiBase();
        const response = await fetchUpstream(`${apiBase}/auth/support-contact`, {
            method: "GET",
        });

        if (!response.ok) {
            const payload = await readJsonSafely<{ message?: string }>(response);
            return NextResponse.json({ message: payload?.message ?? "Falha ao carregar o contato de suporte." }, { status: response.status });
        }

        const payload = await readJsonSafely(response);
        return NextResponse.json(payload, { status: 200 });
    } catch (error) {
        console.error("[auth/support-contact] Unable to reach backend.", error);
        return NextResponse.json({ message: "Falha ao carregar o contato de suporte." }, { status: 503 });
    }
}
