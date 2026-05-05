package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class OlxVehicleSettingsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final OlxAdService adService;

    public OlxVehicleSettingsService(IoAutoVehicleRepositoryJpa vehicles, OlxAdService adService) {
        this.vehicles = vehicles;
        this.adService = adService;
    }

    @Transactional(readOnly = true)
    public VehicleOlxSettingsSnapshot getSettings(UUID companyId, UUID vehicleId) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        return toSnapshot(companyId, vehicle);
    }

    @Transactional
    public VehicleOlxSettingsSnapshot saveSettings(UUID companyId, UUID vehicleId, SaveVehicleOlxSettingsRequest request) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        vehicle.setPlate(normalizePlate(request.plate()));
        vehicle.setContactPhone(nullableDigits(request.phone()));
        vehicle.setZipcode(nullableZipcode(request.zipcode()));
        vehicle.setOlxBrandId(nullable(request.brandId()));
        vehicle.setOlxModelId(nullable(request.modelId()));
        vehicle.setOlxVersionId(nullable(request.versionId()));
        vehicle.setOlxFuelCode(nullable(request.fuelCode()));
        vehicle.setOlxGearboxCode(nullable(request.gearboxCode()));
        vehicle.setOlxDoorsCode(nullable(request.doorsCode()));
        vehicle.setOlxColorCode(nullable(request.colorCode()));
        vehicle.setOlxFeatureCodesJson(writeStringArray(request.featureCodes()));
        vehicle.setUpdatedAt(Instant.now());
        vehicles.save(vehicle);
        return toSnapshot(companyId, vehicle);
    }

    private VehicleOlxSettingsSnapshot toSnapshot(UUID companyId, JpaIoAutoVehicleEntity vehicle) {
        return new VehicleOlxSettingsSnapshot(
                vehicle.getId(),
                nullable(vehicle.getPlate()),
                nullable(vehicle.getContactPhone()),
                nullable(vehicle.getZipcode()),
                nullable(vehicle.getOlxBrandId()),
                nullable(vehicle.getOlxModelId()),
                nullable(vehicle.getOlxVersionId()),
                nullable(vehicle.getOlxFuelCode()),
                nullable(vehicle.getOlxGearboxCode()),
                nullable(vehicle.getOlxDoorsCode()),
                nullable(vehicle.getOlxColorCode()),
                readStringArray(vehicle.getOlxFeatureCodesJson()),
                adService.getVehicleAd(companyId, vehicle.getId())
        );
    }

    private JpaIoAutoVehicleEntity requireVehicle(UUID companyId, UUID vehicleId) {
        return vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
    }

    private String writeStringArray(List<String> values) {
        try {
            LinkedHashSet<String> unique = new LinkedHashSet<>();
            for (String item : values == null ? List.<String>of() : values) {
                String normalized = nullable(item);
                if (normalized != null) {
                    unique.add(normalized);
                }
            }
            return OBJECT_MAPPER.writeValueAsString(unique);
        } catch (Exception exception) {
            throw new BusinessException("OLX_MAPPING_INVALID", "Nao foi possivel salvar os opcionais da OLX.");
        }
    }

    private List<String> readStringArray(String raw) {
        try {
            String source = raw == null ? "" : raw.trim();
            if (source.isBlank()) {
                return List.of();
            }
            return OBJECT_MAPPER.readValue(source, new TypeReference<List<String>>() {});
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String nullableDigits(String value) {
        String digits = nullable(value == null ? "" : value.replaceAll("\\D", ""));
        if (digits == null) {
            return null;
        }
        if (digits.length() < 10 || digits.length() > 11) {
            throw new BusinessException("OLX_PHONE_INVALID", "Informe um telefone OLX valido com DDD.");
        }
        return digits;
    }

    private String nullableZipcode(String value) {
        String digits = nullable(value == null ? "" : value.replaceAll("\\D", ""));
        if (digits == null) {
            return null;
        }
        if (digits.length() != 8) {
            throw new BusinessException("OLX_ZIPCODE_INVALID", "Informe um CEP OLX valido com 8 digitos.");
        }
        return digits;
    }

    private String normalizePlate(String value) {
        String normalized = nullable(value == null ? "" : value.replaceAll("[^A-Za-z0-9]", ""));
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private String nullable(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isBlank() ? null : normalized;
    }

    public record SaveVehicleOlxSettingsRequest(
            String brandId,
            String modelId,
            String versionId,
            String fuelCode,
            String gearboxCode,
            String doorsCode,
            String colorCode,
            List<String> featureCodes,
            String plate,
            String phone,
            String zipcode
    ) {
    }

    public record VehicleOlxSettingsSnapshot(
            UUID vehicleId,
            String plate,
            String phone,
            String zipcode,
            String brandId,
            String modelId,
            String versionId,
            String fuelCode,
            String gearboxCode,
            String doorsCode,
            String colorCode,
            List<String> featureCodes,
            OlxAdService.OlxAdSnapshot ad
    ) {
    }
}
