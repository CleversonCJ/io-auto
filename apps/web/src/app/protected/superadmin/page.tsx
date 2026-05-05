import { redirect } from "next/navigation";

export default function SuperAdminOverviewPage() {
    redirect("/protected/superadmin/financeiro");
}
