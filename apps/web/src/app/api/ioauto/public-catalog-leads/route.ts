import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.toString();

    return jsonFromAuthedUpstream(
        `/ioauto/public-catalog-leads${query ? `?${query}` : ""}`,
        {},
        "Falha ao carregar os leads do cat\u00E1logo."
    );
}
