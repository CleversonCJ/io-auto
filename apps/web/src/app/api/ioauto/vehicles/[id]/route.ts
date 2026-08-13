import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return jsonFromAuthedUpstream(`/ioauto/vehicles/${encodeURIComponent(id)}`, {}, "Falha ao carregar o veículo.", {
        label: "ioauto/vehicles/detail",
        request,
    });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();
    return jsonFromAuthedUpstream(`/ioauto/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao atualizar o veículo.");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return jsonFromAuthedUpstream(
        `/ioauto/vehicles/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        "Falha ao excluir o veículo.",
        { label: "ioauto/vehicles/delete", request },
    );
}
