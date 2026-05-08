package com.io.appioweb.application.ioauto;

import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class VehicleAutoPublicationService {

    private final MeliAdService meliAdService;
    private final OlxAdService olxAdService;

    public VehicleAutoPublicationService(MeliAdService meliAdService, OlxAdService olxAdService) {
        this.meliAdService = meliAdService;
        this.olxAdService = olxAdService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publish(UUID companyId, UUID vehicleId, String providerKey) {
        String normalizedProviderKey = safe(providerKey).toLowerCase(Locale.ROOT);
        if ("mercadolivre".equals(normalizedProviderKey)) {
            meliAdService.publishVehicle(companyId, vehicleId);
            return;
        }
        if ("olx".equals(normalizedProviderKey)) {
            olxAdService.publishVehicle(companyId, vehicleId);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
