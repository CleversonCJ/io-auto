package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
public class OlxAdMapper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String LOCAL_AD_ID_PATTERN = "[A-Za-z0-9_{}-]{1,19}";

    public OlxPayload buildInsertPayload(
            UUID companyId,
            JpaIoAutoVehicleEntity vehicle,
            String accessToken,
            String localAdIdOverride,
            String operation
    ) {
        String localAdId = validateOrGenerateLocalAdId(companyId, vehicle.getId(), localAdIdOverride);
        String normalizedOperation = normalizeOperation(operation);

        Long priceCents = vehicle.getPriceCents();
        if (priceCents == null || priceCents <= 0) {
            throw new BusinessException("OLX_PRICE_REQUIRED", "Informe um preco valido para publicar na OLX.");
        }
        Integer year = resolveYear(vehicle);
        Integer mileage = vehicle.getMileage();
        if (mileage == null || mileage < 0) {
            throw new BusinessException("OLX_MILEAGE_REQUIRED", "Informe a quilometragem do veiculo para publicar na OLX.");
        }

        String description = require(vehicle.getDescription(), "Informe a descricao do anuncio para publicar na OLX.");
        String phone = normalizeDigits(vehicle.getContactPhone(), "Informe um telefone com DDD para publicar na OLX.");
        if (phone.length() < 10 || phone.length() > 11) {
            throw new BusinessException("OLX_PHONE_INVALID", "O telefone da OLX deve conter apenas DDD e numero.");
        }
        String zipcode = normalizeDigits(vehicle.getZipcode(), "Informe o CEP do anuncio para publicar na OLX.");
        if (zipcode.length() != 8) {
            throw new BusinessException("OLX_ZIPCODE_INVALID", "O CEP da OLX deve conter 8 digitos.");
        }

        List<String> images = resolveImages(vehicle);
        if (images.isEmpty()) {
            throw new BusinessException("OLX_IMAGES_REQUIRED", "Adicione pelo menos uma imagem publica para publicar na OLX.");
        }

        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        root.put("access_token", require(accessToken, "A conta OLX da empresa nao esta conectada."));
        ArrayNode adList = root.putArray("ad_list");
        ObjectNode ad = adList.addObject();
        ad.put("id", localAdId);
        ad.put("operation", normalizedOperation);
        ad.put("category", 2020);
        ad.put("subject", require(vehicle.getTitle(), "Informe um titulo para publicar na OLX."));
        ad.put("body", description);
        ad.put("phone", Long.parseLong(phone));
        ad.put("type", "s");
        ad.put("price", Math.max(1L, Math.round(priceCents / 100.0d)));
        ad.put("zipcode", zipcode);

        ObjectNode params = ad.putObject("params");
        params.put("vehicle_brand", require(vehicle.getOlxBrandId(), "Selecione a marca OLX do veiculo."));
        params.put("vehicle_model", require(vehicle.getOlxModelId(), "Selecione o modelo OLX do veiculo."));
        params.put("vehicle_version", require(vehicle.getOlxVersionId(), "Selecione a versao OLX do veiculo."));
        params.put("regdate", String.valueOf(year));
        params.put("mileage", mileage);

        putIfNotBlank(params, "fuel", vehicle.getOlxFuelCode());
        putIfNotBlank(params, "gearbox", vehicle.getOlxGearboxCode());
        putIfNotBlank(params, "doors", vehicle.getOlxDoorsCode());
        putIfNotBlank(params, "carcolor", vehicle.getOlxColorCode());

        List<String> featureCodes = readFeatureCodes(vehicle.getOlxFeatureCodesJson());
        if (!featureCodes.isEmpty()) {
            ArrayNode featuresNode = params.putArray("car_features");
            featureCodes.forEach(featuresNode::add);
        }

        if (mileage > 0) {
            String plate = normalizePlate(vehicle.getPlate());
            if (plate.isBlank()) {
                throw new BusinessException("OLX_PLATE_REQUIRED", "Informe a placa do veiculo usado para publicar na OLX.");
            }
            params.put("vehicle_tag", plate);
        } else if (!safe(vehicle.getPlate()).isBlank()) {
            params.put("vehicle_tag", normalizePlate(vehicle.getPlate()));
        }

        ArrayNode imagesNode = ad.putArray("images");
        images.forEach(imagesNode::add);

        try {
            return new OlxPayload(localAdId, OBJECT_MAPPER.writeValueAsString(root));
        } catch (Exception exception) {
            throw new BusinessException("OLX_PAYLOAD_INVALID", "Nao foi possivel montar o payload da OLX.");
        }
    }

    public OlxPayload buildDeletePayload(UUID companyId, UUID vehicleId, String accessToken, String localAdIdOverride) {
        String localAdId = validateOrGenerateLocalAdId(companyId, vehicleId, localAdIdOverride);
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        root.put("access_token", require(accessToken, "A conta OLX da empresa nao esta conectada."));
        ArrayNode adList = root.putArray("ad_list");
        ObjectNode ad = adList.addObject();
        ad.put("id", localAdId);
        ad.put("operation", "delete");
        try {
            return new OlxPayload(localAdId, OBJECT_MAPPER.writeValueAsString(root));
        } catch (Exception exception) {
            throw new BusinessException("OLX_PAYLOAD_INVALID", "Nao foi possivel montar o payload da OLX.");
        }
    }

    public String validateOrGenerateLocalAdId(UUID companyId, UUID vehicleId, String currentValue) {
        String normalized = safe(currentValue);
        if (normalized.isBlank()) {
            normalized = generateLocalAdId(companyId, vehicleId);
        }
        if (normalized.length() > 19 || !normalized.matches(LOCAL_AD_ID_PATTERN)) {
            throw new BusinessException("OLX_LOCAL_AD_ID_INVALID", "O identificador interno do anuncio OLX deve ter no maximo 19 caracteres validos.");
        }
        return normalized;
    }

    public String generateLocalAdId(UUID companyId, UUID vehicleId) {
        String companyHex = safe(companyId == null ? "" : companyId.toString()).replace("-", "");
        String vehicleHex = safe(vehicleId == null ? "" : vehicleId.toString()).replace("-", "");
        String composed = "c"
                + companyHex.substring(0, Math.min(6, companyHex.length()))
                + "_"
                + vehicleHex.substring(0, Math.min(11, vehicleHex.length()));
        if (composed.length() > 19) {
            return composed.substring(0, 19);
        }
        return composed;
    }

    private List<String> resolveImages(JpaIoAutoVehicleEntity vehicle) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        List<String> invalid = new ArrayList<>();

        String cover = safe(vehicle.getCoverImageUrl());
        if (!cover.isBlank()) {
            if (isPublicUrl(cover)) {
                unique.add(cover);
            } else {
                invalid.add(cover);
            }
        }

        for (String image : readStringArray(vehicle.getGalleryJson())) {
            String normalized = safe(image);
            if (normalized.isBlank()) {
                continue;
            }
            if (isPublicUrl(normalized)) {
                unique.add(normalized);
            } else {
                invalid.add(normalized);
            }
        }

        if (!invalid.isEmpty()) {
            throw new BusinessException("OLX_IMAGE_URL_INVALID", "As imagens da OLX devem usar URLs publicas HTTP/HTTPS.");
        }
        return List.copyOf(unique);
    }

    private List<String> readFeatureCodes(String raw) {
        List<String> values = new ArrayList<>();
        for (String item : readStringArray(raw)) {
            String normalized = safe(item);
            if (!normalized.isBlank()) {
                values.add(normalized);
            }
        }
        return List.copyOf(values);
    }

    private List<String> readStringArray(String raw) {
        try {
            String source = safe(raw);
            if (source.isBlank()) {
                return List.of();
            }
            return OBJECT_MAPPER.readValue(source, new TypeReference<List<String>>() {});
        } catch (Exception exception) {
            throw new BusinessException("OLX_MAPPING_INVALID", "Os codigos de atributos OLX do veiculo sao invalidos.");
        }
    }

    private Integer resolveYear(JpaIoAutoVehicleEntity vehicle) {
        Integer year = vehicle.getModelYear();
        if (year == null) {
            year = vehicle.getManufactureYear();
        }
        if (year == null || year <= 0) {
            throw new BusinessException("OLX_YEAR_REQUIRED", "Informe o ano do veiculo para publicar na OLX.");
        }
        return year;
    }

    private String normalizeOperation(String operation) {
        String normalized = safe(operation).toLowerCase(Locale.ROOT);
        if ("insert".equals(normalized) || "delete".equals(normalized)) {
            return normalized;
        }
        throw new BusinessException("OLX_OPERATION_INVALID", "Operacao OLX invalida.");
    }

    private void putIfNotBlank(ObjectNode node, String field, String value) {
        String normalized = safe(value);
        if (!normalized.isBlank()) {
            node.put(field, normalized);
        }
    }

    private String normalizeDigits(String value, String message) {
        String digits = safe(value).replaceAll("\\D", "");
        if (digits.isBlank()) {
            throw new BusinessException("OLX_REQUIRED_FIELD", message);
        }
        return digits;
    }

    private String normalizePlate(String value) {
        return safe(value).replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private boolean isPublicUrl(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        return normalized.startsWith("http://") || normalized.startsWith("https://");
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("OLX_REQUIRED_FIELD", message);
        }
        return normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record OlxPayload(String localAdId, String payloadJson) {
    }
}
