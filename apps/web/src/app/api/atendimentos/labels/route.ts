import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/atendimentos/labels",
        { method: "GET" },
        "Falha ao carregar as etiquetas.",
        { label: "atendimentos-labels", request },
    );
}

export async function PUT(request: Request) {
    const body = await request.text();

    return jsonFromAuthedUpstream(
        "/atendimentos/labels",
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao salvar as etiquetas.",
        { label: "atendimentos-labels", request },
    );
}
