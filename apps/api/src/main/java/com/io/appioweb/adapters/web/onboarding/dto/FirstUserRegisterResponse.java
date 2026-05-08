package com.io.appioweb.adapters.web.onboarding.dto;

import java.util.UUID;

public record FirstUserRegisterResponse(
        UUID companyId,
        UUID userId,
        boolean created,
        String status
) {}
