import { notFound } from "next/navigation";
import { SuperAdminDashboardSection } from "@/modules/superadmin/components/SuperAdminDashboardSection";
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

    return <SuperAdminDashboardSection section={superAdminSections[key]} />;
}
