import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(_request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/vehicles/${vehicleId}/publish`, { method: "POST" }, "Falha ao publicar o veículo na OLX.");
}
