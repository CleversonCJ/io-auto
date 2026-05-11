package com.io.appioweb.adapters.web.atendimentos.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record ConcludeConversationHttpRequest(
        @NotBlank @Size(max = 40) String classificationResult,
        @NotBlank @Size(max = 180) String classificationLabel,
        @Valid List<ConversationLabelHttpRequest> labels,
        Boolean saleCompleted,
        UUID soldVehicleId,
        @Size(max = 40) String saleOriginPlatform
) {
}
