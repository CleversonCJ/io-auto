import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/integrations", {}, "Falha ao listar as integrações.");
}
