package com.io.appioweb.adapters.web.ioauto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SaleClosingFinancialHttpRequest(
        BigDecimal discountPercentage,
        Boolean hasTradeInVehicle,
        UUID tradeInVehicleId,
        String tradeInVehicleDescription,
        Long tradeInAmountCents,
        Boolean installmentSale,
        Integer installmentCount,
        LocalDate firstInstallmentDueDate
) {
}
