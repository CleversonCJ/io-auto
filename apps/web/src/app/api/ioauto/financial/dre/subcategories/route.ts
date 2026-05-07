import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request) {
    const body = await request.text();
    return jsonFromAuthedUpstream("/ioauto/financial/dre/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    }, "Falha ao salvar a subcategoria do DRE.");
}
