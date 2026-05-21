package com.io.appioweb.adapters.web.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;

public record CreateCompanyHttpRequest(
        @NotBlank String companyName,
        String profileImageUrl,
        @Email @NotBlank String companyEmail,
        @NotNull LocalDate contractEndDate,
        @NotBlank String cnpj,
        @NotNull LocalDate openedAt,
        @NotBlank String whatsappNumber,
        @NotBlank(message = "Informe a senha inicial da conta.")
        @Size(min = 8, message = "A senha deve conter no minimo 8 caracteres.")
        String password,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Horario inicial invalido (HH:mm)")
        @NotBlank String businessHoursStart,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Horario final invalido (HH:mm)")
        @NotBlank String businessHoursEnd,
        @NotNull JsonNode businessHoursWeekly
) {}
