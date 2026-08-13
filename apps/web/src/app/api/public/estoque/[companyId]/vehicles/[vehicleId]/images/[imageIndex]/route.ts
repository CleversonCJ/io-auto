import { publicMediaFromUpstream } from "@/app/api/_utils/publicMedia";

export async function GET(
    _request: Request,
    context: { params: Promise<{ companyId: string; vehicleId: string; imageIndex: string }> }
) {
    const { companyId, vehicleId, imageIndex } = await context.params;
    return publicMediaFromUpstream(
        `/public/stock/${encodeURIComponent(companyId)}`
        + `/vehicles/${encodeURIComponent(vehicleId)}`
        + `/images/${encodeURIComponent(imageIndex)}`
    );
}
