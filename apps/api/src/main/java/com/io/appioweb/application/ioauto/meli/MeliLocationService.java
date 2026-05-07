package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class MeliLocationService {

    private final MeliApiClient apiClient;

    public MeliLocationService(MeliApiClient apiClient) {
        this.apiClient = apiClient;
    }

    public LocationSnapshot resolveListingLocation(java.util.UUID companyId, JpaMeliAccountEntity account, JpaIoAutoVehicleEntity vehicle) {
        JsonNode root = apiClient.get("/users/" + account.getMeliUserId() + "/addresses", companyId).body();
        JsonNode selected = null;
        for (JsonNode item : root) {
            if (hasType(item.path("types"), "default_selling_address")) {
                selected = item;
                break;
            }
        }
        if (selected == null && root.isArray() && !root.isEmpty()) {
            selected = root.get(0);
        }
        if (selected == null || selected.isMissingNode()) {
            throw new BusinessException(
                    "MELI_LOCATION_REQUIRED",
                    "A conta Mercado Livre precisa ter um endereco de venda padrao configurado para publicar veiculos."
            );
        }

        JsonNode searchLocation = selected.path("search_location");
        JsonNode neighborhood = firstObject(searchLocation.path("neighborhood"), selected.path("neighborhood"));
        JsonNode city = firstObject(searchLocation.path("city"), selected.path("city"));
        JsonNode state = firstObject(searchLocation.path("state"), selected.path("state"));
        JsonNode country = firstObject(searchLocation.path("country"), selected.path("country"));
        String cityId = text(city, "id");
        if (cityId.isBlank() && text(neighborhood, "id").isBlank()) {
            throw new BusinessException(
                    "MELI_LOCATION_REQUIRED",
                    "A conta Mercado Livre precisa ter cidade ou bairro configurados no endereco padrao para publicar veiculos."
            );
        }
        return new LocationSnapshot(
                safe(selected.path("address_line").asText("")),
                firstNonBlank(safe(selected.path("zip_code").asText("")), safe(vehicle.getZipcode())),
                text(neighborhood, "id"),
                text(neighborhood, "name"),
                cityId,
                firstNonBlank(text(city, "name"), safe(vehicle.getCity())),
                text(state, "id"),
                firstNonBlank(text(state, "name"), safe(vehicle.getState())),
                firstNonBlank(text(country, "id"), "BR"),
                firstNonBlank(text(country, "name"), "Brasil")
        );
    }

    private boolean hasType(JsonNode types, String expected) {
        for (JsonNode item : types) {
            if (expected.equalsIgnoreCase(item.asText(""))) {
                return true;
            }
        }
        return false;
    }

    private JsonNode firstObject(JsonNode preferred, JsonNode fallback) {
        return preferred != null && !preferred.isMissingNode() && !preferred.isNull() ? preferred : fallback;
    }

    private String text(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? "" : safe(node.asText(""));
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

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record LocationSnapshot(
            String addressLine,
            String zipCode,
            String neighborhoodId,
            String neighborhoodName,
            String cityId,
            String cityName,
            String stateId,
            String stateName,
            String countryId,
            String countryName
    ) {
    }
}
