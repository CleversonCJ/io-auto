package com.io.appioweb.adapters.web.onboarding.dto;

import java.util.UUID;

public record FirstUserActivateResponse(
        boolean activated,
        boolean alreadyActive,
        UUID companyId,
        UUID userId,
        UUID subscriptionId
) {}
