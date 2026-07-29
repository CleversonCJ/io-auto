import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/publications", {}, "Falha ao listar as publicações.");
}
