package com.io.appioweb.domain.auth.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record Company(
        UUID id,
        String name,
        String profileImageUrl,
        String email,
        LocalDate contractEndDate,
        String cnpj,
        LocalDate openedAt,
        String whatsappNumber,
        String businessHoursStart,
        String businessHoursEnd,
        String businessHoursWeeklyJson,
        String publicStockBannerMode,
        String publicStockBannerImagesJson,
        Instant createdAt
) {}
