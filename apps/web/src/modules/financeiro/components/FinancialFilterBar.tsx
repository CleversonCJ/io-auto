"use client";

import { X } from "lucide-react";
import { useFinancialData } from "@/modules/financeiro/contexts/FinancialContext";

const MONTHS = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
];

export function FinancialFilterBar({ children }: { children?: React.ReactNode }) {
    const { filters, setFilters, clearFilters } = useFinancialData();

    // Gera lista de anos dinamicamente (ex: 5 anos pra trás, 2 anos pra frente)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 8 }, (_, i) => (currentYear - 5 + i).toString());

    return (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
                <span className="pl-2 text-sm font-semibold text-black/60">Filtrar por:</span>

                <select
                    value={filters.year}
                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm text-io-dark outline-none transition focus:border-black/20"
                >
                    <option value="">Todos os anos</option>
                    {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>

                <select
                    value={filters.month}
                    onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm text-io-dark outline-none transition focus:border-black/20"
                >
                    <option value="">Todos os meses</option>
                    {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                </select>
            </div>

            {(filters.year || filters.month) && (
                <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                    <X className="h-4 w-4" />
                    Limpar filtros
                </button>
            )}

            {children && (
                <div className="ml-auto">
                    {children}
                </div>
            )}
        </div>
    );
}
