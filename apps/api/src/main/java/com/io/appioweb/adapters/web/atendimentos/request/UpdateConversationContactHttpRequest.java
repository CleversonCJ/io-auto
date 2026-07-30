package com.io.appioweb.adapters.web.atendimentos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateConversationContactHttpRequest(
        @NotBlank @Size(max = 180) String displayName,
        @Size(max = 30) String displayPhone,
        @Size(max = 2000) String description
) {}
