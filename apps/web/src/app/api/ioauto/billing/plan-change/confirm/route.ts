import { fetchAuthedUpstream } from "@/app/api/_utils/upstreamAuth";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { readJsonSafely } from "@/core/http/upstream";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.text();
    const path = "/ioauto/billing/plan-change/confirm";
    const apiBase = getServerApiBase();
    const result = await fetchAuthedUpstream(
        path,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        },
        { label: "ioautoBillingPlanChangeConfirm", request },
    );
    if (result.response) return result.response;

    const upstream = result.upstream!;
    const payload = await readJsonSafely<Record<string, unknown> | unknown[]>(upstream);

    if (!upstream.ok) {
        console.error("[ioautoBillingPlanChangeConfirm] upstream-failure", {
            apiBase,
            path,
            status: upstream.status,
            payload,
        });

        const message = typeof payload === "object" && payload && "message" in payload
            ? String((payload as Record<string, unknown>).message ?? "Falha ao confirmar a troca de plano.")
            : "Falha ao confirmar a troca de plano.";
        const code = typeof payload === "object" && payload && "code" in payload
            ? String((payload as Record<string, unknown>).code ?? "")
            : "";

        return NextResponse.json(code ? { code, message } : { message }, { status: upstream.status });
    }

    return NextResponse.json(payload);
}
