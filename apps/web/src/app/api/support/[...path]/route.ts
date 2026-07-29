import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

async function proxy(
    request: Request,
    context: { params: Promise<{ path: string[] }> },
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
) {
    const { path } = await context.params;
    const url = new URL(request.url);
    const upstreamPath = `/api/support/${path.join("/")}${url.search}`;

    const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
    const contentType = request.headers.get("content-type");

    return jsonFromAuthedUpstream(
        upstreamPath,
        {
            method,
            headers: body && contentType ? { "Content-Type": contentType } : undefined,
            body,
        },
        "Falha ao processar a requisição de suporte.",
    );
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxy(request, context, "GET");
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxy(request, context, "POST");
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxy(request, context, "PUT");
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxy(request, context, "PATCH");
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxy(request, context, "DELETE");
}
