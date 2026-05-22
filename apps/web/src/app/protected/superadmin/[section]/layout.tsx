import { superAdminSections, type SuperAdminSectionKey } from "@/modules/superadmin/data";
import { HeaderActionsSlot } from "./HeaderActionsSlot";

type SuperAdminSectionLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ section: string }>;
};

export default async function SuperAdminSectionLayout({ children, params }: SuperAdminSectionLayoutProps) {
    const { section } = await params;
    const key = section as SuperAdminSectionKey;
    const currentSection = key in superAdminSections ? superAdminSections[key] : null;

    return (
        <div className="grid gap-6">
            <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Backoffice IO Auto</p>
                    <h1 className="mt-2 font-display text-[1.9rem] font-bold text-io-dark">
                        {currentSection?.title ?? "Super Admin"}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-black/56">
                        {currentSection?.description ?? "Paginas exclusivas para a operacao do sistema."}
                    </p>
                </div>
                <HeaderActionsSlot />
            </section>
            {children}
        </div>
    );
}
