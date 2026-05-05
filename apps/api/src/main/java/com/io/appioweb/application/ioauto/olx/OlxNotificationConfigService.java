package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.integrations.olx.OlxProperties;
import com.io.appioweb.adapters.integrations.olx.OlxResponseParser;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAccountEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

@Service
public class OlxNotificationConfigService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final OlxApiClient apiClient;
    private final OlxProperties properties;
    private final OlxResponseParser responseParser;
    private final OlxAccountService accountService;

    public OlxNotificationConfigService(
            OlxApiClient apiClient,
            OlxProperties properties,
            OlxResponseParser responseParser,
            OlxAccountService accountService
    ) {
        this.apiClient = apiClient;
        this.properties = properties;
        this.responseParser = responseParser;
        this.accountService = accountService;
    }

    @Transactional
    public WebhookConfigSnapshot configureWebhook(UUID companyId) {
        properties.validateWebhookConfigured();
        String accessToken = accountService.requireAccessToken(companyId);
        String body = writeConfigBody();
        OlxResponseParser.NotificationConfigResponse response = responseParser.parseNotificationConfig(
                apiClient.createNotification(accessToken, body).toString()
        );
        if (safe(response.id()).isBlank()) {
            throw new BusinessException("OLX_WEBHOOK_CONFIG_INVALID", "A OLX nao retornou o identificador da configuracao de webhook.");
        }
        accountService.saveWebhookNotificationId(companyId, response.id());
        return toSnapshot(response);
    }

    @Transactional(readOnly = true)
    public WebhookConfigSnapshot getWebhookConfig(UUID companyId) {
        JpaOlxAccountEntity account = accountService.requireActiveAccount(companyId);
        String notificationId = safe(account.getWebhookNotificationId());
        if (notificationId.isBlank()) {
            return new WebhookConfigSnapshot(null, false, "POST", properties.getWebhookUrl(), "application/json", null);
        }
        String accessToken = accountService.requireAccessToken(companyId);
        return toSnapshot(responseParser.parseNotificationConfig(apiClient.getNotification(accessToken, notificationId).toString()));
    }

    @Transactional
    public WebhookConfigSnapshot updateWebhookConfig(UUID companyId) {
        properties.validateWebhookConfigured();
        JpaOlxAccountEntity account = accountService.requireActiveAccount(companyId);
        String notificationId = safe(account.getWebhookNotificationId());
        if (notificationId.isBlank()) {
            return configureWebhook(companyId);
        }
        String accessToken = accountService.requireAccessToken(companyId);
        return toSnapshot(responseParser.parseNotificationConfig(
                apiClient.updateNotification(accessToken, notificationId, writeConfigBody()).toString()
        ));
    }

    @Transactional
    public void deleteWebhookConfig(UUID companyId) {
        JpaOlxAccountEntity account = accountService.requireActiveAccount(companyId);
        String notificationId = safe(account.getWebhookNotificationId());
        if (notificationId.isBlank()) {
            return;
        }
        String accessToken = accountService.requireAccessToken(companyId);
        apiClient.deleteNotification(accessToken, notificationId);
        accountService.saveWebhookNotificationId(companyId, null);
    }

    private String writeConfigBody() {
        try {
            ObjectNode root = OBJECT_MAPPER.createObjectNode();
            root.put("method", "POST");
            root.put("url", properties.getWebhookUrl());
            root.put("media_type", "application/json");
            root.put("token", properties.getWebhookToken());
            return OBJECT_MAPPER.writeValueAsString(root);
        } catch (Exception exception) {
            throw new BusinessException("OLX_WEBHOOK_CONFIG_INVALID", "Nao foi possivel montar a configuracao de webhook da OLX.");
        }
    }

    private WebhookConfigSnapshot toSnapshot(OlxResponseParser.NotificationConfigResponse response) {
        return new WebhookConfigSnapshot(
                blankToNull(response.id()),
                !safe(response.id()).isBlank(),
                blankToNull(response.method()),
                blankToNull(response.url()),
                blankToNull(response.mediaType()),
                blankToNull(response.type())
        );
    }

    private String blankToNull(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record WebhookConfigSnapshot(
            String id,
            boolean configured,
            String method,
            String url,
            String mediaType,
            String type
    ) {
    }
}
