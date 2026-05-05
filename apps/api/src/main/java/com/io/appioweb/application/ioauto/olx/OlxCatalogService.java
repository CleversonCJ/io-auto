package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxCatalogBrandEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxCatalogModelEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxCatalogVersionEntity;
import com.io.appioweb.adapters.persistence.ioauto.OlxCatalogBrandRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxCatalogModelRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxCatalogVersionRepositoryJpa;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class OlxCatalogService {

    private static final String CATALOG_TYPE = "CAR";

    private final OlxApiClient apiClient;
    private final OlxAccountService accountService;
    private final OlxCatalogBrandRepositoryJpa brands;
    private final OlxCatalogModelRepositoryJpa models;
    private final OlxCatalogVersionRepositoryJpa versions;

    public OlxCatalogService(
            OlxApiClient apiClient,
            OlxAccountService accountService,
            OlxCatalogBrandRepositoryJpa brands,
            OlxCatalogModelRepositoryJpa models,
            OlxCatalogVersionRepositoryJpa versions
    ) {
        this.apiClient = apiClient;
        this.accountService = accountService;
        this.brands = brands;
        this.models = models;
        this.versions = versions;
    }

    @Transactional
    public CatalogSyncSummary syncCatalog(UUID companyId) {
        int totalBrands = 0;
        int totalModels = 0;
        int totalVersions = 0;
        List<CatalogOption> brandItems = syncCarBrands(companyId);
        totalBrands += brandItems.size();
        for (CatalogOption brand : brandItems) {
            List<CatalogOption> modelItems = syncCarModels(companyId, brand.id());
            totalModels += modelItems.size();
            for (CatalogOption model : modelItems) {
                totalVersions += syncCarVersions(companyId, brand.id(), model.id()).size();
            }
        }
        return new CatalogSyncSummary(totalBrands, totalModels, totalVersions, Instant.now());
    }

    @Transactional
    public List<CatalogOption> syncCarBrands(UUID companyId) {
        String accessToken = accountService.requireAccessToken(companyId);
        JsonNode response = apiClient.getCarInfo(accessToken, "");
        List<CatalogOption> items = extractOptions(response);
        Instant now = Instant.now();
        List<JpaOlxCatalogBrandEntity> upserts = new ArrayList<>();
        for (CatalogOption item : items) {
            JpaOlxCatalogBrandEntity entity = brands.findByOlxBrandIdAndType(item.id(), CATALOG_TYPE)
                    .orElseGet(JpaOlxCatalogBrandEntity::new);
            if (entity.getId() == null) {
                entity.setId(UUID.randomUUID());
                entity.setCreatedAt(now);
            }
            entity.setOlxBrandId(item.id());
            entity.setName(item.name());
            entity.setType(CATALOG_TYPE);
            entity.setUpdatedAt(now);
            upserts.add(entity);
        }
        if (!upserts.isEmpty()) {
            brands.saveAll(upserts);
        }
        return listBrands();
    }

    @Transactional
    public List<CatalogOption> syncCarModels(UUID companyId, String brandId) {
        String accessToken = accountService.requireAccessToken(companyId);
        JsonNode response = apiClient.getCarInfo(accessToken, "/" + urlEncode(brandId));
        List<CatalogOption> items = extractOptions(response);
        Instant now = Instant.now();
        List<JpaOlxCatalogModelEntity> upserts = new ArrayList<>();
        for (CatalogOption item : items) {
            JpaOlxCatalogModelEntity entity = models.findByOlxBrandIdAndOlxModelId(brandId, item.id())
                    .orElseGet(JpaOlxCatalogModelEntity::new);
            if (entity.getId() == null) {
                entity.setId(UUID.randomUUID());
                entity.setCreatedAt(now);
            }
            entity.setOlxBrandId(brandId);
            entity.setOlxModelId(item.id());
            entity.setName(item.name());
            entity.setUpdatedAt(now);
            upserts.add(entity);
        }
        if (!upserts.isEmpty()) {
            models.saveAll(upserts);
        }
        return listModels(brandId);
    }

    @Transactional
    public List<CatalogOption> syncCarVersions(UUID companyId, String brandId, String modelId) {
        String accessToken = accountService.requireAccessToken(companyId);
        JsonNode response = apiClient.getCarInfo(accessToken, "/" + urlEncode(brandId) + "/" + urlEncode(modelId));
        List<CatalogOption> items = extractOptions(response);
        Instant now = Instant.now();
        List<JpaOlxCatalogVersionEntity> upserts = new ArrayList<>();
        for (CatalogOption item : items) {
            JpaOlxCatalogVersionEntity entity = versions.findByOlxBrandIdAndOlxModelIdAndOlxVersionId(brandId, modelId, item.id())
                    .orElseGet(JpaOlxCatalogVersionEntity::new);
            if (entity.getId() == null) {
                entity.setId(UUID.randomUUID());
                entity.setCreatedAt(now);
            }
            entity.setOlxBrandId(brandId);
            entity.setOlxModelId(modelId);
            entity.setOlxVersionId(item.id());
            entity.setName(item.name());
            entity.setUpdatedAt(now);
            upserts.add(entity);
        }
        if (!upserts.isEmpty()) {
            versions.saveAll(upserts);
        }
        return listVersions(brandId, modelId);
    }

    @Transactional(readOnly = true)
    public List<CatalogOption> listBrands() {
        return brands.findAllByTypeOrderByNameAsc(CATALOG_TYPE).stream()
                .map(item -> new CatalogOption(item.getOlxBrandId(), item.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogOption> listModels(String brandId) {
        return models.findAllByOlxBrandIdOrderByNameAsc(brandId).stream()
                .map(item -> new CatalogOption(item.getOlxModelId(), item.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogOption> listVersions(String brandId, String modelId) {
        return versions.findAllByOlxBrandIdAndOlxModelIdOrderByNameAsc(brandId, modelId).stream()
                .map(item -> new CatalogOption(item.getOlxVersionId(), item.getName()))
                .toList();
    }

    private List<CatalogOption> extractOptions(JsonNode root) {
        List<CatalogOption> items = new ArrayList<>();
        JsonNode arrayNode = findArray(root);
        if (arrayNode != null && arrayNode.isArray()) {
            for (JsonNode item : arrayNode) {
                addOption(items, item, null);
            }
        } else if (root != null && root.isObject()) {
            for (var entry : root.properties()) {
                JsonNode child = entry.getValue();
                if (child.isArray()) {
                    for (JsonNode item : child) {
                        addOption(items, item, null);
                    }
                    if (!items.isEmpty()) {
                        break;
                    }
                }
            }
            if (items.isEmpty()) {
                for (var entry : root.properties()) {
                    addOption(items, entry.getValue(), entry.getKey());
                }
            }
        }
        return items.stream().distinct().toList();
    }

    private JsonNode findArray(JsonNode root) {
        if (root == null || root.isMissingNode() || root.isNull()) {
            return null;
        }
        if (root.isArray()) {
            return root;
        }
        String[] candidates = {"data", "brands", "models", "versions", "items", "result"};
        for (String candidate : candidates) {
            JsonNode node = root.path(candidate);
            if (node.isArray()) {
                return node;
            }
        }
        return null;
    }

    private void addOption(List<CatalogOption> items, JsonNode node, String fallbackId) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        String id = firstNonBlank(
                text(node, "id"),
                text(node, "value"),
                text(node, "code"),
                fallbackId
        );
        String name = firstNonBlank(
                text(node, "name"),
                text(node, "label"),
                text(node, "text"),
                text(node, "description"),
                node.isTextual() ? safe(node.asText("")) : ""
        );
        if (safe(id).isBlank() || safe(name).isBlank()) {
            return;
        }
        items.add(new CatalogOption(id, name));
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
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

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record CatalogOption(String id, String name) {
    }

    public record CatalogSyncSummary(int brands, int models, int versions, Instant syncedAt) {
    }
}
