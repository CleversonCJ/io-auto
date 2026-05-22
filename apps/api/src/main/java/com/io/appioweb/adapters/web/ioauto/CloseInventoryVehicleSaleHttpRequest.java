package com.io.appioweb.adapters.web.ioauto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CloseInventoryVehicleSaleHttpRequest(
        @NotNull(message = "Informe o vendedor responsavel.") UUID sellerUserId,
        UUID buyerConversationId,
        String buyerName,
        String buyerPhone,
        @Valid SaleClosingFinancialHttpRequest financial
) {
}
