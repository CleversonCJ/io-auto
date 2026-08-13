import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream } from "@/core/http/upstream";

const FORWARDED_HEADERS = [
    "cache-control",
    "content-length",
    "content-type",
    "etag",
    "last-modified",
    "location",
] as const;

export async function publicMediaFromUpstream(path: string) {
    const upstream = await fetchUpstream(`${getServerApiBase()}${path}`, {
        cache: "no-store",
        redirect: "manual",
    });
    const headers = new Headers();

    for (const name of FORWARDED_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
        status: upstream.status,
        headers,
    });
}
