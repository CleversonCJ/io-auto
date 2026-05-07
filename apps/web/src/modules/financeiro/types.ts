export type FinancialEntryType = "RECEIVABLE" | "PAYABLE";

export type FinancialEntryStatus = "OPEN" | "OVERDUE" | "SETTLED";

export type FinancialEntrySource = "MANUAL" | "VEHICLE_SALE";

export type FinancialEntryCategory =
    | "VEHICLE_SALE"
    | "SERVICE_REVENUE"
    | "OTHER_REVENUE"
    | "SUPPLIER"
    | "OPERATING_EXPENSE"
    | "ADMINISTRATIVE_EXPENSE"
    | "TAXES"
    | "OTHER_EXPENSE";

export type FinancialDreSectionCode =
    | "GROSS_REVENUE"
    | "GROSS_REVENUE_DEDUCTIONS"
    | "COST_OF_SALES"
    | "SALES_EXPENSES"
    | "ADMINISTRATIVE_EXPENSES"
    | "FINANCIAL_REVENUES"
    | "FINANCIAL_EXPENSES"
    | "OTHER_OPERATING_RESULTS";

export type FinancialDreEntryTypeMode = FinancialEntryType | "BOTH";

export type FinancialDreSubcategoryRecord = {
    id: string;
    code: string;
    name: string;
    sectionCode: FinancialDreSectionCode;
    entryType: FinancialEntryType;
    system: boolean;
    locked: boolean;
    sortOrder: number;
};

export type FinancialDreSectionRecord = {
    code: FinancialDreSectionCode;
    label: string;
    description: string;
    entryTypeMode: FinancialDreEntryTypeMode;
    acceptsEntries: boolean;
    sortOrder: number;
    subcategories: FinancialDreSubcategoryRecord[];
};

export type FinancialEntryRecord = {
    id: string;
    description: string;
    type: FinancialEntryType;
    category: FinancialEntryCategory;
    amountCents: number;
    dueDate: string | null;
    settledAt: string | null;
    status: FinancialEntryStatus;
    counterparty: string | null;
    notes: string | null;
    source: FinancialEntrySource;
    vehicleId: string | null;
    vehicleTitle: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    dreSectionCode: FinancialDreSectionCode;
    dreSectionLabel: string;
    dreSubcategoryId: string | null;
    dreSubcategoryName: string | null;
};

export type FinancialOverviewApiResponse = {
    cashFlow: {
        entryCents: number;
        exitCents: number;
        balanceCents: number;
    };
    dre: {
        vehicleSalesRevenueCents: number;
        otherRevenueCents: number;
        grossRevenueCents: number;
        taxExpensesCents: number;
        operatingExpensesCents: number;
        netResultCents: number;
    };
    inventoryValueCents: number;
    accountsReceivable: {
        openAmountCents: number;
        settledAmountCents: number;
        openCount: number;
        overdueCount: number;
    };
    accountsPayable: {
        openAmountCents: number;
        settledAmountCents: number;
        openCount: number;
        overdueCount: number;
    };
    dreStructure: {
        sections: FinancialDreSectionRecord[];
    };
    entries: FinancialEntryRecord[];
};

export type FinancialOverviewData = Omit<FinancialOverviewApiResponse, "dre"> & {
    dre: {
        vehicleSalesRevenueCents: number;
        otherRevenueCents: number;
        grossRevenueCents: number;
        taxExpensesCents: number;
        operatingExpensesCents: number;
        netResultCents: number;
        netRevenueCents: number;
        costOfSalesCents: number;
        grossProfitCents: number;
        salesExpensesCents: number;
        administrativeExpensesCents: number;
        financialRevenueCents: number;
        financialExpenseCents: number;
        otherOperatingRevenueCents: number;
        otherOperatingExpenseCents: number;
        operatingResultCents: number;
    };
};

export type SaveFinancialEntryPayload = {
    description: string;
    type: FinancialEntryType;
    dreSubcategoryId: string | null;
    amountCents: number;
    dueDate: string | null;
    counterparty: string | null;
    notes: string | null;
    settled: boolean;
};

export type SaveDreSubcategoryPayload = {
    sectionCode: FinancialDreSectionCode;
    name: string;
    entryType?: FinancialEntryType;
};
