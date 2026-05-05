import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream("/api/integrations/olx/disconnect", { method: "POST" }, "Falha ao desconectar a OLX.");
}
