import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();
    return jsonFromAuthedUpstream(`/ioauto/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao atualizar o veículo.");
}
