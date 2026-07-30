import { notFound } from "next/navigation";
import { PublicVehicleDetailView } from "@/modules/ioauto/components/PublicVehicleDetail";
import { getPublicVehicleDetail } from "@/modules/ioauto/publicCatalog.server";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function EstoquePublicoVeiculoPage({
    params,
    searchParams,
}: {
    params: Promise<{ companyId: string; vehicleId: string }>;
    searchParams: Promise<PageSearchParams>;
}) {
    const [{ companyId: companySlug, vehicleId }, query] = await Promise.all([params, searchParams]);
    const data = await getPublicVehicleDetail(companySlug, vehicleId, {
        sourceType: firstSearchParam(query.source) ?? firstSearchParam(query.origin),
        sourceReference: firstSearchParam(query.ref) ?? firstSearchParam(query.campaign),
    });

    if (!data) {
        notFound();
    }

    return <PublicVehicleDetailView data={data} />;
}
