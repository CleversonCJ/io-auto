package com.io.appioweb.adapters.web.crm;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.io.appioweb.adapters.persistence.crm.CrmCompanyStateRepositoryJpa;
import com.io.appioweb.adapters.persistence.crm.JpaCrmCompanyStateEntity;
import com.io.appioweb.adapters.web.crm.request.CrmStateHttpRequest;
import com.io.appioweb.adapters.web.crm.response.CrmStateHttpResponse;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.realtime.RealtimeGateway;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
public class CrmController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final CurrentUserPort currentUser;
    private final CrmCompanyStateRepositoryJpa crmState;
    private final RealtimeGateway realtime;
    private final SuperAdminPlanManagementService planManagementService;

    public CrmController(
            CurrentUserPort currentUser,
            CrmCompanyStateRepositoryJpa crmState,
            RealtimeGateway realtime,
            SuperAdminPlanManagementService planManagementService
    ) {
        this.currentUser = currentUser;
        this.crmState = crmState;
        this.realtime = realtime;
        this.planManagementService = planManagementService;
    }

    @GetMapping("/crm/state")
    public ResponseEntity<CrmStateHttpResponse> getState() {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_CRM_KANBAN);
        var entity = crmState.findById(companyId).orElseGet(() -> defaultEntity(companyId));
        return ResponseEntity.ok(new CrmStateHttpResponse(
                parseJson(entity.getStagesJson(), "[]"),
                parseJson(entity.getLeadStageMapJson(), "{}"),
                parseJson(entity.getCustomFieldsJson(), "[]"),
                parseJson(entity.getLeadFieldValuesJson(), "{}"),
                parseJson(entity.getLeadFieldsOrderJson(), "[]")
        ));
    }

    @PutMapping("/crm/state")
    public ResponseEntity<CrmStateHttpResponse> saveState(@RequestBody CrmStateHttpRequest req) {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_CRM_KANBAN);
        Instant now = Instant.now();
        var entity = crmState.findById(companyId).orElseGet(() -> {
            var created = defaultEntity(companyId);
            created.setCreatedAt(now);
            return created;
        });

        entity.setStagesJson(toJson(req.stages(), "[]"));
        entity.setLeadStageMapJson(toJson(req.leadStageMap(), "{}"));
        entity.setCustomFieldsJson(toJson(req.customFields(), "[]"));
        entity.setLeadFieldValuesJson(toJson(req.leadFieldValues(), "{}"));
        entity.setLeadFieldsOrderJson(toJson(req.leadFieldOrder(), "[]"));
        entity.setUpdatedAt(now);
        crmState.saveAndFlush(entity);
        realtime.crmStateChanged(companyId);

        return ResponseEntity.ok(new CrmStateHttpResponse(
                parseJson(entity.getStagesJson(), "[]"),
                parseJson(entity.getLeadStageMapJson(), "{}"),
                parseJson(entity.getCustomFieldsJson(), "[]"),
                parseJson(entity.getLeadFieldValuesJson(), "{}"),
                parseJson(entity.getLeadFieldsOrderJson(), "[]")
        ));
    }

    private JpaCrmCompanyStateEntity defaultEntity(UUID companyId) {
        Instant now = Instant.now();
        JpaCrmCompanyStateEntity entity = new JpaCrmCompanyStateEntity();
        entity.setCompanyId(companyId);
        entity.setStagesJson("[]");
        entity.setLeadStageMapJson("{}");
        entity.setCustomFieldsJson("[]");
        entity.setLeadFieldValuesJson("{}");
        entity.setLeadFieldsOrderJson("[]");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    private static JsonNode parseJson(String value, String fallbackJson) {
        try {
            return OBJECT_MAPPER.readTree(value == null || value.isBlank() ? fallbackJson : value);
        } catch (Exception ignored) {
            try {
                return OBJECT_MAPPER.readTree(fallbackJson);
            } catch (Exception impossible) {
                return OBJECT_MAPPER.createArrayNode();
            }
        }
    }

    private static String toJson(JsonNode value, String fallbackJson) {
        if (value == null || value.isNull()) return fallbackJson;
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception ignored) {
            return fallbackJson;
        }
    }
}
