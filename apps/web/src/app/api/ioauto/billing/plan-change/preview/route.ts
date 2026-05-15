import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request) {
    const body = await request.text();
    return jsonFromAuthedUpstream(
        "/ioauto/billing/plan-change/preview",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao gerar a previa da troca de plano.",
        { label: "ioautoBillingPlanChangePreview", request },
    );
}
