import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    return jsonFromAuthedUpstream(
        `/atendimentos/conversations/${encodeURIComponent(id)}/events`,
        { method: "GET" },
        "Falha ao carregar o histórico da conversa.",
        { label: "atendimentos-conversation-events", request },
    );
}
