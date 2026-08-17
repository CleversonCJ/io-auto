import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/ioauto/collaborators",
        { method: "GET" },
        "Falha ao carregar os colaboradores.",
        { label: "ioauto-collaborators", request },
    );
}
