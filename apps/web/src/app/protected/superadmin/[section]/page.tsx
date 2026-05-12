import { notFound } from "next/navigation";
import { SuperAdminLiveSection, type SuperAdminLiveSectionKey } from "@/modules/superadmin/components/SuperAdminLiveSection";
import { SuperAdminTenantsPage } from "@/modules/superadmin/components/SuperAdminTenantsPage";
import { superAdminSections, type SuperAdminSectionKey } from "@/modules/superadmin/data";

export default async function SuperAdminSectionPage({
    params,
}: {
    params: Promise<{ section: string }>;
}) {
    const { section } = await params;
    const key = section as SuperAdminSectionKey;

    if (!(key in superAdminSections)) {
        notFound();
    }

    if (key === "tenants") {
        return <SuperAdminTenantsPage />;
    }

    return <SuperAdminLiveSection section={key as SuperAdminLiveSectionKey} />;
}
