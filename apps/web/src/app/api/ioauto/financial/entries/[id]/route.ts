import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();
    return jsonFromAuthedUpstream(`/ioauto/financial/entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao atualizar o lançamento financeiro.");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return jsonFromAuthedUpstream(`/ioauto/financial/entries/${id}`, {
        method: "DELETE",
    }, "Falha ao excluir o lançamento financeiro.");
}
