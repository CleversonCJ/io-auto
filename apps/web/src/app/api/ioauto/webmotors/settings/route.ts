import { NextRequest } from "next/server";
import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: NextRequest) {
    return jsonFromAuthedUpstream(`/ioauto/webmotors/settings${request.nextUrl.search}`, {}, "Falha ao carregar as configuracoes da Webmotors.");
}

export async function PUT(request: NextRequest) {
    const body = await request.text();
    return jsonFromAuthedUpstream("/ioauto/webmotors/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao salvar as configuracoes da Webmotors.");
}
