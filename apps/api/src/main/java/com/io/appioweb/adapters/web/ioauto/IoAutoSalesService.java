package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsAdsService;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class IoAutoSalesService {

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final WebmotorsAdRepositoryJpa webmotorsAds;
    private final WebmotorsAdsService webmotorsAdsService;

    public IoAutoSalesService(
            IoAutoVehicleRepositoryJpa vehicles,
            IoAutoVehiclePublicationRepositoryJpa publications,
            AtendimentoSessionRepositoryJpa sessions,
            WebmotorsAdRepositoryJpa webmotorsAds,
            WebmotorsAdsService webmotorsAdsService
    ) {
        this.vehicles = vehicles;
        this.publications = publications;
        this.sessions = sessions;
        this.webmotorsAds = webmotorsAds;
        this.webmotorsAdsService = webmotorsAdsService;
    }

    @Transactional
    public SaleVehicleSnapshot registerCompletedSale(
            UUID companyId,
            JpaAtendimentoSessionEntity session,
            UUID soldVehicleId,
            Instant soldAt,
            String saleOriginPlatform
    ) {
        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(soldVehicleId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_SOLD_VEHICLE_NOT_FOUND", "Veículo não encontrado para concluir a venda."));

        vehicle.setStatus("SOLD");
        vehicle.setUpdatedAt(soldAt);
        vehicles.saveAndFlush(vehicle);

        List<JpaIoAutoVehiclePublicationEntity> vehiclePublications = publications.findAllByCompanyIdAndVehicleId(companyId, soldVehicleId);
        for (JpaIoAutoVehiclePublicationEntity publication : vehiclePublications) {
            publication.setStatus("SOLD");
            publication.setLastError(null);
            publication.setSyncedAt(soldAt);
            publication.setUpdatedAt(soldAt);
        }
        if (!vehiclePublications.isEmpty()) {
            publications.saveAllAndFlush(vehiclePublications);
        }

        for (JpaIoAutoVehiclePublicationEntity publication : vehiclePublications) {
            if (!"webmotors".equalsIgnoreCase(publication.getProviderKey())) {
                continue;
            }
            if ("REMOVED".equalsIgnoreCase(publication.getStatus())) {
                continue;
            }
            if (webmotorsAds.findByCompanyIdAndVehicleId(companyId, soldVehicleId).isEmpty()) {
                continue;
            }
            webmotorsAdsService.enqueueDelete(companyId, soldVehicleId, "default");
        }

        session.setSaleCompleted(true);
        session.setSoldVehicleId(vehicle.getId());
        session.setSoldVehicleTitle(vehicle.getTitle());
        session.setSaleCompletedAt(soldAt);
        session.setSaleOriginPlatform(normalizeSaleOriginPlatform(saleOriginPlatform));
        session.setUpdatedAt(soldAt);
        sessions.saveAndFlush(session);

        return new SaleVehicleSnapshot(vehicle.getId(), vehicle.getTitle(), normalizeStatus(vehicle.getStatus()));
    }

    private String normalizeStatus(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return normalized.isBlank() ? "SOLD" : normalized;
    }

    private String normalizeSaleOriginPlatform(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) return "MANUAL";
        return normalized;
    }

    public record SaleVehicleSnapshot(UUID vehicleId, String vehicleTitle, String vehicleStatus) {
    }
}
