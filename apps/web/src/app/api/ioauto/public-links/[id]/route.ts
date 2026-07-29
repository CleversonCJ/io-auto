import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    return jsonFromAuthedUpstream(`/ioauto/public-links/${id}`, {
        method: "DELETE",
    }, "Falha ao remover o link público.");
}
