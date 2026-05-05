package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAdEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class OlxPublicationStatusService {

    private final IoAutoVehiclePublicationRepositoryJpa publications;

    public OlxPublicationStatusService(IoAutoVehiclePublicationRepositoryJpa publications) {
        this.publications = publications;
    }

    public JpaIoAutoVehiclePublicationEntity sync(JpaOlxAdEntity ad) {
        Instant now = Instant.now();
        JpaIoAutoVehiclePublicationEntity publication = publications.findByCompanyIdAndVehicleIdAndProviderKey(
                        ad.getCompanyId(),
                        ad.getVehicleId(),
                        OlxAccountService.PROVIDER_KEY
                )
                .orElseGet(JpaIoAutoVehiclePublicationEntity::new);

        if (publication.getId() == null) {
            publication.setId(UUID.randomUUID());
            publication.setCompanyId(ad.getCompanyId());
            publication.setVehicleId(ad.getVehicleId());
            publication.setProviderKey(OlxAccountService.PROVIDER_KEY);
            publication.setCreatedAt(now);
        }

        publication.setProviderListingId(nullable(ad.getOlxListId()));
        publication.setExternalUrl(nullable(ad.getOlxUrl()));
        publication.setStatus(mapStatus(ad.getStatus()));
        publication.setLastError(isErrorStatus(ad.getStatus()) ? nullable(ad.getLastStatusMessage()) : null);
        publication.setPublishedAt(ad.getPublishedAt());
        publication.setSyncedAt(now);
        publication.setUpdatedAt(now);
        return publications.save(publication);
    }

    private String mapStatus(String olxStatus) {
        String normalized = safe(olxStatus).toUpperCase();
        return switch (normalized) {
            case "IMPORT_PENDING", "QUEUED", "PENDING_REVIEW", "DELETE_PENDING" -> "SYNC_IN_PROGRESS";
            case "ACCEPTED", "PUBLISHED" -> "PUBLISHED";
            case "DELETED" -> "REMOVED";
            case "REFUSED", "ERROR" -> "ERROR";
            default -> normalized.isBlank() ? "READY_TO_SYNC" : normalized;
        };
    }

    private boolean isErrorStatus(String value) {
        String normalized = safe(value).toUpperCase();
        return "REFUSED".equals(normalized) || "ERROR".equals(normalized);
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
