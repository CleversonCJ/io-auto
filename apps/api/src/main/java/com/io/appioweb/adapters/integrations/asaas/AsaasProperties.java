package com.io.appioweb.adapters.integrations.asaas;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AsaasProperties {

    private final String baseUrl;
    private final String accessToken;

    public AsaasProperties(
            @Value("${ASAAS_BASE_URL:https://api-sandbox.asaas.com}") String baseUrl,
            @Value("${ASAAS_ACCESS_TOKEN:}") String accessToken
    ) {
        this.baseUrl = baseUrl != null ? baseUrl.trim().replaceAll("/+$", "") : "https://api-sandbox.asaas.com";
        this.accessToken = accessToken != null ? accessToken.trim() : "";
    }

    public String getBaseUrl() { return baseUrl; }
    public String getAccessToken() { return accessToken; }
    public boolean isConfigured() { return !accessToken.isBlank(); }
}
