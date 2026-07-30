import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/atendimentos/classifications",
        { method: "GET" },
        "Falha ao carregar as classificações.",
        { label: "atendimentos-classifications", request },
    );
}

export async function PUT(request: Request) {
    const body = await request.text();

    return jsonFromAuthedUpstream(
        "/atendimentos/classifications",
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body,
        },
        "Falha ao salvar as classificações.",
        { label: "atendimentos-classifications", request },
    );
}
