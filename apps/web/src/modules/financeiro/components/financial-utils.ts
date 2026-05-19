import type {
    FinancialDreSectionCode,
    FinancialDreSectionRecord,
    FinancialEntryCategory,
    FinancialEntryRecord,
    FinancialEntryStatus,
    FinancialEntryType,
} from "@/modules/financeiro/types";

export type FinancialFormState = {
    id: string | null;
    description: string;
    type: FinancialEntryType;
    dreSubcategoryId: string;
    amount: string;
    dueDate: string;
    counterparty: string;
    notes: string;
    settled: boolean;
    isInstallment: boolean;
    installmentsCount: string;
    installmentAmount: string;
    firstInstallmentDate: string;
};

export const DRE_SECTION_LABELS: Record<FinancialDreSectionCode, string> = {
    GROSS_REVENUE: "Receita Bruta",
    GROSS_REVENUE_DEDUCTIONS: "Deduções da Receita Bruta",
    COST_OF_SALES: "Custos das Vendas (CMV)",
    SALES_EXPENSES: "Despesas com Vendas",
    ADMINISTRATIVE_EXPENSES: "Despesas Administrativas",
    FINANCIAL_REVENUES: "Receitas Financeiras",
    FINANCIAL_EXPENSES: "Despesas Financeiras",
    OTHER_OPERATING_RESULTS: "Outras Receitas/Despesas Operacionais",
};

export function emptyForm(type: FinancialEntryType = "RECEIVABLE", defaultSubcategoryId = ""): FinancialFormState {
    return {
        id: null,
        description: "",
        type,
        dreSubcategoryId: defaultSubcategoryId,
        amount: "",
        dueDate: "",
        counterparty: "",
        notes: "",
        settled: false,
        isInstallment: false,
        installmentsCount: "2",
        installmentAmount: "",
        firstInstallmentDate: "",
    };
}

export function categoryLabel(category: FinancialEntryCategory) {
    const labels: Record<FinancialEntryCategory, string> = {
        VEHICLE_SALE: "Venda de veículo",
        SERVICE_REVENUE: "Receita de serviço",
        OTHER_REVENUE: "Outra receita",
        SUPPLIER: "Fornecedor",
        OPERATING_EXPENSE: "Despesa operacional",
        ADMINISTRATIVE_EXPENSE: "Despesa administrativa",
        TAXES: "Impostos",
        OTHER_EXPENSE: "Outra despesa",
    };
    return labels[category] || category;
}

export function entryPrimaryLabel(entry: FinancialEntryRecord) {
    return entry.dreSubcategoryName || categoryLabel(entry.category);
}

export function entrySecondaryLabel(entry: FinancialEntryRecord) {
    return entry.dreSectionLabel || DRE_SECTION_LABELS[entry.dreSectionCode];
}

export function statusLabel(status: FinancialEntryStatus) {
    if (status === "SETTLED") return "Liquidado";
    if (status === "OVERDUE") return "Atrasado";
    return "Em aberto";
}

export function statusTone(status: FinancialEntryStatus) {
    if (status === "SETTLED") return "bg-emerald-100 text-emerald-700";
    if (status === "OVERDUE") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
}

export function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function amountToInput(value: number) {
    return (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseAmount(value: string) {
    const cleanValue = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleanValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
}

function entryOrder(status: FinancialEntryStatus) {
    if (status === "OVERDUE") return 0;
    if (status === "OPEN") return 1;
    return 2;
}

export function sortEntries(entries: FinancialEntryRecord[]) {
    return [...entries].sort((left, right) => {
        const statusDifference = entryOrder(left.status) - entryOrder(right.status);
        if (statusDifference !== 0) return statusDifference;

        const leftDue = left.dueDate ? new Date(`${left.dueDate}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueDate ? new Date(`${right.dueDate}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;

        const leftUpdated = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightUpdated = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightUpdated - leftUpdated;
    });
}

export function entryToForm(entry: FinancialEntryRecord): FinancialFormState {
    return {
        id: entry.id,
        description: entry.description,
        type: entry.type,
        dreSubcategoryId: entry.dreSubcategoryId ?? "",
        amount: amountToInput(entry.amountCents),
        dueDate: entry.dueDate ?? "",
        counterparty: entry.counterparty ?? "",
        notes: entry.notes ?? "",
        settled: entry.status === "SETTLED",
        isInstallment: false,
        installmentsCount: "2",
        installmentAmount: "",
        firstInstallmentDate: "",
    };
}

export function addMonthsToDate(dateString: string, months: number): string {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1 + months, day);
    if (date.getDate() !== day) {
        date.setDate(0);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function availableSubcategoryGroups(sections: FinancialDreSectionRecord[], type: FinancialEntryType) {
    return sections
        .map((section) => ({
            ...section,
            subcategories: section.subcategories.filter((subcategory) => subcategory.entryType === type),
        }))
        .filter((section) => section.subcategories.length > 0);
}
