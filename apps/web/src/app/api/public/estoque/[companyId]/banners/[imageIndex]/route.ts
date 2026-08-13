import { publicMediaFromUpstream } from "@/app/api/_utils/publicMedia";

export async function GET(
    _request: Request,
    context: { params: Promise<{ companyId: string; imageIndex: string }> }
) {
    const { companyId, imageIndex } = await context.params;
    return publicMediaFromUpstream(
        `/public/stock/${encodeURIComponent(companyId)}`
        + `/banners/${encodeURIComponent(imageIndex)}`
    );
}
