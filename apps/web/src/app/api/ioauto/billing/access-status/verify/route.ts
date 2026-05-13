import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream(
        "/ioauto/billing/access-status/verify",
        { method: "POST" },
        "Falha ao verificar pagamento da assinatura.",
    );
}
