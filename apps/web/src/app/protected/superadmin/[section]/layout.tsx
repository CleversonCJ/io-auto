import { HeaderActionsSlot } from "./HeaderActionsSlot";

type SuperAdminSectionLayoutProps = {
    children: React.ReactNode;
};

export default function SuperAdminSectionLayout({ children }: SuperAdminSectionLayoutProps) {
    return (
        <div className="grid gap-6">
            <HeaderActionsSlot />
            {children}
        </div>
    );
}
