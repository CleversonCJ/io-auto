import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

async function proxyToMercadoLivre(
    request: Request,
    context: { params: Promise<{ path: string[] }> },
    method: "GET" | "POST" | "PUT" | "DELETE",
) {
    const { path } = await context.params;
    const url = new URL(request.url);
    const upstreamPath = `/api/integrations/mercadolivre/${path.join("/")}${url.search}`;
    const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
    const contentType = request.headers.get("content-type");

    return jsonFromAuthedUpstream(
        upstreamPath,
        {
            method,
            headers: body && contentType ? { "Content-Type": contentType } : undefined,
            body,
        },
        "Falha ao processar a integracao com o Mercado Livre.",
    );
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxyToMercadoLivre(request, context, "GET");
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxyToMercadoLivre(request, context, "POST");
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxyToMercadoLivre(request, context, "PUT");
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
    return proxyToMercadoLivre(request, context, "DELETE");
}
