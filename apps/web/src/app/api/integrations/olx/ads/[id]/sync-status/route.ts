import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/ads/${id}/sync-status`, { method: "POST" }, "Falha ao sincronizar o status OLX.");
}
