import { SuperAdminPartnerDetailPage } from "@/modules/superadmin/components/SuperAdminPartnerDetailPage";

export default async function SuperAdminPartnerDetailRoute({
    params,
}: {
    params: Promise<{ partnerId: string }>;
}) {
    const { partnerId } = await params;
    return <SuperAdminPartnerDetailPage partnerId={partnerId} />;
}
