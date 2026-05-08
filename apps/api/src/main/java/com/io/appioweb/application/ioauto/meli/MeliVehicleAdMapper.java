package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.text.Normalizer;
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
        Map<String, MeliCategoryService.CategoryAttributeSnapshot> attributesById = new LinkedHashMap<>();
        for (MeliCategoryService.CategoryAttributeSnapshot attribute : categoryAttributes) {
            attributesById.put(safe(attribute.attributeId()).toUpperCase(Locale.ROOT), attribute);
        }

        putCatalogAwareValue(values, attributesById, "BRAND", vehicle.getBrand());
        putCatalogAwareValue(values, attributesById, "MODEL", vehicle.getModel());
        putCatalogAwareValue(values, attributesById, "TRIM", firstNonBlank(vehicle.getVersion(), vehicle.getEngine()));
        putCatalogAwareValue(values, attributesById, "VEHICLE_YEAR", String.valueOf(resolveYear(vehicle)));
        if (vehicle.getMileage() != null && vehicle.getMileage() >= 0) {
            putIfPresent(values, "KILOMETERS", null, vehicle.getMileage() + " km");
        }
        putCatalogAwareValue(values, attributesById, "FUEL_TYPE", vehicle.getFuelType());
        putCatalogAwareValue(values, attributesById, "COLOR", vehicle.getColor());
        putCatalogAwareValue(values, attributesById, "BODY_TYPE", vehicle.getBodyType());
        putCatalogAwareValue(values, attributesById, "TRANSMISSION", vehicle.getTransmission());

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

    private void putCatalogAwareValue(
            Map<String, MeliVehicleAttributeValue> values,
            Map<String, MeliCategoryService.CategoryAttributeSnapshot> attributesById,
            String id,
            String rawValue
    ) {
        String normalizedId = id.toUpperCase(Locale.ROOT);
        String normalizedValue = nullable(rawValue);
        if (normalizedValue == null) {
            return;
        }

        MeliCategoryService.CategoryAttributeSnapshot attribute = attributesById.get(normalizedId);
        if (attribute == null || attribute.allowedValues() == null || attribute.allowedValues().isEmpty()) {
            putIfPresent(values, normalizedId, null, normalizedValue);
            return;
        }

        MeliCategoryService.AllowedValueSnapshot matched = matchAllowedValue(attribute, normalizedValue);
        if (matched != null) {
            values.put(normalizedId, new MeliVehicleAttributeValue(normalizedId, nullable(matched.id()), nullable(matched.name())));
            return;
        }

        if ("list".equalsIgnoreCase(safe(attribute.valueType()))) {
            throw new BusinessException(
                    "MELI_ATTRIBUTE_VALUE_INVALID",
                    "O valor informado para " + attribute.name() + " nao e aceito pelo Mercado Livre: " + normalizedValue + "."
            );
        }

        putIfPresent(values, normalizedId, null, normalizedValue);
    }

    private MeliCategoryService.AllowedValueSnapshot matchAllowedValue(
            MeliCategoryService.CategoryAttributeSnapshot attribute,
            String rawValue
    ) {
        String normalizedInput = normalizeCatalogText(rawValue);
        if (normalizedInput.isBlank()) {
            return null;
        }

        String alias = catalogAlias(attribute.attributeId(), normalizedInput);
        for (MeliCategoryService.AllowedValueSnapshot option : attribute.allowedValues()) {
            String normalizedOption = normalizeCatalogText(option.name());
            if (normalizedOption.equals(normalizedInput) || (!alias.isBlank() && normalizedOption.equals(alias))) {
                return option;
            }
        }

        for (MeliCategoryService.AllowedValueSnapshot option : attribute.allowedValues()) {
            String normalizedOption = normalizeCatalogText(option.name());
            if ((!alias.isBlank() && (normalizedOption.contains(alias) || alias.contains(normalizedOption)))
                    || normalizedOption.contains(normalizedInput)
                    || normalizedInput.contains(normalizedOption)) {
                return option;
            }
        }
        return null;
    }

    private String catalogAlias(String attributeId, String normalizedInput) {
        String normalizedAttributeId = safe(attributeId).toUpperCase(Locale.ROOT);
        return switch (normalizedAttributeId) {
            case "FUEL_TYPE" -> switch (normalizedInput) {
                case "flex", "gasolinaalcool", "alcoolgasolina", "gasolinaetanol", "etanolgasolina" -> "gasolinaealcool";
                case "gasolinaeletrico", "eletricogasolina" -> "gasolinaeeletrico";
                case "gasolinagnv", "gasolinagasnatural", "gnvgasolina", "gasnaturalgasolina" -> "gasolinaegasnatural";
                case "alcoolgnv", "etanolgnv", "gnvalcool", "gnvetanol", "alcoolgasnatural", "etanolgasnatural" -> "alcoolegasnatural";
                case "gasolinaalcoolgnv", "flexgnv", "gnvflex" -> "gasolinaalcoolegasnatural";
                case "eletrico" -> "eletrico";
                case "gasolina" -> "gasolina";
                case "diesel" -> "diesel";
                case "alcool" -> "alcool";
                case "etanol" -> "etanol";
                case "hibrido" -> "hibrido";
                case "hibridogasolina", "gasolinahibrido" -> "hibridogasolina";
                case "hibridoflex", "flexhibrido" -> "hibridoflex";
                case "hibridodiesel", "dieselhibrido" -> "hibridodiesel";
                default -> "";
            };
            case "TRANSMISSION" -> switch (normalizedInput) {
                case "automatico", "automatica", "cvt" -> "automatica";
                case "manual" -> "manual";
                case "semiautomatico", "semiautomatica" -> "semiautomatica";
                case "automaticosequencial", "automaticasequencial", "sequencial" -> "automaticasequencial";
                default -> "";
            };
            case "COLOR" -> switch (normalizedInput) {
                case "prata" -> "prateado";
                case "cinzaescuro" -> "cinzaescuro";
                case "cinza" -> "cinza";
                case "preto" -> "preto";
                case "branco" -> "branco";
                case "vermelho" -> "vermelho";
                case "azul" -> "azul";
                case "verde" -> "verde";
                case "amarelo" -> "amarelo";
                case "bege" -> "bege";
                case "marrom" -> "marrom";
                default -> "";
            };
            default -> "";
        };
    }

    private String normalizeCatalogText(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "";
        }
        String withoutAccents = Normalizer.normalize(normalized, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutAccents.replaceAll("[^a-z0-9]+", "");
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
