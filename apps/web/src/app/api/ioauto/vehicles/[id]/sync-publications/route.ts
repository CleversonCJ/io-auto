import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return jsonFromAuthedUpstream(
        `/ioauto/vehicles/${encodeURIComponent(id)}/sync-publications`,
        { method: "POST" },
        "O veículo foi salvo, mas não foi possível agendar a sincronização das integrações.",
        { label: "ioauto/vehicles/sync-publications", request },
    );
}
