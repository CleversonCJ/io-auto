import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/ioauto/billing/access-status", {}, "Falha ao carregar o status de acesso da assinatura.");
}
