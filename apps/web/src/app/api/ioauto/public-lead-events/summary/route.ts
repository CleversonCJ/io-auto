import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/public-lead-events/summary", {}, "Falha ao carregar o resumo de divulgação.");
}
