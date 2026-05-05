import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/api/integrations/olx/balance", {}, "Falha ao consultar o saldo da OLX.");
}
