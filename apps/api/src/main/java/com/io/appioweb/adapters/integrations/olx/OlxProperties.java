package com.io.appioweb.adapters.integrations.olx;

import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "olx")
public class OlxProperties {

    private String clientId = "";
    private String clientSecret = "";
    private String redirectUri = "";
    private String authBaseUrl = "https://auth.olx.com.br";
    private String apiBaseUrl = "https://apps.olx.com.br";
    private String webhookUrl = "";
    private String webhookToken = "";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = safe(clientId);
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = safe(clientSecret);
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public void setRedirectUri(String redirectUri) {
        this.redirectUri = safe(redirectUri);
    }

    public String getAuthBaseUrl() {
        return trimTrailingSlash(safe(authBaseUrl), "https://auth.olx.com.br");
    }

    public void setAuthBaseUrl(String authBaseUrl) {
        this.authBaseUrl = safe(authBaseUrl);
    }

    public String getApiBaseUrl() {
        return trimTrailingSlash(safe(apiBaseUrl), "https://apps.olx.com.br");
    }

    public void setApiBaseUrl(String apiBaseUrl) {
        this.apiBaseUrl = safe(apiBaseUrl);
    }

    public String getWebhookUrl() {
        return safe(webhookUrl);
    }

    public void setWebhookUrl(String webhookUrl) {
        this.webhookUrl = safe(webhookUrl);
    }

    public String getWebhookToken() {
        return safe(webhookToken);
    }

    public void setWebhookToken(String webhookToken) {
        this.webhookToken = safe(webhookToken);
    }

    public void validateOauthConfigured() {
        if (getClientId().isBlank() || getClientSecret().isBlank() || getRedirectUri().isBlank()) {
            throw new BusinessException(
                    "OLX_NOT_CONFIGURED",
                    "Configure OLX_CLIENT_ID, OLX_CLIENT_SECRET e OLX_REDIRECT_URI para usar a integracao OLX."
            );
        }
    }

    public void validateWebhookConfigured() {
        if (getWebhookUrl().isBlank() || getWebhookToken().isBlank()) {
            throw new BusinessException(
                    "OLX_WEBHOOK_NOT_CONFIGURED",
                    "Configure OLX_WEBHOOK_URL e OLX_WEBHOOK_TOKEN para usar o webhook da OLX."
            );
        }
    }

    private String trimTrailingSlash(String value, String fallback) {
        String normalized = value.isBlank() ? fallback : value;
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
