import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/public-catalog-settings", {}, "Falha ao carregar as configurações do catálogo público.");
}

export async function PUT(request: Request) {
    const body = await request.text();

    return jsonFromAuthedUpstream("/ioauto/public-catalog-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao salvar as configurações do catálogo público.");
}
