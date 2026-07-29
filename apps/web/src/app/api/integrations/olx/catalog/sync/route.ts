import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream("/api/integrations/olx/catalog/sync", { method: "POST" }, "Falha ao sincronizar o catálogo da OLX.");
}
