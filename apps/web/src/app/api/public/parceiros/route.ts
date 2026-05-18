import { jsonFromPublicUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.toString();
    return jsonFromPublicUpstream(`/public/partners${query ? `?${query}` : ""}`, {}, "Falha ao consultar o parceiro.");
}
