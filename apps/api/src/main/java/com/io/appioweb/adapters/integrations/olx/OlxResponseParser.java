package com.io.appioweb.adapters.integrations.olx;

import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class OlxResponseParser {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public ImportResponse parseImportResponse(String raw) {
        JsonNode root = readTree(raw, "OLX_IMPORT_RESPONSE_INVALID", "Resposta invalida da importacao OLX.");
        List<ImportItemError> errors = new ArrayList<>();
        JsonNode errorsNode = root.path("errors");
        if (errorsNode.isArray()) {
            for (JsonNode errorNode : errorsNode) {
                List<String> messages = new ArrayList<>();
                JsonNode messagesNode = errorNode.path("messages");
                if (messagesNode.isArray()) {
                    for (JsonNode messageNode : messagesNode) {
                        String category = firstNonBlank(
                                messageNode.path("category").asText(""),
                                messageNode.path("error").asText(""),
                                messageNode.path("message").asText("")
                        );
                        if (!category.isBlank()) {
                            messages.add(category);
                        }
                    }
                }
                errors.add(new ImportItemError(
                        text(errorNode, "id"),
                        text(errorNode, "status"),
                        List.copyOf(messages)
                ));
            }
        }
        return new ImportResponse(
                nullable(text(root, "token")),
                root.path("statusCode").asInt(root.path("status_code").asInt(-1)),
                firstNonBlank(text(root, "statusMessage"), text(root, "status_message")),
                List.copyOf(errors)
        );
    }

    public ImportStatusResponse parseImportStatusResponse(String raw) {
        JsonNode root = readTree(raw, "OLX_IMPORT_STATUS_INVALID", "Resposta invalida do status de importacao OLX.");
        List<ImportAdStatus> statuses = new ArrayList<>();
        JsonNode adsNode = root.path("ads");
        if (adsNode.isObject()) {
            for (var entry : adsNode.properties()) {
                statuses.add(readImportStatusEntry(entry.getKey(), entry.getValue()));
            }
        } else if (adsNode.isArray()) {
            for (JsonNode item : adsNode) {
                statuses.add(readImportStatusEntry(text(item, "id"), item));
            }
        }
        return new ImportStatusResponse(
                firstNonBlank(text(root, "autoupload_status"), text(root, "status")),
                List.copyOf(statuses)
        );
    }

    public PublishedAdStatusResponse parsePublishedAdStatus(String raw) {
        JsonNode root = readTree(raw, "OLX_PUBLISHED_STATUS_INVALID", "Resposta invalida do anuncio publicado na OLX.");
        List<ImageError> imageErrors = new ArrayList<>();
        JsonNode imageErrorsNode = root.path("imageErrors");
        if (imageErrorsNode.isArray()) {
            for (JsonNode imageError : imageErrorsNode) {
                imageErrors.add(new ImageError(
                        text(imageError, "imageUrl"),
                        text(imageError, "status"),
                        firstNonBlank(text(imageError, "errorMessage"), text(imageError, "message")),
                        parseInstant(firstNonBlank(text(imageError, "processedAt"), text(imageError, "processed_at")))
                ));
            }
        }
        return new PublishedAdStatusResponse(
                text(root, "status"),
                firstNonBlank(text(root, "message"), collectMessageCodes(root.path("message"))),
                text(root, "url"),
                firstNonBlank(text(root, "list_id"), text(root, "listId")),
                List.copyOf(imageErrors)
        );
    }

    public PublishedAdsPageResponse parsePublishedAdsPage(String raw) {
        JsonNode root = readTree(raw, "OLX_PUBLISHED_LIST_INVALID", "Resposta invalida da listagem de anuncios OLX.");
        List<PublishedAdItem> items = new ArrayList<>();
        JsonNode dataNode = root.path("data");
        if (dataNode.isArray()) {
            for (JsonNode item : dataNode) {
                items.add(new PublishedAdItem(
                        text(item, "id"),
                        firstNonBlank(text(item, "list_id"), text(item, "listId")),
                        text(item, "status")
                ));
            }
        }
        return new PublishedAdsPageResponse(
                List.copyOf(items),
                nullable(text(root, "current_token")),
                nullable(text(root, "next_token"))
        );
    }

    public NotificationConfigResponse parseNotificationConfig(String raw) {
        JsonNode root = readTree(raw, "OLX_NOTIFICATION_CONFIG_INVALID", "Resposta invalida da configuracao de webhook OLX.");
        return new NotificationConfigResponse(
                text(root, "id"),
                text(root, "method"),
                text(root, "url"),
                firstNonBlank(text(root, "media_type"), text(root, "mediaType")),
                text(root, "token"),
                text(root, "type")
        );
    }

    public BasicUserInfo parseBasicUserInfo(String raw) {
        JsonNode root = readTree(raw, "OLX_BASIC_USER_INFO_INVALID", "Resposta invalida dos dados basicos do usuario OLX.");
        return new BasicUserInfo(text(root, "user_name"), text(root, "user_email"));
    }

    public BalanceResponse parseBalance(String raw, int httpStatus) {
        JsonNode root = readTree(raw, "OLX_BALANCE_INVALID", "Resposta invalida do saldo de anuncios OLX.");
        if (httpStatus == 410) {
            return new BalanceResponse(
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    text(root, "reason"),
                    text(root, "message")
            );
        }
        return new BalanceResponse(
                true,
                text(root, "id"),
                text(root, "name"),
                readCounter(root.path("ads")),
                readBumps(root.path("bumps")),
                parseInstant(text(root, "last_renew_date")),
                parseInstant(text(root, "next_renew_date")),
                text(root, "reason"),
                text(root, "message")
        );
    }

    private ImportAdStatus readImportStatusEntry(String id, JsonNode item) {
        return new ImportAdStatus(
                id,
                normalizeStatus(text(item, "status")),
                normalizeOperation(text(item, "operation")),
                firstNonBlank(text(item, "list_id"), text(item, "listId")),
                text(item, "url"),
                readMessages(item.path("message"))
        );
    }

    private List<String> readMessages(JsonNode node) {
        List<String> messages = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode item : node) {
                String value = firstNonBlank(text(item, "error"), text(item, "category"), text(item, "message"));
                if (!value.isBlank()) {
                    messages.add(value);
                }
            }
        } else {
            String value = node.asText("").trim();
            if (!value.isBlank()) {
                messages.add(value);
            }
        }
        return List.copyOf(messages);
    }

    private Counter readCounter(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return new Counter(
                node.path("performed").isNumber() ? node.path("performed").asInt() : null,
                node.path("available").isNumber() ? node.path("available").asInt() : null,
                node.path("total").isNumber() ? node.path("total").asInt() : null
        );
    }

    private Bumps readBumps(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return new Bumps(readCounter(node.path("plan")), readCounter(node.path("additional")));
    }

    private String collectMessageCodes(JsonNode messageNode) {
        if (messageNode == null || messageNode.isMissingNode() || messageNode.isNull()) {
            return "";
        }
        if (messageNode.isArray()) {
            List<String> values = new ArrayList<>();
            for (JsonNode item : messageNode) {
                String value = firstNonBlank(text(item, "error"), text(item, "message"), item.asText(""));
                if (!value.isBlank()) {
                    values.add(value);
                }
            }
            return String.join(", ", values);
        }
        return messageNode.asText("").trim();
    }

    private JsonNode readTree(String raw, String code, String message) {
        try {
            String source = raw == null || raw.trim().isBlank() ? "{}" : raw.trim();
            return OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            throw new BusinessException(code, message);
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

    private String normalizeStatus(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase();
        if ("accept".equals(value)) {
            return "accepted";
        }
        return value;
    }

    private String normalizeOperation(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase();
        return "edit".equals(value) ? "insert" : value;
    }

    private String nullable(String value) {
        return value == null || value.trim().isBlank() ? null : value.trim();
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

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : value.asText("").trim();
    }

    public record ImportResponse(String token, int statusCode, String statusMessage, List<ImportItemError> errors) {
    }

    public record ImportItemError(String id, String status, List<String> messages) {
    }

    public record ImportStatusResponse(String autouploadStatus, List<ImportAdStatus> ads) {
    }

    public record ImportAdStatus(String id, String status, String operation, String listId, String url, List<String> messages) {
    }

    public record PublishedAdStatusResponse(String status, String message, String url, String listId, List<ImageError> imageErrors) {
    }

    public record ImageError(String imageUrl, String status, String errorMessage, Instant processedAt) {
    }

    public record PublishedAdsPageResponse(List<PublishedAdItem> data, String currentToken, String nextToken) {
    }

    public record PublishedAdItem(String id, String listId, String status) {
    }

    public record NotificationConfigResponse(String id, String method, String url, String mediaType, String token, String type) {
    }

    public record BasicUserInfo(String userName, String userEmail) {
    }

    public record BalanceResponse(
            boolean available,
            String id,
            String name,
            Counter ads,
            Bumps bumps,
            Instant lastRenewDate,
            Instant nextRenewDate,
            String reason,
            String message
    ) {
    }

    public record Counter(Integer performed, Integer available, Integer total) {
    }

    public record Bumps(Counter plan, Counter additional) {
    }
}
