package com.io.appioweb.application.ioauto.webmotors.modules.publication;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class WmPublicationStatusService {

    public static final String PROVIDER_KEY = "webmotors";

    private final IoAutoVehiclePublicationRepositoryJpa publicationRepository;

    public WmPublicationStatusService(IoAutoVehiclePublicationRepositoryJpa publicationRepository) {
        this.publicationRepository = publicationRepository;
    }

    public JpaIoAutoVehiclePublicationEntity markQueued(UUID companyId, UUID vehicleId) {
        return upsert(companyId, vehicleId, "SYNC_QUEUED", null, null, null);
    }

    public JpaIoAutoVehiclePublicationEntity markInProgress(UUID companyId, UUID vehicleId) {
        return upsert(companyId, vehicleId, "SYNC_IN_PROGRESS", null, null, null);
    }

    public JpaIoAutoVehiclePublicationEntity markPublished(UUID companyId, UUID vehicleId, String remoteAdCode, Instant publishedAt) {
        return upsert(companyId, vehicleId, "PUBLISHED", remoteAdCode, null, publishedAt);
    }

    public JpaIoAutoVehiclePublicationEntity markRemoved(UUID companyId, UUID vehicleId, String remoteAdCode, Instant publishedAt) {
        return upsert(companyId, vehicleId, "REMOVED", remoteAdCode, null, publishedAt);
    }

    public JpaIoAutoVehiclePublicationEntity markError(UUID companyId, UUID vehicleId, String lastError) {
        return upsert(companyId, vehicleId, "ERROR", null, lastError, null);
    }

    public java.util.Optional<JpaIoAutoVehiclePublicationEntity> findByRemoteListingId(UUID companyId, String remoteAdCode) {
        return publicationRepository.findByCompanyIdAndProviderKeyAndProviderListingId(companyId, PROVIDER_KEY, remoteAdCode);
    }

    private JpaIoAutoVehiclePublicationEntity upsert(
            UUID companyId,
            UUID vehicleId,
            String status,
            String remoteAdCode,
            String lastError,
            Instant publishedAt
    ) {
        Instant now = Instant.now();
        JpaIoAutoVehiclePublicationEntity publication = publicationRepository.findByCompanyIdAndVehicleIdAndProviderKey(companyId, vehicleId, PROVIDER_KEY)
                .orElseGet(JpaIoAutoVehiclePublicationEntity::new);
        if (publication.getId() == null) {
            publication.setId(UUID.randomUUID());
            publication.setCompanyId(companyId);
            publication.setVehicleId(vehicleId);
            publication.setProviderKey(PROVIDER_KEY);
            publication.setCreatedAt(now);
        }
        publication.setStatus(status);
        if (safe(remoteAdCode).isBlank() == false) {
            publication.setProviderListingId(remoteAdCode);
        }
        publication.setLastError(nullable(lastError));
        if (publishedAt != null) {
            publication.setPublishedAt(publishedAt);
        }
        publication.setSyncedAt(now);
        publication.setUpdatedAt(now);
        return publicationRepository.save(publication);
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
