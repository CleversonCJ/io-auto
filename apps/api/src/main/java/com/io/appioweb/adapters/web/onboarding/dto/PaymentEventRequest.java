package com.io.appioweb.adapters.web.onboarding.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PaymentEventRequest(
        @NotBlank(message = "idempotencyKey é obrigatório.")
        String idempotencyKey,

        @NotBlank(message = "eventType é obrigatório.")
        String eventType,

        String paymentStatus,

        @NotNull(message = "customer é obrigatório.")
        @Valid
        Customer customer,

        @NotNull(message = "billing é obrigatório.")
        @Valid
        BillingInfo billing
) {
    public record Customer(
            String razaoSocial,
            String nomeFantasia,
            String companyEmail,
            String cnpj,
            String whatsappNumber,
            String endereco,
            String cidade,
            String uf,
            String cep,
            @NotBlank(message = "Nome do responsável é obrigatório.")
            String responsavelNome,
            @NotBlank(message = "E-mail do responsável é obrigatório.")
            String responsavelEmail,
            String responsavelWhatsapp
    ) {}

    public record BillingInfo(
            String paymentId,
            String subscriptionId,
            Number valorPagoCliente,
            String recorrenciaPagamento,
            String dataAssinatura,
            String origem,
            String planName
    ) {}
}
