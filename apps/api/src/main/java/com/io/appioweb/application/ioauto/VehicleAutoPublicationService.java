package com.io.appioweb.application.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsAdsService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.Executor;

@Service
public class VehicleAutoPublicationService {

    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final MeliAdRepositoryJpa meliAds;
    private final OlxAdRepositoryJpa olxAds;
    private final WebmotorsAdRepositoryJpa webmotorsAds;
    private final MeliAdService meliAdService;
    private final OlxAdService olxAdService;
    private final WebmotorsAdsService webmotorsAdsService;
    private final Executor publicationExecutor;
    private final TransactionTemplate requiresNewTransaction;

    public VehicleAutoPublicationService(
            IoAutoVehiclePublicationRepositoryJpa publications,
            IoAutoVehicleRepositoryJpa vehicles,
            MeliAdRepositoryJpa meliAds,
            OlxAdRepositoryJpa olxAds,
            WebmotorsAdRepositoryJpa webmotorsAds,
            MeliAdService meliAdService,
            OlxAdService olxAdService,
            WebmotorsAdsService webmotorsAdsService,
            @Qualifier("vehiclePublicationExecutor") Executor publicationExecutor,
            PlatformTransactionManager transactionManager
    ) {
        this.publications = publications;
        this.vehicles = vehicles;
        this.meliAds = meliAds;
        this.olxAds = olxAds;
        this.webmotorsAds = webmotorsAds;
        this.meliAdService = meliAdService;
        this.olxAdService = olxAdService;
        this.webmotorsAdsService = webmotorsAdsService;
        this.publicationExecutor = publicationExecutor;
        this.requiresNewTransaction = new TransactionTemplate(transactionManager);
        this.requiresNewTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void enqueueSynchronize(UUID companyId, UUID vehicleId, List<String> providerKeys) {
        providerKeys.stream()
                .map(this::normalizeProviderKey)
                .filter(providerKey -> providerKey.isBlank() == false)
                .distinct()
                .forEach(providerKey -> enqueueProvider(companyId, vehicleId, providerKey));
    }

    public void enqueueRemoval(UUID companyId, UUID vehicleId, List<String> providerKeys) {
        providerKeys.stream()
                .map(this::normalizeProviderKey)
                .filter(providerKey -> providerKey.isBlank() == false)
                .distinct()
                .forEach(providerKey -> enqueueRemovalProvider(companyId, vehicleId, providerKey));
    }

    private void enqueueProvider(UUID companyId, UUID vehicleId, String providerKey) {
        try {
            publicationExecutor.execute(() -> synchronizeProvider(companyId, vehicleId, providerKey));
        } catch (Exception exception) {
            recordPublicationError(companyId, vehicleId, providerKey, exception.getMessage());
        }
    }

    private void enqueueRemovalProvider(UUID companyId, UUID vehicleId, String providerKey) {
        try {
            publicationExecutor.execute(() -> removeProvider(companyId, vehicleId, providerKey));
        } catch (Exception exception) {
            recordPublicationError(companyId, vehicleId, providerKey, exception.getMessage());
        }
    }

    private void synchronizeProvider(UUID companyId, UUID vehicleId, String providerKey) {
        String normalizedProviderKey = safe(providerKey).toLowerCase(Locale.ROOT);
        try {
            if (!vehicles.existsByIdAndCompanyIdAndStatusNotIgnoreCase(vehicleId, companyId, "REMOVED")) {
                return;
            }
            if ("mercadolivre".equals(normalizedProviderKey)) {
                boolean alreadyPublished = meliAds.findByCompanyIdAndVehicleId(companyId, vehicleId)
                        .map(ad -> safe(ad.getMeliItemId()).isBlank() == false)
                        .orElse(false);
                if (alreadyPublished) {
                    meliAdService.updateVehicleAd(companyId, vehicleId);
                } else {
                    meliAdService.publishVehicle(companyId, vehicleId);
                }
                return;
            }
            if ("olx".equals(normalizedProviderKey)) {
                if (olxAds.findByCompanyIdAndVehicleId(companyId, vehicleId).isPresent()) {
                    olxAdService.updateVehicleAd(companyId, vehicleId);
                } else {
                    olxAdService.publishVehicle(companyId, vehicleId);
                }
                return;
            }
            if ("webmotors".equals(normalizedProviderKey)) {
                webmotorsAdsService.enqueuePublish(companyId, vehicleId, "default");
            }
        } catch (Exception exception) {
            recordPublicationError(companyId, vehicleId, normalizedProviderKey, exception.getMessage());
        }
    }

    private void removeProvider(UUID companyId, UUID vehicleId, String providerKey) {
        String normalizedProviderKey = normalizeProviderKey(providerKey);
        try {
            if ("mercadolivre".equals(normalizedProviderKey)) {
                meliAds.findByCompanyIdAndVehicleId(companyId, vehicleId)
                        .filter(ad -> safe(ad.getMeliItemId()).isBlank() == false)
                        .filter(ad -> "closed".equalsIgnoreCase(safe(ad.getStatus())) == false)
                        .ifPresent(ad -> meliAdService.closeAd(companyId, vehicleId));
                return;
            }
            if ("olx".equals(normalizedProviderKey)) {
                olxAds.findByCompanyIdAndVehicleId(companyId, vehicleId)
                        .filter(ad -> "DELETED".equalsIgnoreCase(safe(ad.getStatus())) == false)
                        .ifPresent(ad -> olxAdService.unpublishVehicle(companyId, vehicleId));
                return;
            }
            if ("webmotors".equals(normalizedProviderKey)) {
                webmotorsAds.findByCompanyIdAndVehicleId(companyId, vehicleId)
                        .filter(ad -> safe(ad.getRemoteAdCode()).isBlank() == false)
                        .ifPresent(ad -> webmotorsAdsService.enqueueDelete(companyId, vehicleId, "default"));
            }
        } catch (Exception exception) {
            recordPublicationError(companyId, vehicleId, normalizedProviderKey, exception.getMessage());
        }
    }

    private String normalizeProviderKey(String providerKey) {
        String normalized = safe(providerKey).toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "meli", "mercado-livre", "mercado_livre" -> "mercadolivre";
            case "web-motors" -> "webmotors";
            default -> normalized;
        };
    }

    private void recordPublicationError(UUID companyId, UUID vehicleId, String providerKey, String message) {
        requiresNewTransaction.executeWithoutResult(status -> {
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
        });
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
