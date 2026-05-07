package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliCategoryAttributeEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliCategoryEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliCategoryAttributeRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.MeliCategoryRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class MeliCategoryService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final MeliApiClient apiClient;
    private final MeliProperties properties;
    private final MeliCategoryRepositoryJpa categories;
    private final MeliCategoryAttributeRepositoryJpa attributes;

    public MeliCategoryService(
            MeliApiClient apiClient,
            MeliProperties properties,
            MeliCategoryRepositoryJpa categories,
            MeliCategoryAttributeRepositoryJpa attributes
    ) {
        this.apiClient = apiClient;
        this.properties = properties;
        this.categories = categories;
        this.attributes = attributes;
    }

    @Transactional
    public CategorySyncSummary syncRootCategories() {
        JsonNode root = apiClient.getPublic("/sites/" + properties.getSiteId() + "/categories").body();
        int saved = 0;
        for (JsonNode item : root) {
            upsertRootCategory(item);
            saved++;
        }
        return new CategorySyncSummary(saved, Instant.now());
    }

    @Transactional
    public CategorySnapshot syncCategory(String categoryId) {
        String normalizedCategoryId = requireCategoryId(categoryId);
        JsonNode root = apiClient.getPublic("/categories/" + normalizedCategoryId).body();
        Instant now = Instant.now();
        JpaMeliCategoryEntity entity = categories.findBySiteIdAndCategoryId(properties.getSiteId(), normalizedCategoryId)
                .orElseGet(JpaMeliCategoryEntity::new);
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCreatedAt(now);
            entity.setSiteId(properties.getSiteId());
            entity.setCategoryId(normalizedCategoryId);
        }
        entity.setName(text(root, "name"));
        entity.setParentId(resolveParentId(root.path("path_from_root")));
        entity.setPathFromRoot(writeJson(root.path("path_from_root")));
        entity.setSettings(writeSettings(root));
        entity.setUpdatedAt(now);
        categories.save(entity);
        return toSnapshot(entity);
    }

    @Transactional
    public AttributeSyncSummary syncCategoryAttributes(String categoryId) {
        String normalizedCategoryId = requireCategoryId(categoryId);
        JsonNode root = apiClient.getPublic("/categories/" + normalizedCategoryId + "/attributes").body();
        int saved = 0;
        for (JsonNode item : root) {
            upsertAttribute(normalizedCategoryId, item);
            saved++;
        }
        return new AttributeSyncSummary(normalizedCategoryId, saved, Instant.now());
    }

    @Transactional(readOnly = true)
    public List<CategorySnapshot> listCategories(String search) {
        String filter = safe(search).toLowerCase(Locale.ROOT);
        return categories.findAllBySiteIdOrderByNameAsc(properties.getSiteId()).stream()
                .filter(item -> filter.isBlank()
                        || item.getName().toLowerCase(Locale.ROOT).contains(filter)
                        || item.getCategoryId().toLowerCase(Locale.ROOT).contains(filter))
                .map(this::toSnapshot)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryAttributeSnapshot> listAttributes(String categoryId) {
        return attributes.findAllByCategoryIdOrderByRequiredDescNameAsc(requireCategoryId(categoryId)).stream()
                .map(this::toSnapshot)
                .toList();
    }

    public CategorySuggestion discoverVehicleCategory(String title) {
        String query = safe(title);
        if (query.isBlank()) {
            throw new BusinessException("MELI_CATEGORY_DISCOVERY_INVALID", "Informe um titulo para sugerir a categoria do Mercado Livre.");
        }
        JsonNode root = apiClient.getPublic("/sites/" + properties.getSiteId() + "/domain_discovery/search?limit=1&target=classified&q="
                + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)).body();
        if (!root.isArray() || root.isEmpty()) {
            return null;
        }
        JsonNode first = root.get(0);
        return new CategorySuggestion(
                text(first, "domain_id"),
                text(first, "domain_name"),
                text(first, "category_id"),
                text(first, "category_name")
        );
    }

    private void upsertRootCategory(JsonNode item) {
        Instant now = Instant.now();
        String categoryId = text(item, "id");
        JpaMeliCategoryEntity entity = categories.findBySiteIdAndCategoryId(properties.getSiteId(), categoryId)
                .orElseGet(JpaMeliCategoryEntity::new);
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setSiteId(properties.getSiteId());
            entity.setCategoryId(categoryId);
            entity.setCreatedAt(now);
        }
        entity.setName(text(item, "name"));
        entity.setParentId(null);
        entity.setPathFromRoot(null);
        entity.setSettings(null);
        entity.setUpdatedAt(now);
        categories.save(entity);
    }

    private void upsertAttribute(String categoryId, JsonNode item) {
        Instant now = Instant.now();
        String attributeId = text(item, "id");
        JpaMeliCategoryAttributeEntity entity = attributes.findByCategoryIdAndAttributeId(categoryId, attributeId)
                .orElseGet(JpaMeliCategoryAttributeEntity::new);
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCategoryId(categoryId);
            entity.setAttributeId(attributeId);
            entity.setCreatedAt(now);
        }
        entity.setName(text(item, "name"));
        entity.setValueType(text(item, "value_type"));
        entity.setRequired(item.path("tags").path("required").asBoolean(false));
        entity.setCatalogRequired(item.path("tags").path("catalog_required").asBoolean(false));
        entity.setAllowedValues(writeJson(item.path("values")));
        entity.setRaw(writeJson(item));
        entity.setUpdatedAt(now);
        attributes.save(entity);
    }

    private String writeSettings(JsonNode root) {
        try {
            ObjectNode settings = OBJECT_MAPPER.createObjectNode();
            settings.set("settings", root.path("settings"));
            settings.set("children_categories", root.path("children_categories"));
            return OBJECT_MAPPER.writeValueAsString(settings);
        } catch (Exception exception) {
            return "{}";
        }
    }

    private String writeJson(JsonNode node) {
        try {
            return OBJECT_MAPPER.writeValueAsString(node == null ? OBJECT_MAPPER.nullNode() : node);
        } catch (Exception exception) {
            throw new BusinessException("MELI_JSON_SERIALIZATION_FAILED", "Nao foi possivel salvar os dados de categorias do Mercado Livre.");
        }
    }

    private String resolveParentId(JsonNode pathFromRoot) {
        if (!(pathFromRoot instanceof ArrayNode array) || array.size() < 2) {
            return null;
        }
        return text(array.get(array.size() - 2), "id");
    }

    private CategorySnapshot toSnapshot(JpaMeliCategoryEntity entity) {
        return new CategorySnapshot(
                entity.getCategoryId(),
                entity.getName(),
                entity.getParentId(),
                entity.getPathFromRoot(),
                entity.getSettings(),
                entity.getUpdatedAt()
        );
    }

    private CategoryAttributeSnapshot toSnapshot(JpaMeliCategoryAttributeEntity entity) {
        return new CategoryAttributeSnapshot(
                entity.getAttributeId(),
                entity.getName(),
                entity.getValueType(),
                entity.isRequired(),
                entity.isCatalogRequired(),
                readAllowedValues(entity.getAllowedValues()),
                entity.getRaw()
        );
    }

    private List<AllowedValueSnapshot> readAllowedValues(String rawJson) {
        try {
            JsonNode root = OBJECT_MAPPER.readTree(rawJson == null || rawJson.isBlank() ? "[]" : rawJson);
            List<AllowedValueSnapshot> items = new ArrayList<>();
            for (JsonNode item : root) {
                items.add(new AllowedValueSnapshot(text(item, "id"), text(item, "name")));
            }
            return items;
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String requireCategoryId(String categoryId) {
        String normalized = safe(categoryId);
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_CATEGORY_REQUIRED", "Selecione uma categoria do Mercado Livre.");
        }
        return normalized;
    }

    private String text(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? "" : safe(node.asText(""));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record CategorySyncSummary(int total, Instant syncedAt) {
    }

    public record AttributeSyncSummary(String categoryId, int total, Instant syncedAt) {
    }

    public record CategorySnapshot(
            String categoryId,
            String name,
            String parentId,
            String pathFromRoot,
            String settings,
            Instant updatedAt
    ) {
    }

    public record AllowedValueSnapshot(String id, String name) {
    }

    public record CategoryAttributeSnapshot(
            String attributeId,
            String name,
            String valueType,
            boolean required,
            boolean catalogRequired,
            List<AllowedValueSnapshot> allowedValues,
            String raw
    ) {
    }

    public record CategorySuggestion(
            String domainId,
            String domainName,
            String categoryId,
            String categoryName
    ) {
    }
}
