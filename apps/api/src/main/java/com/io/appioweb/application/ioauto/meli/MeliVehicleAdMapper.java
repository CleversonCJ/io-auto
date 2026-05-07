package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Component
public class MeliVehicleAdMapper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public Payload buildCreatePayload(
            UUID companyId,
            JpaIoAutoVehicleEntity vehicle,
            MeliLocationService.LocationSnapshot location,
            String categoryId,
            String listingTypeId,
            String condition,
            String sellerSku,
            String title,
            BigDecimal price,
            List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes,
            List<MeliVehicleAttributeValue> selectedAttributes,
            String currencyId
    ) {
        List<MeliVehicleAttributeValue> attributes = buildAttributes(vehicle, categoryAttributes, selectedAttributes);
        validateRequiredAttributes(categoryAttributes, attributes);

        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        root.put("title", requireTitle(title));
        root.put("category_id", require(categoryId, "Selecione a categoria do Mercado Livre."));
        root.put("price", requirePrice(price).doubleValue());
        root.put("currency_id", require(currencyId, "Moeda do Mercado Livre ausente."));
        root.put("available_quantity", 1);
        root.put("buying_mode", "classified");
        root.put("listing_type_id", require(listingTypeId, "Selecione o tipo de anuncio do Mercado Livre."));
        root.put("condition", normalizeCondition(condition));
        ArrayNode channels = root.putArray("channels");
        channels.add("marketplace");
        root.put("seller_custom_field", require(sellerSku, "Informe o SKU interno do anuncio."));
        root.set("pictures", buildPictures(vehicle));
        root.set("location", buildLocation(location));
        root.set("attributes", buildAttributesNode(attributes));

        try {
            return new Payload(attributes, OBJECT_MAPPER.writeValueAsString(root), root);
        } catch (Exception exception) {
            throw new BusinessException("MELI_PAYLOAD_INVALID", "Nao foi possivel montar o payload do Mercado Livre.");
        }
    }

    public Payload buildUpdatePayload(
            JpaIoAutoVehicleEntity vehicle,
            MeliLocationService.LocationSnapshot location,
            String listingTypeId,
            String condition,
            String title,
            BigDecimal price,
            List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes,
            List<MeliVehicleAttributeValue> selectedAttributes
    ) {
        List<MeliVehicleAttributeValue> attributes = buildAttributes(vehicle, categoryAttributes, selectedAttributes);
        validateRequiredAttributes(categoryAttributes, attributes);

        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        root.put("title", requireTitle(title));
        root.put("price", requirePrice(price).doubleValue());
        root.put("available_quantity", 1);
        root.put("condition", normalizeCondition(condition));
        if (!safe(listingTypeId).isBlank()) {
            root.put("listing_type_id", listingTypeId.trim());
        }
        root.set("pictures", buildPictures(vehicle));
        root.set("location", buildLocation(location));
        root.set("attributes", buildAttributesNode(attributes));

        try {
            return new Payload(attributes, OBJECT_MAPPER.writeValueAsString(root), root);
        } catch (Exception exception) {
            throw new BusinessException("MELI_PAYLOAD_INVALID", "Nao foi possivel montar o payload do Mercado Livre.");
        }
    }

    public void validateRequiredAttributes(
            List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes,
            List<MeliVehicleAttributeValue> attributes
    ) {
        LinkedHashSet<String> sentIds = new LinkedHashSet<>();
        for (MeliVehicleAttributeValue attribute : attributes) {
            sentIds.add(safe(attribute.id()).toUpperCase(Locale.ROOT));
        }

        List<String> missing = categoryAttributes.stream()
                .filter(attribute -> attribute.required() || attribute.catalogRequired())
                .map(MeliCategoryService.CategoryAttributeSnapshot::attributeId)
                .filter(attributeId -> !"SELLER_SKU".equalsIgnoreCase(attributeId))
                .filter(attributeId -> !sentIds.contains(attributeId.toUpperCase(Locale.ROOT)))
                .toList();
        if (!missing.isEmpty()) {
            throw new BusinessException(
                    "MELI_REQUIRED_ATTRIBUTES_MISSING",
                    "Faltam atributos obrigatorios da categoria. Complete: " + String.join(", ", missing)
            );
        }
    }

    private List<MeliVehicleAttributeValue> buildAttributes(
            JpaIoAutoVehicleEntity vehicle,
            List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes,
            List<MeliVehicleAttributeValue> selectedAttributes
    ) {
        Map<String, MeliVehicleAttributeValue> values = new LinkedHashMap<>();

        putIfPresent(values, "BRAND", null, vehicle.getBrand());
        putIfPresent(values, "MODEL", null, vehicle.getModel());
        putIfPresent(values, "TRIM", null, firstNonBlank(vehicle.getVersion(), vehicle.getEngine()));
        putIfPresent(values, "VEHICLE_YEAR", null, String.valueOf(resolveYear(vehicle)));
        if (vehicle.getMileage() != null && vehicle.getMileage() >= 0) {
            putIfPresent(values, "KILOMETERS", null, vehicle.getMileage() + " km");
        }
        putIfPresent(values, "FUEL_TYPE", null, vehicle.getFuelType());
        putIfPresent(values, "COLOR", null, vehicle.getColor());
        putIfPresent(values, "BODY_TYPE", null, vehicle.getBodyType());
        putIfPresent(values, "TRANSMISSION", null, vehicle.getTransmission());

        for (MeliVehicleAttributeValue selected : selectedAttributes == null ? List.<MeliVehicleAttributeValue>of() : selectedAttributes) {
            String id = safe(selected.id()).toUpperCase(Locale.ROOT);
            if (id.isBlank()) {
                continue;
            }
            values.put(id, new MeliVehicleAttributeValue(id, nullable(selected.valueId()), nullable(selected.valueName())));
        }

        LinkedHashSet<String> allowed = new LinkedHashSet<>();
        for (MeliCategoryService.CategoryAttributeSnapshot attribute : categoryAttributes) {
            allowed.add(safe(attribute.attributeId()).toUpperCase(Locale.ROOT));
        }
        return values.values().stream()
                .filter(item -> allowed.isEmpty() || allowed.contains(safe(item.id()).toUpperCase(Locale.ROOT)))
                .filter(item -> item.valueId() != null || item.valueName() != null)
                .toList();
    }

    private ObjectNode buildLocation(MeliLocationService.LocationSnapshot location) {
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        putIfNotBlank(root, "address_line", location.addressLine());
        putIfNotBlank(root, "zip_code", location.zipCode());
        if (!safe(location.neighborhoodId()).isBlank()) {
            ObjectNode neighborhood = root.putObject("neighborhood");
            neighborhood.put("id", location.neighborhoodId());
            putIfNotBlank(neighborhood, "name", location.neighborhoodName());
        }
        ObjectNode city = root.putObject("city");
        city.put("id", require(location.cityId(), "A conta Mercado Livre precisa ter cidade configurada no endereco padrao."));
        putIfNotBlank(city, "name", location.cityName());

        if (!safe(location.stateId()).isBlank()) {
            ObjectNode state = root.putObject("state");
            state.put("id", location.stateId());
            putIfNotBlank(state, "name", location.stateName());
        }

        ObjectNode country = root.putObject("country");
        country.put("id", firstNonBlank(location.countryId(), "BR"));
        putIfNotBlank(country, "name", firstNonBlank(location.countryName(), "Brasil"));
        return root;
    }

    private ArrayNode buildPictures(JpaIoAutoVehicleEntity vehicle) {
        ArrayNode pictures = OBJECT_MAPPER.createArrayNode();
        LinkedHashSet<String> urls = new LinkedHashSet<>();
        String cover = safe(vehicle.getCoverImageUrl());
        if (!cover.isBlank()) {
            validatePublicImage(cover);
            urls.add(cover);
        }
        for (String image : readImages(vehicle.getGalleryJson())) {
            validatePublicImage(image);
            urls.add(image);
        }
        if (urls.isEmpty()) {
            throw new BusinessException("MELI_IMAGES_REQUIRED", "Imagem invalida ou inacessivel.");
        }
        for (String url : urls) {
            pictures.addObject().put("source", url);
        }
        return pictures;
    }

    private List<String> readImages(String raw) {
        try {
            String source = raw == null || raw.isBlank() ? "[]" : raw;
            return OBJECT_MAPPER.readValue(source, new tools.jackson.core.type.TypeReference<List<String>>() {
            });
        } catch (Exception exception) {
            return List.of();
        }
    }

    private ArrayNode buildAttributesNode(List<MeliVehicleAttributeValue> attributes) {
        ArrayNode items = OBJECT_MAPPER.createArrayNode();
        for (MeliVehicleAttributeValue attribute : attributes) {
            ObjectNode node = items.addObject();
            node.put("id", attribute.id());
            if (attribute.valueId() != null) {
                node.put("value_id", attribute.valueId());
            }
            if (attribute.valueName() != null) {
                node.put("value_name", attribute.valueName());
            }
        }
        return items;
    }

    private void validatePublicImage(String url) {
        String normalized = safe(url).toLowerCase(Locale.ROOT);
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            throw new BusinessException("MELI_IMAGE_URL_INVALID", "Imagem invalida ou inacessivel.");
        }
    }

    private Integer resolveYear(JpaIoAutoVehicleEntity vehicle) {
        if (vehicle.getModelYear() != null) {
            return vehicle.getModelYear();
        }
        if (vehicle.getManufactureYear() != null) {
            return vehicle.getManufactureYear();
        }
        throw new BusinessException("MELI_YEAR_REQUIRED", "Informe o ano do veiculo para publicar no Mercado Livre.");
    }

    private void putIfPresent(Map<String, MeliVehicleAttributeValue> values, String id, String valueId, String valueName) {
        String normalizedName = nullable(valueName);
        String normalizedId = nullable(valueId);
        if (normalizedId == null && normalizedName == null) {
            return;
        }
        values.put(id.toUpperCase(Locale.ROOT), new MeliVehicleAttributeValue(id.toUpperCase(Locale.ROOT), normalizedId, normalizedName));
    }

    private void putIfNotBlank(ObjectNode node, String field, String value) {
        if (!safe(value).isBlank()) {
            node.put(field, value.trim());
        }
    }

    private String requireTitle(String value) {
        String normalized = require(value, "Informe um titulo para publicar no Mercado Livre.");
        if (normalized.length() > 60) {
            return normalized.substring(0, 60).trim();
        }
        return normalized;
    }

    private BigDecimal requirePrice(BigDecimal price) {
        if (price == null || price.signum() <= 0) {
            throw new BusinessException("MELI_PRICE_REQUIRED", "Informe um preco maior que zero para publicar no Mercado Livre.");
        }
        return price;
    }

    private String normalizeCondition(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if ("new".equals(normalized) || "used".equals(normalized)) {
            return normalized;
        }
        throw new BusinessException("MELI_CONDITION_REQUIRED", "A condicao do anuncio deve ser new ou used.");
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

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_REQUIRED_FIELD", message);
        }
        return normalized;
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record Payload(
            List<MeliVehicleAttributeValue> attributes,
            String payloadJson,
            ObjectNode payloadNode
    ) {
    }
}
