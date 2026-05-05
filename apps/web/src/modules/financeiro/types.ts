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
};

export type FinancialOverviewResponse = {
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
    entries: FinancialEntryRecord[];
};

export type SaveFinancialEntryPayload = {
    description: string;
    type: FinancialEntryType;
    category: FinancialEntryCategory;
    amountCents: number;
    dueDate: string | null;
    counterparty: string | null;
    notes: string | null;
    settled: boolean;
};
