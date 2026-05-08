package com.io.appioweb.adapters.web.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompletePasswordSetupHttpRequest(
        @NotBlank(message = "Token obrigatorio.")
        String token,

        @NotBlank(message = "Informe a nova senha.")
        @Size(min = 6, message = "A senha deve ter pelo menos 6 caracteres.")
        String password
) {
}
