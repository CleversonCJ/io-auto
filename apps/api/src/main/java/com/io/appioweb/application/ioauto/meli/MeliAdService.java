package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliValidationException;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAdRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class MeliAdService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final MeliAdRepositoryJpa ads;
    private final MeliAccountService accountService;
    private final MeliCategoryService categoryService;
    private final MeliListingTypeService listingTypeService;
    private final MeliLocationService locationService;
    private final MeliVehicleAdMapper mapper;
    private final MeliApiClient apiClient;
    private final MeliPublicationStatusService publicationStatusService;

    public MeliAdService(
            IoAutoVehicleRepositoryJpa vehicles,
            MeliAdRepositoryJpa ads,
            MeliAccountService accountService,
            MeliCategoryService categoryService,
            MeliListingTypeService listingTypeService,
            MeliLocationService locationService,
            MeliVehicleAdMapper mapper,
            MeliApiClient apiClient,
            MeliPublicationStatusService publicationStatusService
    ) {
        this.vehicles = vehicles;
        this.ads = ads;
        this.accountService = accountService;
        this.categoryService = categoryService;
        this.listingTypeService = listingTypeService;
        this.locationService = locationService;
        this.mapper = mapper;
        this.apiClient = apiClient;
        this.publicationStatusService = publicationStatusService;
    }

    @Transactional
    public MeliAdSnapshot publishVehicle(UUID companyId, UUID vehicleId) {
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        ensureMinimumVehicleData(vehicle);
        String categoryId = require(vehicle.getMeliCategoryId(), "Categoria preenchida.");
        String listingTypeId = require(vehicle.getMeliListingTypeId(), "A loja nao possui esse tipo de anuncio disponivel.");
        String condition = firstNonBlank(vehicle.getMeliCondition(), vehicle.getMileage() != null && vehicle.getMileage() == 0 ? "new" : "used");
        String sellerSku = resolveSellerSku(vehicle);
        validateSellerSkuUniqueness(companyId, vehicleId, sellerSku);
        validateListingType(companyId, categoryId, listingTypeId);
        ensureCategoryAttributes(categoryId);

        List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes = categoryService.listAttributes(categoryId);
        List<MeliVehicleAttributeValue> selectedAttributes = readVehicleAttributes(vehicle);
        MeliLocationService.LocationSnapshot location = locationService.resolveListingLocation(companyId, account, vehicle);
        MeliVehicleAdMapper.Payload payload = mapper.buildCreatePayload(
                companyId,
                vehicle,
                location,
                categoryId,
                listingTypeId,
                condition,
                sellerSku,
                resolveTitle(vehicle),
                resolvePrice(vehicle),
                categoryAttributes,
                selectedAttributes,
                "BRL"
        );

        try {
            MeliApiClient.JsonResponse response = apiClient.post("/items", companyId, payload.payloadNode());
            JsonNode body = response.body();
            String itemId = text(body, "id");
            if (itemId.isBlank()) {
                throw new BusinessException("MELI_PUBLISH_FAILED", "O Mercado Livre nao retornou o item_id do anuncio.");
            }
            updateDescription(companyId, itemId, resolveDescription(vehicle));

            JpaMeliAdEntity ad = upsertAd(companyId, vehicleId, ads.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null), sellerSku);
            ad.setLastPayload(payload.payloadJson());
            ad.setLastResponse(response.rawBody());
            ad.setLastError(null);
            applyItemToAd(ad, body, Instant.now());
            if (ad.getPublishedAt() == null) {
                ad.setPublishedAt(Instant.now());
            }
            ads.save(ad);
            publicationStatusService.sync(ad);
            return toSnapshot(ad);
        } catch (MeliValidationException exception) {
            throw new BusinessException("MELI_PUBLISH_FAILED", friendlyValidationMessage(exception));
        }
    }

    @Transactional
    public MeliAdSnapshot updateVehicleAd(UUID companyId, UUID vehicleId) {
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaMeliAdEntity ad = requireAd(companyId, vehicleId);
        if (safe(ad.getMeliItemId()).isBlank()) {
            throw new BusinessException("MELI_AD_NOT_PUBLISHED", "Este anuncio ainda nao foi publicado no Mercado Livre.");
        }
        String categoryId = firstNonBlank(ad.getCategoryId(), vehicle.getMeliCategoryId());
        ensureCategoryAttributes(categoryId);
        List<MeliCategoryService.CategoryAttributeSnapshot> categoryAttributes = categoryService.listAttributes(categoryId);
        MeliVehicleAdMapper.Payload payload = mapper.buildUpdatePayload(
                vehicle,
                locationService.resolveListingLocation(companyId, account, vehicle),
                vehicle.getMeliListingTypeId(),
                firstNonBlank(vehicle.getMeliCondition(), "used"),
                resolveTitle(vehicle),
                resolvePrice(vehicle),
                categoryAttributes,
                readVehicleAttributes(vehicle)
        );
        try {
            MeliApiClient.JsonResponse response = apiClient.put("/items/" + ad.getMeliItemId(), companyId, payload.payloadNode());
            updateDescription(companyId, ad.getMeliItemId(), resolveDescription(vehicle));
            ad.setLastPayload(payload.payloadJson());
            ad.setLastResponse(response.rawBody());
            ad.setLastError(null);
            applyItemToAd(ad, response.body(), Instant.now());
            ad.setLastSyncedAt(Instant.now());
            ads.save(ad);
            publicationStatusService.sync(ad);
            return toSnapshot(ad);
        } catch (MeliValidationException exception) {
            throw new BusinessException("MELI_UPDATE_FAILED", friendlyValidationMessage(exception));
        }
    }

    @Transactional
    public MeliAdSnapshot pauseAd(UUID companyId, UUID vehicleId) {
        return updateStatus(companyId, vehicleId, "paused");
    }

    @Transactional
    public MeliAdSnapshot activateAd(UUID companyId, UUID vehicleId) {
        return updateStatus(companyId, vehicleId, "active");
    }

    @Transactional
    public MeliAdSnapshot closeAd(UUID companyId, UUID vehicleId) {
        return updateStatus(companyId, vehicleId, "closed");
    }

    @Transactional(readOnly = true)
    public MeliAdSnapshot getVehicleAd(UUID companyId, UUID vehicleId) {
        return ads.findByCompanyIdAndVehicleId(companyId, vehicleId)
                .map(this::toSnapshot)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<MeliAdSnapshot> listLocalAds(UUID companyId, String status) {
        String normalizedStatus = safe(status);
        List<JpaMeliAdEntity> source = normalizedStatus.isBlank()
                ? ads.findAllByCompanyIdOrderByUpdatedAtDesc(companyId)
                : ads.findAllByCompanyIdAndStatusOrderByUpdatedAtDesc(companyId, normalizedStatus);
        return source.stream().map(this::toSnapshot).toList();
    }

    @Transactional
    public MeliAdSnapshot syncVehicleAd(UUID companyId, UUID vehicleId) {
        JpaMeliAdEntity ad = requireAd(companyId, vehicleId);
        if (safe(ad.getMeliItemId()).isBlank()) {
            throw new BusinessException("MELI_AD_NOT_PUBLISHED", "Este anuncio ainda nao foi publicado no Mercado Livre.");
        }
        return syncAdByItemId(companyId, ad.getMeliItemId());
    }

    @Transactional
    public MeliAdSnapshot syncAdByItemId(UUID companyId, String itemId) {
        MeliApiClient.JsonResponse response = apiClient.get("/items/" + itemId, companyId);
        JpaMeliAdEntity ad = resolveAdFromItem(companyId, response.body());
        applyItemToAd(ad, response.body(), Instant.now());
        ad.setLastResponse(response.rawBody());
        ad.setLastError(null);
        ads.save(ad);
        publicationStatusService.sync(ad);
        return toSnapshot(ad);
    }

    @Transactional
    public SyncSummary syncAllAds(UUID companyId) {
        int total = 0;
        for (String status : List.of("active", "paused", "closed")) {
            int offset = 0;
            while (true) {
                RemoteItemsPage page = listSellerItems(companyId, status, offset, 50, true);
                total += page.items().size();
                if (page.items().size() < 50) {
                    break;
                }
                offset += 50;
            }
        }
        return new SyncSummary(total, Instant.now());
    }

    @Transactional(readOnly = true)
    public RemoteItemsPage listSellerItems(UUID companyId, String status, Integer offset, Integer limit) {
        return listSellerItems(companyId, status, offset, limit, false);
    }

    @Transactional(readOnly = true)
    public RemoteItemSnapshot getRemoteAd(UUID companyId, String itemId) {
        return toRemoteSnapshot(apiClient.get("/items/" + itemId, companyId).body());
    }

    @Transactional
    public void syncActiveAdsBatch(int batchSize) {
        List<String> statuses = List.of("active", "paused", "under_review", "payment_required", "not_yet_active", "inactive");
        List<JpaMeliAdEntity> pending = ads.findTop50ByStatusInOrderByUpdatedAtAsc(statuses).stream()
                .filter(ad -> !safe(ad.getMeliItemId()).isBlank())
                .limit(Math.max(1, batchSize))
                .toList();
        for (JpaMeliAdEntity ad : pending) {
            try {
                syncAdByItemId(ad.getCompanyId(), ad.getMeliItemId());
            } catch (Exception ignored) {
                // The scheduled sync is best-effort; each failure is persisted on the next explicit action.
            }
        }
    }

    private MeliAdSnapshot updateStatus(UUID companyId, UUID vehicleId, String targetStatus) {
        JpaMeliAdEntity ad = requireAd(companyId, vehicleId);
        if (safe(ad.getMeliItemId()).isBlank()) {
            throw new BusinessException("MELI_AD_NOT_PUBLISHED", "Este anuncio ainda nao foi publicado no Mercado Livre.");
        }
        MeliApiClient.JsonResponse response = apiClient.put("/items/" + ad.getMeliItemId(), companyId, java.util.Map.of("status", targetStatus));
        applyItemToAd(ad, response.body(), Instant.now());
        ad.setLastResponse(response.rawBody());
        ad.setLastError(null);
        ads.save(ad);
        publicationStatusService.sync(ad);
        return toSnapshot(ad);
    }

    private void updateDescription(UUID companyId, String itemId, String description) {
        String normalized = safe(description);
        if (normalized.isBlank()) {
            return;
        }
        apiClient.put("/items/" + itemId + "/description", companyId, java.util.Map.of("plain_text", normalized));
    }

    private RemoteItemsPage listSellerItems(UUID companyId, String status, Integer offset, Integer limit, boolean persistLocally) {
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        int resolvedOffset = offset == null || offset < 0 ? 0 : offset;
        int resolvedLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 50);
        StringBuilder path = new StringBuilder("/users/")
                .append(account.getMeliUserId())
                .append("/items/search?offset=")
                .append(resolvedOffset)
                .append("&limit=")
                .append(resolvedLimit);
        if (!safe(status).isBlank()) {
            path.append("&status=").append(java.net.URLEncoder.encode(status, java.nio.charset.StandardCharsets.UTF_8));
        }

        JsonNode search = apiClient.get(path.toString(), companyId).body();
        List<String> itemIds = new ArrayList<>();
        for (JsonNode result : search.path("results")) {
            String id = safe(result.asText(""));
            if (!id.isBlank()) {
                itemIds.add(id);
            }
        }

        List<RemoteItemSnapshot> items = new ArrayList<>();
        for (int start = 0; start < itemIds.size(); start += 20) {
            List<String> chunk = itemIds.subList(start, Math.min(start + 20, itemIds.size()));
            JsonNode batch = apiClient.get("/items?ids=" + String.join(",", chunk), companyId).body();
            for (JsonNode item : batch) {
                if (item.path("code").asInt() != 200) {
                    continue;
                }
                JsonNode body = item.path("body");
                if (persistLocally) {
                    JpaMeliAdEntity ad = resolveAdFromItem(companyId, body);
                    applyItemToAd(ad, body, Instant.now());
                    ads.save(ad);
                    publicationStatusService.sync(ad);
                }
                items.add(toRemoteSnapshot(body));
            }
        }

        return new RemoteItemsPage(
                account.getMeliUserId(),
                resolvedOffset,
                resolvedLimit,
                search.path("paging").path("total").asInt(items.size()),
                items
        );
    }

    private JpaMeliAdEntity resolveAdFromItem(UUID companyId, JsonNode item) {
        String itemId = text(item, "id");
        JpaMeliAdEntity existing = ads.findByCompanyIdAndMeliItemId(companyId, itemId).orElse(null);
        if (existing != null) {
            return existing;
        }

        String sellerCustomField = firstNonBlank(text(item, "seller_custom_field"), findAttributeValue(item.path("attributes"), "SELLER_SKU"));
        UUID vehicleId = resolveVehicleId(companyId, sellerCustomField);
        if (vehicleId == null) {
            throw new BusinessException("MELI_AD_NOT_FOUND", "Nao foi possivel vincular o anuncio remoto a um veiculo local.");
        }

        JpaMeliAdEntity ad = upsertAd(companyId, vehicleId, null, firstNonBlank(sellerCustomField, "VEHICLE-" + vehicleId));
        ad.setMeliItemId(itemId);
        return ad;
    }

    private UUID resolveVehicleId(UUID companyId, String sellerCustomField) {
        String normalized = safe(sellerCustomField);
        if (normalized.toUpperCase(Locale.ROOT).startsWith("VEHICLE-")) {
            try {
                UUID vehicleId = UUID.fromString(normalized.substring("VEHICLE-".length()));
                if (vehicles.findByIdAndCompanyId(vehicleId, companyId).isPresent()) {
                    return vehicleId;
                }
            } catch (IllegalArgumentException ignored) {
                // fall through
            }
        }
        return ads.findByCompanyIdAndSellerSku(companyId, normalized).map(JpaMeliAdEntity::getVehicleId).orElse(null);
    }

    private JpaMeliAdEntity upsertAd(UUID companyId, UUID vehicleId, JpaMeliAdEntity existing, String sellerSku) {
        Instant now = Instant.now();
        JpaMeliAdEntity ad = existing == null ? new JpaMeliAdEntity() : existing;
        if (ad.getId() == null) {
            ad.setId(UUID.randomUUID());
            ad.setCompanyId(companyId);
            ad.setVehicleId(vehicleId);
            ad.setCreatedAt(now);
            ad.setCurrencyId("BRL");
        }
        ad.setSellerSku(sellerSku);
        ad.setUpdatedAt(now);
        return ad;
    }

    private void applyItemToAd(JpaMeliAdEntity ad, JsonNode item, Instant now) {
        ad.setMeliItemId(firstNonBlank(text(item, "id"), ad.getMeliItemId()));
        ad.setCategoryId(firstNonBlank(text(item, "category_id"), ad.getCategoryId()));
        ad.setListingTypeId(firstNonBlank(text(item, "listing_type_id"), ad.getListingTypeId()));
        ad.setTitle(firstNonBlank(text(item, "title"), ad.getTitle()));
        ad.setPermalink(firstNonBlank(text(item, "permalink"), ad.getPermalink()));
        ad.setStatus(firstNonBlank(text(item, "status"), ad.getStatus()));
        ad.setSubStatus(writeJson(item.path("sub_status")));
        if (item.path("price").isNumber()) {
            ad.setPrice(item.path("price").decimalValue().setScale(2, RoundingMode.HALF_UP));
        }
        ad.setCurrencyId(firstNonBlank(text(item, "currency_id"), "BRL"));
        ad.setLastSyncedAt(now);
        if ("active".equalsIgnoreCase(ad.getStatus()) && ad.getPublishedAt() == null) {
            ad.setPublishedAt(now);
        }
        if ("paused".equalsIgnoreCase(ad.getStatus())) {
            ad.setPausedAt(now);
        }
        if ("closed".equalsIgnoreCase(ad.getStatus())) {
            ad.setClosedAt(now);
        }
        ad.setUpdatedAt(now);
    }

    private void ensureMinimumVehicleData(JpaIoAutoVehicleEntity vehicle) {
        if (safe(resolveTitle(vehicle)).isBlank()) {
            throw new BusinessException("MELI_TITLE_REQUIRED", "Informe um titulo para publicar no Mercado Livre.");
        }
        if (resolvePrice(vehicle).signum() <= 0) {
            throw new BusinessException("MELI_PRICE_REQUIRED", "Preco maior que zero.");
        }
        if (safe(resolveDescription(vehicle)).isBlank()) {
            throw new BusinessException("MELI_DESCRIPTION_REQUIRED", "Descricao preenchida.");
        }
        if (vehicle.getModelYear() == null && vehicle.getManufactureYear() == null) {
            throw new BusinessException("MELI_YEAR_REQUIRED", "Informe o ano do veiculo para publicar no Mercado Livre.");
        }
    }

    private void ensureCategoryAttributes(String categoryId) {
        if (categoryService.listAttributes(categoryId).isEmpty()) {
            categoryService.syncCategoryAttributes(categoryId);
        }
    }

    private void validateListingType(UUID companyId, String categoryId, String listingTypeId) {
        boolean available = listingTypeService.getAvailableListingTypes(companyId, categoryId).stream()
                .anyMatch(item -> item.id().equalsIgnoreCase(listingTypeId));
        if (!available) {
            throw new BusinessException("MELI_LISTING_TYPE_UNAVAILABLE", "A loja nao possui esse tipo de anuncio disponivel.");
        }
    }

    private void validateSellerSkuUniqueness(UUID companyId, UUID vehicleId, String sellerSku) {
        ads.findByCompanyIdAndSellerSku(companyId, sellerSku)
                .filter(item -> !item.getVehicleId().equals(vehicleId))
                .ifPresent(item -> {
                    throw new BusinessException("MELI_SKU_ALREADY_USED", "SKU interno unico.");
                });
    }

    private List<MeliVehicleAttributeValue> readVehicleAttributes(JpaIoAutoVehicleEntity vehicle) {
        try {
            String raw = vehicle.getMeliAttributesJson();
            String source = raw == null || raw.isBlank() ? "[]" : raw;
            return OBJECT_MAPPER.readValue(source, new tools.jackson.core.type.TypeReference<List<MeliVehicleAttributeValue>>() {
            });
        } catch (Exception exception) {
            return List.of();
        }
    }

    private JpaIoAutoVehicleEntity requireVehicle(UUID companyId, UUID vehicleId) {
        return vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
    }

    private JpaMeliAdEntity requireAd(UUID companyId, UUID vehicleId) {
        return ads.findByCompanyIdAndVehicleId(companyId, vehicleId)
                .orElseThrow(() -> new BusinessException("MELI_AD_NOT_FOUND", "Anuncio Mercado Livre nao encontrado para o veiculo."));
    }

    private String resolveTitle(JpaIoAutoVehicleEntity vehicle) {
        return firstNonBlank(vehicle.getMeliTitle(), vehicle.getTitle());
    }

    private String resolveDescription(JpaIoAutoVehicleEntity vehicle) {
        return firstNonBlank(vehicle.getMeliDescription(), vehicle.getDescription());
    }

    private BigDecimal resolvePrice(JpaIoAutoVehicleEntity vehicle) {
        Long priceCents = vehicle.getMeliPriceCents() != null ? vehicle.getMeliPriceCents() : vehicle.getPriceCents();
        if (priceCents == null) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(priceCents).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
    }

    private String resolveSellerSku(JpaIoAutoVehicleEntity vehicle) {
        String sku = safe(vehicle.getMeliSellerSku());
        return sku.isBlank() ? "VEHICLE-" + vehicle.getId() : sku;
    }

    private String findAttributeValue(JsonNode attributes, String attributeId) {
        for (JsonNode attribute : attributes) {
            if (attributeId.equalsIgnoreCase(text(attribute, "id"))) {
                return firstNonBlank(text(attribute, "value_name"), text(attribute, "value_id"));
            }
        }
        return "";
    }

    private String writeJson(JsonNode node) {
        try {
            return OBJECT_MAPPER.writeValueAsString(node == null ? OBJECT_MAPPER.createArrayNode() : node);
        } catch (Exception exception) {
            return "[]";
        }
    }

    private String friendlyValidationMessage(MeliValidationException exception) {
        String message = safe(exception.getMessage());
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.contains("immutable") || lower.contains("cannot be modified") || lower.contains("not modifiable")) {
            return "O Mercado Livre recusou a alteracao deste campo.";
        }
        if (lower.contains("picture") || lower.contains("image")) {
            return "Imagem invalida ou inacessivel.";
        }
        return message.isBlank() ? "O Mercado Livre recusou a requisicao." : message;
    }

    private MeliAdSnapshot toSnapshot(JpaMeliAdEntity ad) {
        return new MeliAdSnapshot(
                ad.getId(),
                ad.getVehicleId(),
                ad.getMeliItemId(),
                ad.getSellerSku(),
                ad.getCategoryId(),
                ad.getListingTypeId(),
                ad.getTitle(),
                ad.getPermalink(),
                ad.getStatus(),
                ad.getSubStatus(),
                ad.getPrice(),
                ad.getCurrencyId(),
                ad.getPublishedAt(),
                ad.getPausedAt(),
                ad.getClosedAt(),
                ad.getLastSyncedAt(),
                ad.getCreatedAt(),
                ad.getUpdatedAt()
        );
    }

    private RemoteItemSnapshot toRemoteSnapshot(JsonNode item) {
        return new RemoteItemSnapshot(
                text(item, "id"),
                text(item, "title"),
                text(item, "status"),
                text(item, "category_id"),
                text(item, "listing_type_id"),
                text(item, "permalink"),
                item.path("price").isNumber() ? item.path("price").decimalValue() : null,
                text(item, "seller_custom_field"),
                writeJson(item.path("sub_status"))
        );
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_REQUIRED_FIELD", message);
        }
        return normalized;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : safe(value.asText(""));
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

    public record MeliAdSnapshot(
            UUID id,
            UUID vehicleId,
            String meliItemId,
            String sellerSku,
            String categoryId,
            String listingTypeId,
            String title,
            String permalink,
            String status,
            String subStatus,
            BigDecimal price,
            String currencyId,
            Instant publishedAt,
            Instant pausedAt,
            Instant closedAt,
            Instant lastSyncedAt,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record RemoteItemSnapshot(
            String itemId,
            String title,
            String status,
            String categoryId,
            String listingTypeId,
            String permalink,
            BigDecimal price,
            String sellerCustomField,
            String subStatus
    ) {
    }

    public record RemoteItemsPage(
            Long sellerId,
            int offset,
            int limit,
            int total,
            List<RemoteItemSnapshot> items
    ) {
    }

    public record SyncSummary(int total, Instant syncedAt) {
    }
}
