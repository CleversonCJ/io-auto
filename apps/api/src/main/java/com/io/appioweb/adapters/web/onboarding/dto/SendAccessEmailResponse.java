package com.io.appioweb.adapters.web.onboarding.dto;

public record SendAccessEmailResponse(
        boolean emailSent,
        String providerMessageId
) {}
