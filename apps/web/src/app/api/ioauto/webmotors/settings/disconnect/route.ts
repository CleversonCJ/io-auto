import { jsonFromAuthedUpstream } from "@/app/api/_utils/upstreamAuth";

export async function POST() {
    return jsonFromAuthedUpstream("/ioauto/webmotors/settings/disconnect", {
        method: "POST",
    }, "Falha ao desconectar a Webmotors.");
}
