import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/public-links", {}, "Falha ao carregar os links públicos.");
}

export async function POST(request: Request) {
    const body = await request.text();

    return jsonFromAuthedUpstream("/ioauto/public-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao criar o link público.");
}
