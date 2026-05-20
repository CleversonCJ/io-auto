import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();

    return jsonFromAuthedUpstream(`/ioauto/public-catalog-leads/${id}/close-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao concluir a venda deste lead.");
}
