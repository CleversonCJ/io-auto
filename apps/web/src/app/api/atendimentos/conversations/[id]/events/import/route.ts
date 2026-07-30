import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = await request.text();

    return jsonFromAuthedUpstream(
        `/atendimentos/conversations/${encodeURIComponent(id)}/events/import`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao importar o histórico da conversa.",
        { label: "atendimentos-conversation-events-import", request },
    );
}
