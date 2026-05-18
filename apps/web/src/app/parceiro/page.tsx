import { PublicPartnerLeadPage } from "@/modules/superadmin/components/PublicPartnerLeadPage";

export default async function PublicPartnerRoute({
    searchParams,
}: {
    searchParams: Promise<{ ref?: string }>;
}) {
    const { ref } = await searchParams;
    return <PublicPartnerLeadPage initialRef={ref ?? ""} />;
}
