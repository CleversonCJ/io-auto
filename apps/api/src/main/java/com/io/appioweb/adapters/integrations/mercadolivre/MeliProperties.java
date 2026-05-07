package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "meli")
public class MeliProperties {

    private String clientId = "";
    private String clientSecret = "";
    private String redirectUri = "";
    private String apiBaseUrl = "https://api.mercadolibre.com";
    private String authBaseUrl = "https://auth.mercadolivre.com.br";
    private String siteId = "MLB";
    private String currencyId = "BRL";
    private String webhookUrl = "";
    private String webhookSecret = "";

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

    public String getApiBaseUrl() {
        return trimTrailingSlash(safe(apiBaseUrl), "https://api.mercadolibre.com");
    }

    public void setApiBaseUrl(String apiBaseUrl) {
        this.apiBaseUrl = safe(apiBaseUrl);
    }

    public String getAuthBaseUrl() {
        return trimTrailingSlash(safe(authBaseUrl), "https://auth.mercadolivre.com.br");
    }

    public void setAuthBaseUrl(String authBaseUrl) {
        this.authBaseUrl = safe(authBaseUrl);
    }

    public String getSiteId() {
        return safe(siteId).isBlank() ? "MLB" : safe(siteId).toUpperCase();
    }

    public void setSiteId(String siteId) {
        this.siteId = safe(siteId);
    }

    public String getCurrencyId() {
        return safe(currencyId).isBlank() ? "BRL" : safe(currencyId).toUpperCase();
    }

    public void setCurrencyId(String currencyId) {
        this.currencyId = safe(currencyId);
    }

    public String getWebhookUrl() {
        return safe(webhookUrl);
    }

    public void setWebhookUrl(String webhookUrl) {
        this.webhookUrl = safe(webhookUrl);
    }

    public String getWebhookSecret() {
        return safe(webhookSecret);
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = safe(webhookSecret);
    }

    public void validateConfigured() {
        if (getClientId().isBlank() || getClientSecret().isBlank() || getRedirectUri().isBlank()) {
            throw new BusinessException(
                    "MELI_NOT_CONFIGURED",
                    "Configure MELI_CLIENT_ID, MELI_CLIENT_SECRET e MELI_REDIRECT_URI para usar a integracao Mercado Livre."
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
