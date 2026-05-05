package com.io.appioweb.adapters.integrations.olx;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OlxApiClient {

    private static final Logger log = LoggerFactory.getLogger(OlxApiClient.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private static final List<Long> DEFAULT_BACKOFF_MS = List.of(350L, 900L, 1500L);

    private final OlxProperties properties;
    private final HttpRequestExecutor executor;
    private final Sleeper sleeper;

    @Autowired
    public OlxApiClient(OlxProperties properties) {
        this(properties, request -> HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()), Thread::sleep);
    }

    OlxApiClient(OlxProperties properties, HttpRequestExecutor executor, Sleeper sleeper) {
        this.properties = properties;
        this.executor = executor;
        this.sleeper = sleeper;
    }

    public JsonNode exchangeAuthorizationCode(String code) {
        properties.validateOauthConfigured();
        String body = buildForm(Map.of(
                "code", require(code, "Codigo OAuth da OLX ausente."),
                "client_id", properties.getClientId(),
                "client_secret", properties.getClientSecret(),
                "redirect_uri", properties.getRedirectUri(),
                "grant_type", "authorization_code"
        ));
        return executeJson("POST",
                URI.create(properties.getAuthBaseUrl() + "/oauth/token"),
                Map.of("Content-Type", "application/x-www-form-urlencoded"),
                body,
                "oauth-token");
    }

    public JsonNode basicUserInfo(String accessToken) {
        return executeJson("POST",
                URI.create(properties.getApiBaseUrl() + "/oauth_api/basic_user_info"),
                Map.of("Content-Type", "application/json"),
                "{\"access_token\":\"" + escapeJson(accessToken) + "\"}",
                "basic-user-info");
    }

    public JsonNode importAds(String payloadJson) {
        return executeJson("PUT",
                URI.create(properties.getApiBaseUrl() + "/autoupload/import"),
                Map.of("Content-Type", "application/json"),
                payloadJson,
                "autoupload-import");
    }

    public JsonNode getImportStatus(String importToken, String accessToken) {
        String body = "{\"access_token\":\"" + escapeJson(accessToken) + "\"}";
        return executeJson("POST",
                URI.create(properties.getApiBaseUrl() + "/autoupload/import/" + urlEncode(importToken)),
                Map.of("Content-Type", "application/json"),
                body,
                "autoupload-import-status");
    }

    public JsonNode getPublishedAd(String listId, String accessToken) {
        return executeJson("GET",
                URI.create(properties.getApiBaseUrl() + "/autoupload/ads/" + urlEncode(listId)),
                Map.of("Authorization", "Bearer " + require(accessToken, "Access token OLX ausente.")),
                null,
                "autoupload-published-ad");
    }

    public JsonNode listPublishedAds(String accessToken, String adsStatus, String pageToken, Integer fetchSize) {
        Map<String, String> query = new LinkedHashMap<>();
        if (!safe(adsStatus).isBlank()) {
            query.put("ads_status", safe(adsStatus));
        }
        if (!safe(pageToken).isBlank()) {
            query.put("page_token", safe(pageToken));
        }
        if (fetchSize != null && fetchSize > 0) {
            query.put("fetch_size", String.valueOf(Math.min(fetchSize, 200)));
        }
        String suffix = query.isEmpty() ? "" : "?" + buildForm(query);
        return executeJson("GET",
                URI.create(properties.getApiBaseUrl() + "/autoupload/v1/published" + suffix),
                Map.of("Authorization", "Bearer " + require(accessToken, "Access token OLX ausente.")),
                null,
                "autoupload-published-list");
    }

    public JsonNode getCarInfo(String accessToken, String pathSuffix) {
        String normalizedPath = safe(pathSuffix);
        String body = "{\"access_token\":\"" + escapeJson(accessToken) + "\"}";
        return executeJson("POST",
                URI.create(properties.getApiBaseUrl() + "/autoupload/car_info" + normalizedPath),
                Map.of("Content-Type", "application/json"),
                body,
                "autoupload-car-info");
    }

    public HttpJsonResponse getBalance(String accessToken) {
        return executeRaw("GET",
                URI.create(properties.getApiBaseUrl() + "/autoupload/balance"),
                Map.of("Authorization", "Bearer " + require(accessToken, "Access token OLX ausente.")),
                null,
                "autoupload-balance",
                true);
    }

    public JsonNode createNotification(String accessToken, String bodyJson) {
        return executeJson("POST",
                URI.create(properties.getApiBaseUrl() + "/autoservice/v1/notification"),
                Map.of(
                        "Authorization", "Bearer " + require(accessToken, "Access token OLX ausente."),
                        "Content-Type", "application/json"
                ),
                bodyJson,
                "autoservice-create-notification");
    }

    public JsonNode getNotification(String accessToken, String notificationId) {
        return executeJson("GET",
                URI.create(properties.getApiBaseUrl() + "/autoservice/v1/notification/" + urlEncode(notificationId)),
                Map.of("Authorization", "Bearer " + require(accessToken, "Access token OLX ausente.")),
                null,
                "autoservice-get-notification");
    }

    public JsonNode updateNotification(String accessToken, String notificationId, String bodyJson) {
        return executeJson("PUT",
                URI.create(properties.getApiBaseUrl() + "/autoservice/v1/notification/" + urlEncode(notificationId)),
                Map.of(
                        "Authorization", "Bearer " + require(accessToken, "Access token OLX ausente."),
                        "Content-Type", "application/json"
                ),
                bodyJson,
                "autoservice-update-notification");
    }

    public void deleteNotification(String accessToken, String notificationId) {
        executeJson("DELETE",
                URI.create(properties.getApiBaseUrl() + "/autoservice/v1/notification/" + urlEncode(notificationId)),
                Map.of("Authorization", "Bearer " + require(accessToken, "Access token OLX ausente.")),
                null,
                "autoservice-delete-notification");
    }

    private JsonNode executeJson(String method, URI uri, Map<String, String> headers, String body, String operation) {
        HttpJsonResponse response = executeRaw(method, uri, headers, body, operation, false);
        try {
            String rawBody = response.rawBody() == null || response.rawBody().isBlank() ? "{}" : response.rawBody();
            return OBJECT_MAPPER.readTree(rawBody);
        } catch (Exception exception) {
            throw new OlxUnexpectedException("OLX_INVALID_RESPONSE", "A OLX retornou um JSON invalido.", response.httpStatus(), "");
        }
    }

    private HttpJsonResponse executeRaw(
            String method,
            URI uri,
            Map<String, String> headers,
            String body,
            String operation,
            boolean allow410
    ) {
        HttpResponse<String> lastResponse = null;
        for (int attempt = 0; attempt < DEFAULT_BACKOFF_MS.size() + 1; attempt++) {
            if (attempt > 0) {
                sleep(DEFAULT_BACKOFF_MS.get(attempt - 1));
            }
            try {
                HttpRequest request = buildRequest(method, uri, headers, body);
                log.debug("OLX request operation={} method={} uri={} body={}", operation, method, uri, sanitize(body));
                HttpResponse<String> response = executor.send(request);
                lastResponse = response;
                log.debug("OLX response operation={} status={} body={}", operation, response.statusCode(), sanitize(response.body()));
                if (response.statusCode() == 429 || response.statusCode() >= 500) {
                    if (attempt < DEFAULT_BACKOFF_MS.size()) {
                        continue;
                    }
                }
                if (allow410 && response.statusCode() == 410) {
                    return new HttpJsonResponse(response.statusCode(), response.body());
                }
                if (response.statusCode() >= 400) {
                    throw mapHttpError(response);
                }
                return new HttpJsonResponse(response.statusCode(), response.body());
            } catch (OlxRateLimitException | OlxUnexpectedException retryable) {
                if (attempt >= DEFAULT_BACKOFF_MS.size() || !shouldRetry(retryable.httpStatus())) {
                    throw retryable;
                }
            } catch (OlxApiException exception) {
                throw exception;
            } catch (Exception exception) {
                if (attempt >= DEFAULT_BACKOFF_MS.size()) {
                    throw new OlxUnexpectedException("OLX_REQUEST_FAILED", "Nao foi possivel concluir a comunicacao com a OLX.", 500, "");
                }
            }
        }

        if (lastResponse != null) {
            throw mapHttpError(lastResponse);
        }
        throw new OlxUnexpectedException("OLX_REQUEST_FAILED", "Nao foi possivel concluir a comunicacao com a OLX.", 500, "");
    }

    private HttpRequest buildRequest(String method, URI uri, Map<String, String> headers, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(25));
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            builder.header(entry.getKey(), entry.getValue());
        }
        return switch (method.toUpperCase()) {
            case "GET" -> builder.GET().build();
            case "POST" -> builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body)).build();
            case "PUT" -> builder.PUT(HttpRequest.BodyPublishers.ofString(body == null ? "" : body)).build();
            case "DELETE" -> builder.DELETE().build();
            default -> throw new IllegalArgumentException("Metodo HTTP nao suportado: " + method);
        };
    }

    private OlxApiException mapHttpError(HttpResponse<String> response) {
        String reason = "";
        String message = "";
        try {
            JsonNode root = OBJECT_MAPPER.readTree(response.body() == null || response.body().isBlank() ? "{}" : response.body());
            reason = firstNonBlank(root.path("reason").asText(""), root.path("error").asText(""));
            message = firstNonBlank(root.path("message").asText(""), root.path("error_description").asText(""));
        } catch (Exception ignored) {
            message = safe(response.body());
        }
        String fallbackMessage = message.isBlank() ? "A OLX rejeitou a requisicao." : message;
        return switch (response.statusCode()) {
            case 400 -> new OlxValidationException(fallbackMessage, response.statusCode(), reason);
            case 401 -> new OlxUnauthorizedException(fallbackMessage, response.statusCode(), reason);
            case 403 -> new OlxPermissionException(fallbackMessage, response.statusCode(), reason);
            case 404 -> new OlxUnexpectedException("OLX_NOT_FOUND", fallbackMessage, response.statusCode(), reason);
            case 410 -> new OlxUnexpectedException("OLX_RESOURCE_GONE", fallbackMessage, response.statusCode(), reason);
            case 429 -> new OlxRateLimitException(fallbackMessage, response.statusCode(), reason);
            default -> new OlxUnexpectedException("OLX_UNEXPECTED_ERROR", fallbackMessage, response.statusCode(), reason);
        };
    }

    private boolean shouldRetry(int httpStatus) {
        return httpStatus == 429 || httpStatus >= 500;
    }

    private void sleep(long millis) {
        try {
            sleeper.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new OlxUnexpectedException("OLX_RETRY_INTERRUPTED", "A comunicacao com a OLX foi interrompida.", 500, "");
        } catch (Exception exception) {
            throw new OlxUnexpectedException("OLX_RETRY_INTERRUPTED", "A comunicacao com a OLX foi interrompida.", 500, "");
        }
    }

    private String buildForm(Map<String, String> fields) {
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            parts.add(urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()));
        }
        return String.join("&", parts);
    }

    private String sanitize(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            return "";
        }
        String sanitized = value
                .replaceAll("(?i)(\"access_token\"\\s*:\\s*\")[^\"]+(\")", "$1***$2")
                .replaceAll("(?i)(\"client_secret\"\\s*:\\s*\")[^\"]+(\")", "$1***$2")
                .replaceAll("(?i)(\"token\"\\s*:\\s*\")[^\"]+(\")", "$1***$2");
        return sanitized.length() > 2_000 ? sanitized.substring(0, 2_000) : sanitized;
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new OlxValidationException(message, 400, "INVALID_REQUEST");
        }
        return normalized;
    }

    private String escapeJson(String value) {
        return safe(value).replace("\\", "\\\\").replace("\"", "\\\"");
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

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    @FunctionalInterface
    interface HttpRequestExecutor {
        HttpResponse<String> send(HttpRequest request) throws Exception;
    }

    @FunctionalInterface
    interface Sleeper {
        void sleep(long millis) throws Exception;
    }

    public record HttpJsonResponse(int httpStatus, String rawBody) {
    }
}
