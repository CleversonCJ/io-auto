import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(_request: Request, context: { params: Promise<{ brandId: string }> }) {
    const { brandId } = await context.params;
    return jsonFromAuthedUpstream(`/api/integrations/olx/catalog/brands/${brandId}/models`, {}, "Falha ao carregar os modelos OLX.");
}
