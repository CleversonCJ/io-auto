package com.io.appioweb.adapters.web.ioauto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CloseInventoryVehicleSaleHttpRequest(
        @NotNull(message = "Informe o vendedor responsável.") UUID sellerUserId,
        UUID buyerConversationId,
        String buyerName,
        String buyerPhone
) {
}
