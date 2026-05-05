package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxProperties;
import com.io.appioweb.adapters.integrations.olx.OlxWebhookParser;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.OlxAdRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class OlxWebhookService {

    private final OlxProperties properties;
    private final OlxWebhookParser parser;
    private final OlxAdRepositoryJpa ads;
    private final OlxPublicationStatusService publicationStatusService;

    public OlxWebhookService(
            OlxProperties properties,
            OlxWebhookParser parser,
            OlxAdRepositoryJpa ads,
            OlxPublicationStatusService publicationStatusService
    ) {
        this.properties = properties;
        this.parser = parser;
        this.ads = ads;
        this.publicationStatusService = publicationStatusService;
    }

    @Transactional
    public void handleAdStatus(String rawPayload, String providedToken) {
        properties.validateWebhookConfigured();
        validateToken(providedToken);
        OlxWebhookParser.WebhookPayload payload = parser.parse(rawPayload);
        if (safe(payload.localAdId()).isBlank()) {
            return;
        }
        List<JpaOlxAdEntity> targets = ads.findAllByLocalAdId(payload.localAdId());
        Instant now = Instant.now();
        for (JpaOlxAdEntity ad : targets) {
            if (!safe(payload.listId()).isBlank()) {
                ad.setOlxListId(payload.listId());
            }
            if (!safe(payload.viewUrl()).isBlank()) {
                ad.setOlxUrl(payload.viewUrl());
            }
            ad.setStatus(mapWebhookStatus(payload.status(), payload.operation()));
            ad.setLastStatusMessage(buildStatusMessage(payload.reasonTag(), payload.message()));
            if ("DELETED".equals(ad.getStatus())) {
                ad.setDeletedAt(now);
            } else if ("PUBLISHED".equals(ad.getStatus()) || "ACCEPTED".equals(ad.getStatus())) {
                if (ad.getPublishedAt() == null) {
                    ad.setPublishedAt(now);
                }
            }
            ad.setUpdatedAt(now);
            ads.save(ad);
            publicationStatusService.sync(ad);
        }
    }

    private void validateToken(String providedToken) {
        String expected = safe(properties.getWebhookToken());
        String normalized = safe(providedToken);
        if (expected.isBlank() || normalized.isBlank() || !expected.equals(normalized)) {
            throw new BusinessException("OLX_WEBHOOK_FORBIDDEN", "Token do webhook OLX invalido.");
        }
    }

    private String mapWebhookStatus(String status, String operation) {
        String normalizedStatus = safe(status).toLowerCase(Locale.ROOT);
        String normalizedOperation = safe(operation).toLowerCase(Locale.ROOT);
        if ("delete".equals(normalizedOperation)) {
            return switch (normalizedStatus) {
                case "queued", "pending" -> "DELETE_PENDING";
                case "accepted", "deleted", "removed", "inactive" -> "DELETED";
                case "refused", "rejected" -> "REFUSED";
                case "error" -> "ERROR";
                default -> normalizedStatus.isBlank() ? "DELETE_PENDING" : normalizedStatus.toUpperCase(Locale.ROOT);
            };
        }
        return switch (normalizedStatus) {
            case "queued" -> "QUEUED";
            case "pending", "created" -> "IMPORT_PENDING";
            case "accepted" -> "ACCEPTED";
            case "published", "active", "online" -> "PUBLISHED";
            case "pending_review", "under_review" -> "PENDING_REVIEW";
            case "refused", "rejected" -> "REFUSED";
            case "deleted", "removed", "inactive" -> "DELETED";
            case "error" -> "ERROR";
            default -> normalizedStatus.isBlank() ? "IMPORT_PENDING" : normalizedStatus.toUpperCase(Locale.ROOT);
        };
    }

    private String buildStatusMessage(String reasonTag, String message) {
        String normalizedReason = safe(reasonTag);
        String normalizedMessage = safe(message);
        if (normalizedReason.isBlank()) {
            return normalizedMessage.isBlank() ? null : normalizedMessage;
        }
        if (normalizedMessage.isBlank()) {
            return normalizedReason;
        }
        return normalizedReason + ": " + normalizedMessage;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
