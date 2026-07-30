import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/ioauto/vehicles/inventory-summaries",
        {},
        "Falha ao listar o resumo dos veículos.",
        {
            label: "ioauto/vehicles/inventory-summaries",
            request,
        },
    );
}
