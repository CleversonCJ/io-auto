import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request) {
    const body = await request.text();
    return jsonFromAuthedUpstream(
        "/ioauto/billing/plan-change/confirm",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao confirmar a troca de plano.",
        { label: "ioautoBillingPlanChangeConfirm", request },
    );
}
