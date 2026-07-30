package com.io.appioweb.adapters.web.atendimentos.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record ImportConversationEventsHttpRequest(
        @NotNull @Size(max = 200) List<@Valid EventItem> events
) {
    public record EventItem(
            @NotBlank @Size(max = 40) String type,
            @NotBlank @Size(max = 500) String text,
            @NotNull Instant at
    ) {}
}
