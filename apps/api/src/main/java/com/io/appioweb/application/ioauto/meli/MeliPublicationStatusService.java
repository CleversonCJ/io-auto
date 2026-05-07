package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAdEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class MeliPublicationStatusService {

    private final IoAutoVehiclePublicationRepositoryJpa publications;

    public MeliPublicationStatusService(IoAutoVehiclePublicationRepositoryJpa publications) {
        this.publications = publications;
    }

    public JpaIoAutoVehiclePublicationEntity sync(JpaMeliAdEntity ad) {
        Instant now = Instant.now();
        JpaIoAutoVehiclePublicationEntity publication = publications.findByCompanyIdAndVehicleIdAndProviderKey(
                        ad.getCompanyId(),
                        ad.getVehicleId(),
                        MeliAccountService.PROVIDER_KEY
                )
                .orElseGet(JpaIoAutoVehiclePublicationEntity::new);

        if (publication.getId() == null) {
            publication.setId(UUID.randomUUID());
            publication.setCompanyId(ad.getCompanyId());
            publication.setVehicleId(ad.getVehicleId());
            publication.setProviderKey(MeliAccountService.PROVIDER_KEY);
            publication.setCreatedAt(now);
        }

        publication.setProviderListingId(nullable(ad.getMeliItemId()));
        publication.setExternalUrl(nullable(ad.getPermalink()));
        publication.setStatus(mapStatus(ad.getStatus()));
        publication.setLastError(isErrorStatus(ad.getStatus()) ? nullable(ad.getLastError()) : null);
        publication.setPublishedAt(ad.getPublishedAt());
        publication.setSyncedAt(now);
        publication.setUpdatedAt(now);
        return publications.save(publication);
    }

    private String mapStatus(String meliStatus) {
        String normalized = safe(meliStatus).toUpperCase();
        return switch (normalized) {
            case "ACTIVE" -> "PUBLISHED";
            case "PAUSED" -> "PAUSED";
            case "CLOSED" -> "REMOVED";
            case "UNDER_REVIEW", "PAYMENT_REQUIRED", "NOT_YET_ACTIVE", "INACTIVE" -> normalized;
            case "ERROR" -> "ERROR";
            default -> normalized.isBlank() ? "READY_TO_SYNC" : normalized;
        };
    }

    private boolean isErrorStatus(String value) {
        return "ERROR".equalsIgnoreCase(safe(value));
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
