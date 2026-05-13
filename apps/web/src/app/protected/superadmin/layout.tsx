import { requireSuperAdmin } from "@/modules/superadmin/server";

type SuperAdminLayoutProps = {
    children: React.ReactNode;
};

export default async function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
    await requireSuperAdmin();
    return children;
}
