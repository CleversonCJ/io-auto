import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/ioauto/vehicles/options",
        {},
        "Falha ao listar os veículos.",
        {
            label: "ioauto/vehicles/options",
            request,
        },
    );
}
