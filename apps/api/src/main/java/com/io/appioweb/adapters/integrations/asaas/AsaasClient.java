package com.io.appioweb.adapters.integrations.asaas;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * HTTP client for Asaas API interactions.
 * Currently implements subscription description update (PUT /v3/subscriptions/{id}).
 */
@Component
public class AsaasClient {

    private static final Logger log = LoggerFactory.getLogger(AsaasClient.class);
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private static final int MAX_DESCRIPTION_LENGTH = 500;
    private static final String DEFAULT_DESCRIPTION = "Assinatura IO Auto";

    private final AsaasProperties properties;

    public AsaasClient(AsaasProperties properties) {
        this.properties = properties;
    }

    /**
     * Updates the description of a subscription in Asaas.
     *
     * @param subscriptionId    Asaas subscription ID (e.g., sub_xxx)
     * @param description       Human-readable plan name / description
     * @param externalReference Internal reference (e.g., subscription UUID or company UUID)
     * @return true if the update succeeded, false otherwise
     */
    public boolean updateSubscriptionDescription(String subscriptionId, String description, String externalReference) {
        if (!properties.isConfigured()) {
            log.warn("[AsaasClient] ASAAS_ACCESS_TOKEN not configured – skipping subscription description update for {}", subscriptionId);
            return false;
        }

        if (subscriptionId == null || subscriptionId.isBlank()) {
            log.warn("[AsaasClient] subscriptionId is blank – cannot update description");
            return false;
        }

        String safeDescription = sanitizeDescription(description);
        String safeRef = externalReference != null ? externalReference.trim() : "";

        String requestBody = """
                {
                  "description": "%s",
                  "externalReference": "%s",
                  "updatePendingPayments": true
                }
                """.formatted(
                escapeJsonString(safeDescription),
                escapeJsonString(safeRef)
        );

        String baseUrl = properties.getBaseUrl().endsWith("/") 
                ? properties.getBaseUrl().substring(0, properties.getBaseUrl().length() - 1) 
                : properties.getBaseUrl();
        
        // Asaas base URL usually ends with /v3. Let's make sure we don't duplicate it.
        String path = baseUrl.endsWith("/v3") ? "/subscriptions/" : "/v3/subscriptions/";
        String url = baseUrl + path + subscriptionId.trim();

        log.info("[AsaasClient] PUT {} – updating description to '{}' (externalRef={})",
                url, safeDescription, safeRef);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("accept", "application/json")
                    .header("access_token", properties.getAccessToken())
                    .PUT(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[AsaasClient] Subscription {} description updated successfully (HTTP {})",
                        subscriptionId, response.statusCode());
                return true;
            } else {
                log.error("[AsaasClient] Failed to update subscription {} description – HTTP {} – body: {}",
                        subscriptionId, response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("[AsaasClient] Exception updating subscription {} description: {}", subscriptionId, e.getMessage(), e);
            return false;
        }
    }

    private String sanitizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return DEFAULT_DESCRIPTION;
        }
        String trimmed = description.trim();
        if (trimmed.length() > MAX_DESCRIPTION_LENGTH) {
            return trimmed.substring(0, MAX_DESCRIPTION_LENGTH);
        }
        return trimmed;
    }

    private String escapeJsonString(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
