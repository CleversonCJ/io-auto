package com.io.appioweb.adapters.web.onboarding.dto;

import jakarta.validation.constraints.NotBlank;

public record SendAccessEmailRequest(
        @NotBlank(message = "idempotencyKey é obrigatório.")
        String idempotencyKey,

        String userId,
        String companyId,

        @NotBlank(message = "E-mail é obrigatório.")
        String email,

        String nome,
        String loginUrl,
        String temporaryPassword,
        String setPasswordTokenUrl
) {}
