"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
    FinancialDreSectionCode,
    FinancialEntryRecord,
    FinancialEntryStatus,
    FinancialEntryType,
    FinancialOverviewApiResponse,
    FinancialOverviewData,
    SaveDreSubcategoryPayload,
    SaveFinancialEntryPayload,
} from "@/modules/financeiro/types";

type FinancialFilters = {
    year: string;
    month: string;
};

type FinancialContextData = {
    data: FinancialOverviewData | null;
    loading: boolean;
    error: string | null;
    refreshIndex: number;
    refreshData: () => void;
    saveEntry: (id: string | null, payload: SaveFinancialEntryPayload) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    saveDreSubcategory: (id: string | null, payload: SaveDreSubcategoryPayload) => Promise<void>;
    deleteDreSubcategory: (id: string) => Promise<void>;
    filters: FinancialFilters;
    setFilters: (filters: FinancialFilters) => void;
    clearFilters: () => void;
};

const FinancialContext = createContext<FinancialContextData>({} as FinancialContextData);

function resolveStatus(entry: FinancialEntryRecord): FinancialEntryStatus {
    if (entry.settledAt) return "SETTLED";
    if (entry.dueDate) {
        const due = new Date(`${entry.dueDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (due < today) return "OVERDUE";
    }
    return "OPEN";
}

function sumEntries(entries: FinancialEntryRecord[], predicate: (entry: FinancialEntryRecord) => boolean) {
    return entries.reduce((total, entry) => total + (predicate(entry) ? entry.amountCents : 0), 0);
}

function sumSection(entries: FinancialEntryRecord[], sectionCode: FinancialDreSectionCode, entryType?: FinancialEntryType) {
    return sumEntries(entries, (entry) => entry.dreSectionCode === sectionCode && (!entryType || entry.type === entryType));
}

function buildAccountSummary(entries: FinancialEntryRecord[], type: FinancialEntryType) {
    return {
        openAmountCents: sumEntries(entries, (entry) => entry.type === type && resolveStatus(entry) !== "SETTLED"),
        settledAmountCents: sumEntries(entries, (entry) => entry.type === type && resolveStatus(entry) === "SETTLED"),
        openCount: entries.filter((entry) => entry.type === type && resolveStatus(entry) === "OPEN").length,
        overdueCount: entries.filter((entry) => entry.type === type && resolveStatus(entry) === "OVERDUE").length,
    };
}

export function FinancialProvider({ children }: { children: ReactNode }) {
    const [rawData, setRawData] = useState<FinancialOverviewApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshIndex, setRefreshIndex] = useState(0);

    const [filters, setFilters] = useState<FinancialFilters>({ year: "", month: "" });

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);

        fetch("/api/ioauto/financial/overview", {
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ message: "Falha ao carregar o financeiro." }));
                    throw new Error(payload.message ?? "Falha ao carregar o financeiro.");
                }
                return response.json();
            })
            .then((payload: FinancialOverviewApiResponse) => {
                setRawData(payload);
                setError(null);
            })
            .catch((cause: Error) => {
                if (cause.name === "AbortError") return;
                setError(cause.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [refreshIndex]);

    const data = useMemo<FinancialOverviewData | null>(() => {
        if (!rawData) return null;

        let filteredEntries = rawData.entries;
        if (filters.year || filters.month) {
            filteredEntries = filteredEntries.filter((entry) => {
                const targetDate = entry.dueDate || entry.createdAt;
                if (!targetDate) return true;

                const entryYear = targetDate.substring(0, 4);
                const entryMonth = targetDate.substring(5, 7);

                if (filters.year && entryYear !== filters.year) return false;
                if (filters.month && entryMonth !== filters.month) return false;
                return true;
            });
        }

        const receivableOpenAmount = sumEntries(filteredEntries, (entry) => entry.type === "RECEIVABLE" && resolveStatus(entry) !== "SETTLED");
        const payableOpenAmount = sumEntries(filteredEntries, (entry) => entry.type === "PAYABLE" && resolveStatus(entry) !== "SETTLED");

        const grossRevenueCents = sumSection(filteredEntries, "GROSS_REVENUE");
        const grossRevenueDeductionsCents = sumSection(filteredEntries, "GROSS_REVENUE_DEDUCTIONS");
        const costOfSalesCents = sumSection(filteredEntries, "COST_OF_SALES");
        const salesExpensesCents = sumSection(filteredEntries, "SALES_EXPENSES");
        const administrativeExpensesCents = sumSection(filteredEntries, "ADMINISTRATIVE_EXPENSES");
        const financialRevenueCents = sumSection(filteredEntries, "FINANCIAL_REVENUES");
        const financialExpenseCents = sumSection(filteredEntries, "FINANCIAL_EXPENSES");
        const otherOperatingRevenueCents = sumSection(filteredEntries, "OTHER_OPERATING_RESULTS", "RECEIVABLE");
        const otherOperatingExpenseCents = sumSection(filteredEntries, "OTHER_OPERATING_RESULTS", "PAYABLE");

        const netRevenueCents = grossRevenueCents - grossRevenueDeductionsCents;
        const grossProfitCents = netRevenueCents - costOfSalesCents;
        const operatingExpensesCents = salesExpensesCents + administrativeExpensesCents + otherOperatingExpenseCents;
        const operatingResultCents = grossProfitCents + otherOperatingRevenueCents - operatingExpensesCents;
        const netResultCents = operatingResultCents + financialRevenueCents - financialExpenseCents;

        const vehicleSalesRevenueCents = sumEntries(filteredEntries, (entry) => entry.source === "VEHICLE_SALE");
        const otherRevenueCents = (grossRevenueCents - vehicleSalesRevenueCents) + financialRevenueCents + otherOperatingRevenueCents;

        return {
            cashFlow: {
                entryCents: receivableOpenAmount,
                exitCents: payableOpenAmount,
                balanceCents: receivableOpenAmount - payableOpenAmount,
            },
            dre: {
                vehicleSalesRevenueCents,
                otherRevenueCents,
                grossRevenueCents,
                taxExpensesCents: grossRevenueDeductionsCents,
                operatingExpensesCents,
                netResultCents,
                netRevenueCents,
                costOfSalesCents,
                grossProfitCents,
                salesExpensesCents,
                administrativeExpensesCents,
                financialRevenueCents,
                financialExpenseCents,
                otherOperatingRevenueCents,
                otherOperatingExpenseCents,
                operatingResultCents,
            },
            inventoryValueCents: rawData.inventoryValueCents,
            accountsReceivable: buildAccountSummary(filteredEntries, "RECEIVABLE"),
            accountsPayable: buildAccountSummary(filteredEntries, "PAYABLE"),
            dreStructure: rawData.dreStructure,
            entries: filteredEntries,
        };
    }, [filters, rawData]);

    const refreshData = () => {
        setRefreshIndex((current) => current + 1);
    };

    const saveEntry = async (id: string | null, payload: SaveFinancialEntryPayload) => {
        const response = await fetch(id ? `/api/ioauto/financial/entries/${id}` : "/api/ioauto/financial/entries", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Nao foi possivel salvar o lancamento." }));
            throw new Error(result.message ?? "Nao foi possivel salvar o lancamento.");
        }

        refreshData();
    };

    const deleteEntry = async (id: string) => {
        const response = await fetch(`/api/ioauto/financial/entries/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Nao foi possivel excluir o lancamento." }));
            throw new Error(result.message ?? "Nao foi possivel excluir o lancamento.");
        }

        refreshData();
    };

    const saveDreSubcategory = async (id: string | null, payload: SaveDreSubcategoryPayload) => {
        const response = await fetch(id ? `/api/ioauto/financial/dre/subcategories/${id}` : "/api/ioauto/financial/dre/subcategories", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Nao foi possivel salvar a subcategoria do DRE." }));
            throw new Error(result.message ?? "Nao foi possivel salvar a subcategoria do DRE.");
        }

        refreshData();
    };

    const deleteDreSubcategory = async (id: string) => {
        const response = await fetch(`/api/ioauto/financial/dre/subcategories/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Nao foi possivel excluir a subcategoria do DRE." }));
            throw new Error(result.message ?? "Nao foi possivel excluir a subcategoria do DRE.");
        }

        refreshData();
    };

    const clearFilters = () => setFilters({ year: "", month: "" });

    return (
        <FinancialContext.Provider
            value={{
                data,
                loading,
                error,
                refreshIndex,
                refreshData,
                saveEntry,
                deleteEntry,
                saveDreSubcategory,
                deleteDreSubcategory,
                filters,
                setFilters,
                clearFilters,
            }}
        >
            {children}
        </FinancialContext.Provider>
    );
}

export function useFinancialData() {
    return useContext(FinancialContext);
}
