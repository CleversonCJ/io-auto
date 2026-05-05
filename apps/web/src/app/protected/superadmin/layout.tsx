import { superAdminSections, type SuperAdminSectionKey } from "@/modules/superadmin/data";
import { requireSuperAdmin } from "@/modules/superadmin/server";

type SuperAdminLayoutProps = {
    children: React.ReactNode;
    params?: Promise<{ section?: string }>;
};

export default async function SuperAdminLayout({ children, params }: SuperAdminLayoutProps) {
    await requireSuperAdmin();

    const resolvedParams = params ? await params : undefined;
    const section = resolvedParams?.section as SuperAdminSectionKey | undefined;
    const currentSection = section && section in superAdminSections ? superAdminSections[section] : null;

    return (
        <div className="grid gap-6">
            <section>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Backoffice IO Auto</p>
                <h1 className="mt-2 font-display text-[1.9rem] font-bold text-io-dark">
                    {currentSection?.title ?? "Central do Super Admin"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-black/56">
                    {currentSection?.description ?? "Paginas exclusivas para a operacao do sistema, com foco em receita, clientes, produto, crescimento e gestao das contas."}
                </p>
            </section>
            {children}
        </div>
    );
}
