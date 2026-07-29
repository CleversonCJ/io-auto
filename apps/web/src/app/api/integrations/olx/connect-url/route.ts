import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/api/integrations/olx/connect-url", {}, "Falha ao iniciar a conexão com a OLX.");
}
