import { jsonFromPublicUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const body = await request.text();
    const contentType = request.headers.get("content-type");

    return jsonFromPublicUpstream(
        `/public/partners/lead${query ? `?${query}` : ""}`,
        {
            method: "POST",
            headers: body && contentType ? { "Content-Type": contentType } : undefined,
            body,
        },
        "Falha ao registrar o lead do parceiro."
    );
}
