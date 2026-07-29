import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function PUT(_request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/vehicles/${vehicleId}/ad`, { method: "PUT" }, "Falha ao atualizar o anúncio OLX.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/vehicles/${vehicleId}/ad`, { method: "DELETE" }, "Falha ao despublicar o anúncio OLX.");
}
