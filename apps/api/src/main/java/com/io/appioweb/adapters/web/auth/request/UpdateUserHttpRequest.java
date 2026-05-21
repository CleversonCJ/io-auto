package com.io.appioweb.adapters.web.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

public record UpdateUserHttpRequest(
        @Email @NotBlank String email,
        @NotBlank String fullName,
        String profileImageUrl,
        String jobTitle,
        LocalDate birthDate,
        @Size(min = 8, message = "A senha deve conter no minimo 8 caracteres.")
        String password,
        String permissionPreset,
        Set<String> modulePermissions,
        @NotNull UUID teamId,
        @NotEmpty Set<String> roles
) {}
