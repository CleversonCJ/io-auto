type SuperAdminPartnersLayoutProps = {
    children: React.ReactNode;
};

export default function SuperAdminPartnersLayout({ children }: SuperAdminPartnersLayoutProps) {
    return (
        <div className="grid gap-6">
            {children}
        </div>
    );
}
