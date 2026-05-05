import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(
    _request: Request,
    context: { params: Promise<{ brandId: string; modelId: string }> }
) {
    const { brandId, modelId } = await context.params;
    return jsonFromAuthedUpstream(
        `/api/integrations/olx/catalog/brands/${brandId}/models/${modelId}/versions`,
        {},
        "Falha ao carregar as versoes OLX."
    );
}
