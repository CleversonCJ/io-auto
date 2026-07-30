import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();

    return jsonFromAuthedUpstream(
        `/atendimentos/conversations/${encodeURIComponent(id)}/read`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao marcar a conversa como lida.",
        { label: "atendimentos-conversation-read", request },
    );
}
