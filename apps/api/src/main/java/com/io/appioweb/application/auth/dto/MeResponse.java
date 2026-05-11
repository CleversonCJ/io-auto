package com.io.appioweb.application.auth.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record MeResponse(
        UUID userId,
        UUID companyId,
        String companyName,
        String email,
        String fullName,
        String profileImageUrl,
        String permissionPreset,
        Set<String> modulePermissions,
        UUID teamId,
        String teamName,
        Instant createdAt,
        Set<String> roles,
        boolean impersonation,
        UUID actorSuperAdminId,
        UUID impersonatedTenantId
) {}
