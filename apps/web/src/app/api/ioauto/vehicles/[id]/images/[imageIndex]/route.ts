import { fetchAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string; imageIndex: string }> },
) {
    const { id, imageIndex } = await context.params;
    const result = await fetchAuthedUpstream(
        `/ioauto/vehicles/${encodeURIComponent(id)}/images/${encodeURIComponent(imageIndex)}`,
        {},
        { label: "ioauto/vehicles/image", request },
    );
    if (result.response) return result.response;

    const upstream = result.upstream!;
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "cache-control", "etag", "last-modified", "location"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
        status: upstream.status,
        headers,
    });
}
