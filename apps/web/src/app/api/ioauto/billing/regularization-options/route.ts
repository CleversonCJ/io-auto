import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream(
        "/ioauto/billing/regularization-options",
        {},
        "Falha ao carregar opcoes de regularizacao da assinatura.",
    );
}
