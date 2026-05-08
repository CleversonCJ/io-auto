package com.io.appioweb.adapters.web.onboarding.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record FirstUserRegisterRequest(
        @NotBlank(message = "idempotencyKey é obrigatório.")
        String idempotencyKey,

        @NotNull(message = "firstUserRegistration é obrigatório.")
        @Valid
        FirstUserRegistration firstUserRegistration,

        @Valid
        Comercial comercial,

        @Valid
        Billing billing
) {
    public record FirstUserRegistration(
            String profileImageUrl,
            String razaoSocial,
            String nomeFantasia,
            String companyEmail,
            String password,
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
            String responsavelWhatsapp,
            String status
    ) {}

    public record Comercial(
            Number valorPagoCliente,
            String recorrenciaPagamento,
            String dataAssinatura,
            String origem
    ) {}

    public record Billing(
            String paymentId,
            String subscriptionId,
            String planName
    ) {}
}
