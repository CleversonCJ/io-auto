package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.util.UUID;

@Service
public class MeliProfileService {

    private static final Logger log = LoggerFactory.getLogger(MeliProfileService.class);

    private final MeliApiClient apiClient;
    private final MeliAccountService accountService;

    public MeliProfileService(
            MeliApiClient apiClient,
            MeliAccountService accountService
    ) {
        this.apiClient = apiClient;
        this.accountService = accountService;
    }

    @Transactional
    public MeliAccountService.MeliConnectionSnapshot getStatus(UUID companyId) {
        MeliAccountService.MeliConnectionSnapshot status = accountService.getStatus(companyId);
        if (!status.connected() || !safe(status.fullName()).isBlank()) {
            return status;
        }

        try {
            JsonNode me = apiClient.get("/users/me", companyId).body();
            accountService.updateProfile(
                    companyId,
                    text(me, "nickname"),
                    buildFullName(me),
                    text(me, "site_id"),
                    text(me, "logo")
            );
            return accountService.getStatus(companyId);
        } catch (Exception exception) {
            log.warn("MELI account profile hydration failed companyId={} reason={}", companyId, exception.getMessage());
            return status;
        }
    }

    private String buildFullName(JsonNode root) {
        return firstNonBlank(
                text(root, "first_name") + " " + text(root, "last_name"),
                text(root, "registration_name"),
                text(root, "nickname")
        );
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
}
