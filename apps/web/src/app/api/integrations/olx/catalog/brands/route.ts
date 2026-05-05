import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/api/integrations/olx/catalog/brands", {}, "Falha ao carregar as marcas OLX.");
}
