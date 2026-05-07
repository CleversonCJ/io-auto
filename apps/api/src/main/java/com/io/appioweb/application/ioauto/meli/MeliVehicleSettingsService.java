package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class MeliVehicleSettingsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final MeliAdService adService;

    public MeliVehicleSettingsService(IoAutoVehicleRepositoryJpa vehicles, MeliAdService adService) {
        this.vehicles = vehicles;
        this.adService = adService;
    }

    @Transactional(readOnly = true)
    public VehicleMeliSettingsSnapshot getSettings(UUID companyId, UUID vehicleId) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        return toSnapshot(companyId, vehicle);
    }

    @Transactional
    public VehicleMeliSettingsSnapshot saveSettings(UUID companyId, UUID vehicleId, SaveVehicleMeliSettingsRequest request) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        vehicle.setMeliCategoryId(nullable(request.categoryId()));
        vehicle.setMeliListingTypeId(nullable(request.listingTypeId()));
        vehicle.setMeliCondition(normalizeCondition(request.condition(), vehicle.getMileage()));
        vehicle.setMeliSellerSku(firstNonBlank(nullable(request.sellerSku()), defaultSku(vehicle.getId())));
        vehicle.setMeliTitle(nullable(request.title()));
        vehicle.setMeliDescription(nullable(request.description()));
        vehicle.setMeliPriceCents(request.priceCents());
        vehicle.setMeliAttributesJson(writeAttributes(request.attributes()));
        vehicle.setUpdatedAt(Instant.now());
        vehicles.save(vehicle);
        return toSnapshot(companyId, vehicle);
    }

    private VehicleMeliSettingsSnapshot toSnapshot(UUID companyId, JpaIoAutoVehicleEntity vehicle) {
        return new VehicleMeliSettingsSnapshot(
                vehicle.getId(),
                nullable(vehicle.getMeliCategoryId()),
                nullable(vehicle.getMeliListingTypeId()),
                normalizeCondition(vehicle.getMeliCondition(), vehicle.getMileage()),
                firstNonBlank(nullable(vehicle.getMeliSellerSku()), defaultSku(vehicle.getId())),
                nullable(vehicle.getMeliTitle()),
                nullable(vehicle.getMeliDescription()),
                vehicle.getMeliPriceCents(),
                readAttributes(vehicle.getMeliAttributesJson()),
                adService.getVehicleAd(companyId, vehicle.getId())
        );
    }

    private JpaIoAutoVehicleEntity requireVehicle(UUID companyId, UUID vehicleId) {
        return vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
    }

    private String writeAttributes(List<MeliVehicleAttributeValue> values) {
        try {
            List<MeliVehicleAttributeValue> normalized = new ArrayList<>();
            LinkedHashSet<String> seen = new LinkedHashSet<>();
            for (MeliVehicleAttributeValue item : values == null ? List.<MeliVehicleAttributeValue>of() : values) {
                String id = nullable(item.id());
                String valueId = nullable(item.valueId());
                String valueName = nullable(item.valueName());
                if (id == null || (valueId == null && valueName == null)) {
                    continue;
                }
                if (seen.add(id)) {
                    normalized.add(new MeliVehicleAttributeValue(id, valueId, valueName));
                }
            }
            return OBJECT_MAPPER.writeValueAsString(normalized);
        } catch (Exception exception) {
            throw new BusinessException("MELI_MAPPING_INVALID", "Nao foi possivel salvar os atributos do Mercado Livre.");
        }
    }

    private List<MeliVehicleAttributeValue> readAttributes(String raw) {
        try {
            String source = raw == null ? "" : raw.trim();
            if (source.isBlank()) {
                return List.of();
            }
            return OBJECT_MAPPER.readValue(source, new TypeReference<List<MeliVehicleAttributeValue>>() {
            });
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String defaultSku(UUID vehicleId) {
        return "VEHICLE-" + vehicleId;
    }

    private String normalizeCondition(String value, Integer mileage) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if ("new".equals(normalized) || "used".equals(normalized)) {
            return normalized;
        }
        return mileage != null && mileage == 0 ? "new" : "used";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record SaveVehicleMeliSettingsRequest(
            String categoryId,
            String listingTypeId,
            String condition,
            String sellerSku,
            String title,
            String description,
            Long priceCents,
            List<MeliVehicleAttributeValue> attributes
    ) {
    }

    public record VehicleMeliSettingsSnapshot(
            UUID vehicleId,
            String categoryId,
            String listingTypeId,
            String condition,
            String sellerSku,
            String title,
            String description,
            Long priceCents,
            List<MeliVehicleAttributeValue> attributes,
            MeliAdService.MeliAdSnapshot ad
    ) {
    }
}
