package com.io.appioweb.adapters.web.onboarding.dto;

import jakarta.validation.constraints.NotBlank;

public record FirstUserActivateRequest(
        @NotBlank(message = "idempotencyKey é obrigatório.")
        String idempotencyKey,

        String paymentId,
        String subscriptionId,

        @NotBlank(message = "paymentStatus é obrigatório.")
        String paymentStatus,

        Number valorPagoCliente,
        String recorrenciaPagamento,
        String dataAssinatura,
        String origem,
        String planName
) {}
