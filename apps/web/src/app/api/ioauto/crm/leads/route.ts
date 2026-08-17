import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function GET(request: Request) {
    return jsonFromAuthedUpstream(
        "/ioauto/crm/leads",
        { method: "GET" },
        "Falha ao carregar os leads.",
        { label: "ioauto-crm-leads", request },
    );
}
