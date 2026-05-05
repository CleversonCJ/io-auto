import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/api/integrations/olx/status", {}, "Falha ao carregar o status da OLX.");
}
