import { publicMediaFromUpstream } from "@/app/api/_utils/publicMedia";

export async function GET(
    _request: Request,
    context: { params: Promise<{ companyId: string }> }
) {
    const { companyId } = await context.params;
    return publicMediaFromUpstream(
        `/public/stock/${encodeURIComponent(companyId)}/profile-image`
    );
}
