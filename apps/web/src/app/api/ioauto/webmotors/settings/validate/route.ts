import { NextRequest } from "next/server";
import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: NextRequest) {
    return jsonFromAuthedUpstream(`/ioauto/webmotors/settings/validate${request.nextUrl.search}`, {
        method: "POST",
    }, "Falha ao validar as credenciais da Webmotors.");
}
