import { ReactNode } from "react";
import { FinancialProvider } from "@/modules/financeiro/contexts/FinancialContext";
import { FinancialSubNav } from "@/modules/financeiro/components/FinancialSubNav";

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
    return (
        <FinancialProvider>
            <div className="flex flex-col">
                <FinancialSubNav />

                <main>{children}</main>
            </div>
        </FinancialProvider>
    );
}
