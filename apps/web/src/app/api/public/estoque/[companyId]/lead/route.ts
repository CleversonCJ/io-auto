import { jsonFromPublicUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(
    request: Request,
    context: { params: Promise<{ companyId: string }> }
) {
    const { companyId } = await context.params;
    const body = await request.text();

    return jsonFromPublicUpstream(`/public/stock/${companyId}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao registrar o lead do cat\u00E1logo.");
}
