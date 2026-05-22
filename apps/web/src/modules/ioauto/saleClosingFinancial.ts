export type SaleClosingFinancialFormState = {
    discountPercentage: string;
    hasTradeInVehicle: boolean;
    tradeInVehicleDescription: string;
    tradeInAmountDigits: string;
    installmentSale: boolean;
    installmentCount: string;
    firstInstallmentDueDate: string;
};

export type SaleInstallmentPreview = {
    installmentNumber: number;
    totalInstallments: number;
    amountCents: number;
    dueDate: string;
};

export type SaleClosingFinancialPreview = {
    originalAmountCents: number;
    discountPercentage: number;
    discountAmountCents: number;
    amountAfterDiscountCents: number;
    tradeInAmountCents: number;
    totalRealAmountCents: number;
    installmentSale: boolean;
    installmentCount: number;
    installments: SaleInstallmentPreview[];
};

export type SaleClosingFinancialPayload = {
    discountPercentage: number;
    hasTradeInVehicle: boolean;
    tradeInVehicleId: string | null;
    tradeInVehicleDescription: string | null;
    tradeInAmountCents: number;
    installmentSale: boolean;
    installmentCount: number | null;
    firstInstallmentDueDate: string | null;
};

export function createDefaultSaleClosingFinancialState(): SaleClosingFinancialFormState {
    return {
        discountPercentage: "0",
        hasTradeInVehicle: false,
        tradeInVehicleDescription: "",
        tradeInAmountDigits: "",
        installmentSale: false,
        installmentCount: "2",
        firstInstallmentDueDate: "",
    };
}

export function normalizeCurrencyDigits(value: string) {
    return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatCurrencyDigits(value: string) {
    if (!value) return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(value) / 100);
}

export function computeSaleClosingFinancialPreview(
    originalAmountCents: number | null | undefined,
    state: SaleClosingFinancialFormState
): SaleClosingFinancialPreview {
    const original = normalizeNonNegativeInt(originalAmountCents ?? 0);
    const discountPercentage = normalizePercentage(state.discountPercentage);
    const discountAmountCents = Math.round(original * (discountPercentage / 100));
    const amountAfterDiscountCents = Math.max(0, original - discountAmountCents);
    const tradeInAmountCents = state.hasTradeInVehicle ? normalizeNonNegativeInt(Number(state.tradeInAmountDigits || "0")) : 0;
    const totalRealAmountCents = Math.max(0, amountAfterDiscountCents - tradeInAmountCents);
    const installmentSale = state.installmentSale;
    const installmentCount = installmentSale ? normalizeNonNegativeInt(Number(state.installmentCount || "0")) : 1;
    const firstDueDate = normalizeDate(state.firstInstallmentDueDate) ?? formatDateOnly(new Date());
    const installments = buildInstallments(totalRealAmountCents, installmentCount > 0 ? installmentCount : 1, firstDueDate);

    return {
        originalAmountCents: original,
        discountPercentage,
        discountAmountCents,
        amountAfterDiscountCents,
        tradeInAmountCents,
        totalRealAmountCents,
        installmentSale,
        installmentCount,
        installments,
    };
}

export function validateSaleClosingFinancialState(
    state: SaleClosingFinancialFormState,
    preview: SaleClosingFinancialPreview
): string | null {
    if (preview.discountPercentage < 0) {
        return "O percentual de desconto nao pode ser negativo.";
    }
    if (preview.discountPercentage > 100) {
        return "O percentual de desconto nao pode ser maior que 100%.";
    }
    if (preview.originalAmountCents <= 0) {
        return "Informe o valor do veiculo antes de fechar a venda.";
    }
    if (state.hasTradeInVehicle && !state.tradeInVehicleDescription.trim()) {
        return "Informe o veiculo recebido na troca.";
    }
    if (state.hasTradeInVehicle && preview.tradeInAmountCents <= 0) {
        return "Informe o valor do veiculo recebido na troca.";
    }
    if (state.hasTradeInVehicle && preview.tradeInAmountCents > preview.amountAfterDiscountCents) {
        return "O valor do veiculo dado em troca nao pode ser maior que o valor da venda.";
    }
    if (state.installmentSale && !state.installmentCount.trim()) {
        return "Informe a quantidade de parcelas.";
    }
    if (state.installmentSale && preview.installmentCount <= 1) {
        return "A quantidade de parcelas deve ser maior que 1.";
    }
    return null;
}

export function buildSaleClosingFinancialPayload(
    state: SaleClosingFinancialFormState,
    preview: SaleClosingFinancialPreview
): SaleClosingFinancialPayload {
    return {
        discountPercentage: preview.discountPercentage,
        hasTradeInVehicle: state.hasTradeInVehicle,
        tradeInVehicleId: null,
        tradeInVehicleDescription: state.hasTradeInVehicle ? nullableText(state.tradeInVehicleDescription) : null,
        tradeInAmountCents: state.hasTradeInVehicle ? preview.tradeInAmountCents : 0,
        installmentSale: state.installmentSale,
        installmentCount: state.installmentSale ? preview.installmentCount : null,
        firstInstallmentDueDate: nullableText(state.firstInstallmentDueDate),
    };
}

function normalizePercentage(value: string) {
    const normalized = Number(String(value).replace(",", ".").trim());
    if (!Number.isFinite(normalized)) return 0;
    return Math.round(normalized * 10000) / 10000;
}

function normalizeNonNegativeInt(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
    return Math.max(0, Math.trunc(value));
}

function nullableText(value: string) {
    const normalized = value.trim();
    return normalized ? normalized : null;
}

function normalizeDate(value: string) {
    const normalized = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function formatDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addMonths(dateOnly: string, months: number) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    const safeYear = year ?? 1970;
    const safeMonth = month ?? 1;
    const safeDay = day ?? 1;
    const base = new Date(safeYear, safeMonth - 1, safeDay, 12, 0, 0, 0);
    base.setMonth(base.getMonth() + months);
    return formatDateOnly(base);
}

function buildInstallments(totalAmountCents: number, installmentCount: number, firstDueDate: string) {
    const safeCount = Math.max(1, installmentCount);
    const baseAmount = Math.floor(totalAmountCents / safeCount);
    const remainder = totalAmountCents % safeCount;
    const installments: SaleInstallmentPreview[] = [];

    for (let index = 0; index < safeCount; index++) {
        const amountCents = index === safeCount - 1 ? baseAmount + remainder : baseAmount;
        installments.push({
            installmentNumber: index + 1,
            totalInstallments: safeCount,
            amountCents,
            dueDate: addMonths(firstDueDate, index),
        });
    }

    return installments;
}
