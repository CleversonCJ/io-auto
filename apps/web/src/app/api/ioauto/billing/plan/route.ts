import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function PATCH(request: Request) {
    const body = await request.text();
    return jsonFromAuthedUpstream(
        "/ioauto/billing/plan",
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao trocar o plano da conta.",
        { label: "ioautoBillingPlan", request },
    );
}
