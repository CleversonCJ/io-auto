import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();

    return jsonFromAuthedUpstream(
        `/atendimentos/conversations/${encodeURIComponent(id)}/contact`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao atualizar os dados do contato.",
        { label: "atendimentos-conversation-contact", request },
    );
}
