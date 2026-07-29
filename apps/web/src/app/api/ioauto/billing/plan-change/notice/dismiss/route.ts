import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream(
        "/ioauto/billing/plan-change/notice/dismiss",
        { method: "POST" },
        "Falha ao confirmar a leitura da alteração de plano.",
    );
}
