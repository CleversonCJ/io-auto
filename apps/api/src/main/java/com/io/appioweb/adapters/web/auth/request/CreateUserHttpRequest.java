package com.io.appioweb.adapters.web.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

public record CreateUserHttpRequest(
        UUID companyId,
        @Email @NotBlank String email,
        @NotBlank String fullName,
        String profileImageUrl,
        @NotBlank String jobTitle,
        @NotNull LocalDate birthDate,
        @NotBlank(message = "Informe uma senha para o colaborador.")
        @Size(min = 8, message = "A senha deve conter no minimo 8 caracteres.")
        String password,
        @NotBlank String permissionPreset,
        Set<String> modulePermissions,
        @NotNull UUID teamId,
        @NotEmpty Set<String> roles
) {}
