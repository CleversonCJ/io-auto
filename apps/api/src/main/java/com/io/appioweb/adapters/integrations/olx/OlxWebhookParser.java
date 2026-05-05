package com.io.appioweb.adapters.integrations.olx;

import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.OffsetDateTime;

@Component
public class OlxWebhookParser {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public WebhookPayload parse(String rawPayload) {
        try {
            JsonNode root = OBJECT_MAPPER.readTree(rawPayload == null || rawPayload.trim().isBlank() ? "{}" : rawPayload.trim());
            JsonNode adNode = root.path("data").path("ad");
            JsonNode actionsNode = root.path("data").path("actions");
            return new WebhookPayload(
                    text(root, "id"),
                    text(root, "topic"),
                    parseInstant(text(root, "created_at")),
                    text(adNode, "id"),
                    firstNonBlank(text(adNode, "list_id"), text(adNode, "listId")),
                    text(adNode, "category"),
                    text(adNode, "status"),
                    text(adNode, "operation"),
                    firstNonBlank(text(adNode, "reason_tag"), text(adNode, "reasonTag")),
                    firstNonBlank(text(adNode, "message"), text(root.path("data"), "message")),
                    text(actionsNode, "view")
            );
        } catch (Exception exception) {
            throw new BusinessException("OLX_WEBHOOK_INVALID", "Payload de webhook OLX invalido.");
        }
    }

    private Instant parseInstant(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            try {
                return OffsetDateTime.parse(value).toInstant();
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : value.asText("").trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = value == null ? "" : value.trim();
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    public record WebhookPayload(
            String id,
            String topic,
            Instant createdAt,
            String localAdId,
            String listId,
            String category,
            String status,
            String operation,
            String reasonTag,
            String message,
            String viewUrl
    ) {
    }
}
