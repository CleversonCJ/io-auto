import { NextResponse } from "next/server";
import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";

type ApiError = {
    message?: string;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ companyId: string }> }
) {
    const { companyId } = await context.params;
    const body = await request.text();
    const apiBase = getServerApiBase();

    const upstream = await fetchUpstream(`${apiBase}/public/stock/${companyId}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
    });

    if (upstream.ok) {
        return new NextResponse(null, { status: 204 });
    }

    const payload = await readJsonSafely<ApiError>(upstream);

    if (upstream.status === 404) {
        return NextResponse.json({
            message: "O backend ainda não carregou o endpoint novo de leads do catálogo. Reinicie a API para aplicar a rota e a migração mais recente.",
        }, { status: 404 });
    }

    if (upstream.status === 401 || upstream.status === 403) {
        return NextResponse.json({
            message: "O backend bloqueou o envio do formulário público. Atualize e reinicie a API para liberar o endpoint de leads do catálogo.",
        }, { status: upstream.status });
    }

    return NextResponse.json({
        message: payload?.message ?? "Falha ao registrar o lead do catálogo.",
    }, { status: upstream.status });
}
