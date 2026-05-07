import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST(request: Request, context: { params: Promise<{ vehicleId: string }> }) {
    const { vehicleId } = await context.params;
    return jsonFromAuthedUpstream(
        `/ioauto/webmotors/ads/${vehicleId}/publish${new URL(request.url).search}`,
        { method: "POST" },
        "Falha ao publicar o veiculo na Webmotors.",
    );
}
