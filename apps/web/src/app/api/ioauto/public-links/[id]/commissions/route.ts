import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    return jsonFromAuthedUpstream(
        `/ioauto/public-links/${id}/commissions`,
        {},
        "Falha ao carregar o histórico de comissão."
    );
}
