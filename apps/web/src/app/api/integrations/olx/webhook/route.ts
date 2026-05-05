import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET() {
    return jsonFromAuthedUpstream("/api/integrations/olx/webhook", {}, "Falha ao consultar o webhook da OLX.");
}

export async function PUT() {
    return jsonFromAuthedUpstream("/api/integrations/olx/webhook", { method: "PUT" }, "Falha ao atualizar o webhook da OLX.");
}

export async function DELETE() {
    return jsonFromAuthedUpstream("/api/integrations/olx/webhook", { method: "DELETE" }, "Falha ao remover o webhook da OLX.");
}
