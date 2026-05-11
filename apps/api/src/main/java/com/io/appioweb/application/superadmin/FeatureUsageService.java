package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.superadmin.FeatureUsageEventRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.JpaFeatureUsageEventEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class FeatureUsageService {

    private static final Logger log = LoggerFactory.getLogger(FeatureUsageService.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static final String FEATURE_MARKETPLACE_INTEGRATION = "MARKETPLACE_INTEGRATION";
    public static final String FEATURE_OWN_SITE = "OWN_SITE";
    public static final String FEATURE_FINANCE = "FINANCE";
    public static final String FEATURE_REPORTS = "REPORTS";
    public static final String FEATURE_VEHICLE_MANAGEMENT = "VEHICLE_MANAGEMENT";
    public static final String FEATURE_LEAD_MANAGEMENT = "LEAD_MANAGEMENT";
    public static final String FEATURE_SALES_MANAGEMENT = "SALES_MANAGEMENT";

    private final FeatureUsageEventRepositoryJpa repository;

    public FeatureUsageService(FeatureUsageEventRepositoryJpa repository) {
        this.repository = repository;
    }

    public void registerUsage(UUID companyId, String featureKey, Map<String, Object> metadata) {
        if (companyId == null) return;
        String normalizedFeature = normalizeFeatureKey(featureKey);
        if (normalizedFeature == null) return;
        try {
            JpaFeatureUsageEventEntity entity = new JpaFeatureUsageEventEntity();
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setFeatureKey(normalizedFeature);
            entity.setOccurredAt(Instant.now());
            entity.setMetadata(toJson(metadata));
            repository.save(entity);
        } catch (Exception ex) {
            log.warn("Failed to persist feature usage event companyId={} featureKey={}: {}", companyId, normalizedFeature, ex.getMessage());
        }
    }

    public void registerUsage(UUID companyId, String featureKey) {
        registerUsage(companyId, featureKey, Map.of());
    }

    private String normalizeFeatureKey(String raw) {
        if (raw == null) return null;
        String normalized = raw.trim().toUpperCase();
        return normalized.isEmpty() ? null : normalized;
    }

    private String toJson(Map<String, Object> metadata) {
        try {
            return OBJECT_MAPPER.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (Exception ignored) {
            return "{}";
        }
    }
}
