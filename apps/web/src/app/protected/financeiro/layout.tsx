import { ReactNode } from "react";
import { FinancialProvider } from "@/modules/financeiro/contexts/FinancialContext";
import { FinancialSubNav } from "@/modules/financeiro/components/FinancialSubNav";

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
    return (
        <FinancialProvider>
            <div className="flex flex-col">
                <header className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-black/35">Módulo financeiro</p>
                    <h1 className="mt-2 font-display text-3xl font-bold text-io-dark">Gestão Financeira</h1>
                    <p className="mt-2 max-w-3xl text-sm text-black/55">
                        Acompanhe seu fluxo de caixa, DRE e contas integradas ao estoque de veículos.
                    </p>
                </header>

                <FinancialSubNav />

                <main>{children}</main>
            </div>
        </FinancialProvider>
    );
}
