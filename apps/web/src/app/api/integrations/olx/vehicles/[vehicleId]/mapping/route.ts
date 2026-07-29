import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(_request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/vehicles/${vehicleId}/mapping`, {}, "Falha ao carregar a configuração OLX do veículo.");
}

export async function PUT(request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    const body = await request.text();
    return jsonFromAuthedUpstream(`/api/integrations/olx/vehicles/${vehicleId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao salvar a configuração OLX do veículo.");
}
