package com.io.appioweb.application.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class VehicleAutoPublicationService {

    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final MeliAdService meliAdService;
    private final OlxAdService olxAdService;

    public VehicleAutoPublicationService(
            IoAutoVehiclePublicationRepositoryJpa publications,
            MeliAdService meliAdService,
            OlxAdService olxAdService
    ) {
        this.publications = publications;
        this.meliAdService = meliAdService;
        this.olxAdService = olxAdService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publishAfterCommit(UUID companyId, UUID vehicleId, String providerKey) {
        String normalizedProviderKey = safe(providerKey).toLowerCase(Locale.ROOT);
        try {
            if ("mercadolivre".equals(normalizedProviderKey)) {
                meliAdService.publishVehicle(companyId, vehicleId);
                return;
            }
            if ("olx".equals(normalizedProviderKey)) {
                olxAdService.publishVehicle(companyId, vehicleId);
            }
        } catch (Exception exception) {
            markPublicationError(companyId, vehicleId, normalizedProviderKey, exception.getMessage());
        }
    }

    private void markPublicationError(UUID companyId, UUID vehicleId, String providerKey, String message) {
        JpaIoAutoVehiclePublicationEntity publication = publications.findByCompanyIdAndVehicleIdAndProviderKey(companyId, vehicleId, providerKey)
                .orElseGet(JpaIoAutoVehiclePublicationEntity::new);

        Instant now = Instant.now();
        if (publication.getId() == null) {
            publication.setId(UUID.randomUUID());
            publication.setCompanyId(companyId);
            publication.setVehicleId(vehicleId);
            publication.setProviderKey(providerKey);
            publication.setCreatedAt(now);
        }
        publication.setStatus("ERROR");
        publication.setLastError(safe(message).isBlank() ? "Falha ao publicar automaticamente nesta integracao." : safe(message));
        publication.setUpdatedAt(now);
        publications.save(publication);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
