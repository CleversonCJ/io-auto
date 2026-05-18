type SuperAdminPartnersLayoutProps = {
    children: React.ReactNode;
};

export default function SuperAdminPartnersLayout({ children }: SuperAdminPartnersLayoutProps) {
    return (
        <div className="grid gap-6">
            <section>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/40">Backoffice IO Auto</p>
                <h1 className="mt-2 font-display text-[1.9rem] font-bold text-io-dark">Programa de Parceiros</h1>
                <p className="mt-2 max-w-3xl text-sm text-black/56">
                    Cadastre parceiros, acompanhe os leads recebidos, converta vendas em comissao e enxergue o ranking de quem mais gera receita.
                </p>
            </section>
            {children}
        </div>
    );
}
