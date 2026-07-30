import { notFound } from "next/navigation";
import { PublicInventoryCatalogView } from "@/modules/ioauto/components/PublicInventoryCatalog";
import { getPublicInventoryCatalog } from "@/modules/ioauto/publicCatalog.server";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function EstoquePublicoPage({
    params,
    searchParams,
}: {
    params: Promise<{ companyId: string }>;
    searchParams: Promise<PageSearchParams>;
}) {
    const [{ companyId: companySlug }, query] = await Promise.all([params, searchParams]);
    const data = await getPublicInventoryCatalog(companySlug, {
        sourceType: firstSearchParam(query.source) ?? firstSearchParam(query.origin),
        sourceReference: firstSearchParam(query.ref) ?? firstSearchParam(query.campaign),
    });

    if (!data) {
        notFound();
    }

    return <PublicInventoryCatalogView data={data} />;
}
