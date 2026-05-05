import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/public-catalog-settings", {}, "Falha ao carregar as configuracoes do catalogo publico.");
}

export async function PUT(request: Request) {
    const body = await request.text();

    return jsonFromAuthedUpstream("/ioauto/public-catalog-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao salvar as configuracoes do catalogo publico.");
}
