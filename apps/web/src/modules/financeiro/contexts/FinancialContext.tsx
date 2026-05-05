"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import type { FinancialOverviewResponse, SaveFinancialEntryPayload, FinancialEntryRecord, FinancialEntryStatus } from "@/modules/financeiro/types";

type FinancialFilters = {
    year: string;
    month: string;
};

type FinancialContextData = {
    data: FinancialOverviewResponse | null;
    loading: boolean;
    error: string | null;
    refreshIndex: number;
    refreshData: () => void;
    saveEntry: (id: string | null, payload: SaveFinancialEntryPayload) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
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

export function FinancialProvider({ children }: { children: ReactNode }) {
    const [rawData, setRawData] = useState<FinancialOverviewResponse | null>(null);
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
            .then((payload: FinancialOverviewResponse) => {
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

    const data = useMemo(() => {
        if (!rawData) return null;

        let filteredEntries = rawData.entries;

        if (filters.year || filters.month) {
            filteredEntries = filteredEntries.filter(entry => {
                const targetDate = entry.dueDate || entry.createdAt;
                if (!targetDate) return true;

                const entryYear = targetDate.substring(0, 4);
                const entryMonth = targetDate.substring(5, 7);

                if (filters.year && entryYear !== filters.year) return false;
                if (filters.month && entryMonth !== filters.month) return false;

                return true;
            });
        }

        const sumAmounts = (type: string, onlyOpen: boolean) => {
            return filteredEntries
                .filter(e => e.type === type && (!onlyOpen || resolveStatus(e) !== "SETTLED"))
                .reduce((acc, e) => acc + e.amountCents, 0);
        };

        const receivableOpenAmount = sumAmounts("RECEIVABLE", true);
        const payableOpenAmount = sumAmounts("PAYABLE", true);
        const grossRevenue = sumAmounts("RECEIVABLE", false);

        const vehicleSalesRevenue = filteredEntries
            .filter(e => e.type === "RECEIVABLE" && e.category === "VEHICLE_SALE")
            .reduce((acc, e) => acc + e.amountCents, 0);

        const otherRevenue = grossRevenue - vehicleSalesRevenue;

        const taxExpenses = filteredEntries
            .filter(e => e.type === "PAYABLE" && e.category === "TAXES")
            .reduce((acc, e) => acc + e.amountCents, 0);

        const operatingExpenses = filteredEntries
            .filter(e => e.type === "PAYABLE" && e.category !== "TAXES")
            .reduce((acc, e) => acc + e.amountCents, 0);

        const buildAccountSummary = (type: string) => {
            const openAmount = filteredEntries
                .filter(e => e.type === type && resolveStatus(e) !== "SETTLED")
                .reduce((acc, e) => acc + e.amountCents, 0);

            const settledAmount = filteredEntries
                .filter(e => e.type === type && resolveStatus(e) === "SETTLED")
                .reduce((acc, e) => acc + e.amountCents, 0);

            const openCount = filteredEntries.filter(e => e.type === type && resolveStatus(e) === "OPEN").length;
            const overdueCount = filteredEntries.filter(e => e.type === type && resolveStatus(e) === "OVERDUE").length;

            return { openAmountCents: openAmount, settledAmountCents: settledAmount, openCount, overdueCount };
        };

        return {
            cashFlow: {
                entryCents: receivableOpenAmount,
                exitCents: payableOpenAmount,
                balanceCents: receivableOpenAmount - payableOpenAmount
            },
            dre: {
                vehicleSalesRevenueCents: vehicleSalesRevenue,
                otherRevenueCents: otherRevenue,
                grossRevenueCents: grossRevenue,
                taxExpensesCents: taxExpenses,
                operatingExpensesCents: operatingExpenses,
                netResultCents: grossRevenue - taxExpenses - operatingExpenses
            },
            inventoryValueCents: rawData.inventoryValueCents,
            accountsReceivable: buildAccountSummary("RECEIVABLE"),
            accountsPayable: buildAccountSummary("PAYABLE"),
            entries: filteredEntries
        };
    }, [rawData, filters]);

    const refreshData = () => {
        setRefreshIndex((curr) => curr + 1);
    };

    const saveEntry = async (id: string | null, payload: SaveFinancialEntryPayload) => {
        const response = await fetch(id ? `/api/ioauto/financial/entries/${id}` : "/api/ioauto/financial/entries", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Não foi possível salvar o lançamento." }));
            throw new Error(result.message ?? "Não foi possível salvar o lançamento.");
        }

        refreshData();
    };

    const deleteEntry = async (id: string) => {
        const response = await fetch(`/api/ioauto/financial/entries/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: "Não foi possível excluir o lançamento." }));
            throw new Error(result.message ?? "Não foi possível excluir o lançamento.");
        }

        refreshData();
    };

    const clearFilters = () => setFilters({ year: "", month: "" });

    return (
        <FinancialContext.Provider value={{ data, loading, error, refreshIndex, refreshData, saveEntry, deleteEntry, filters, setFilters, clearFilters }}>
            {children}
        </FinancialContext.Provider>
    );
}

export function useFinancialData() {
    return useContext(FinancialContext);
}
