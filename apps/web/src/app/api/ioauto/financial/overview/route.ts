import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/financial/overview", {}, "Falha ao carregar o módulo financeiro.");
}
