import { fetchAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const result = await fetchAuthedUpstream(
        `/ioauto/vehicles/${encodeURIComponent(id)}/cover-image`,
        {},
        {
            label: "ioauto/vehicles/cover-image",
            request,
        },
    );
    if (result.response) return result.response;

    const upstream = result.upstream!;
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
        status: upstream.status,
        headers,
    });
}
