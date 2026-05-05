import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream("/api/integrations/olx/webhook/configure", { method: "POST" }, "Falha ao configurar o webhook da OLX.");
}
