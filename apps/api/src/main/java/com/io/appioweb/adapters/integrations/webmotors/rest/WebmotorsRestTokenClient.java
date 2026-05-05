package com.io.appioweb.adapters.integrations.webmotors.rest;

import com.io.appioweb.adapters.integrations.webmotors.WebmotorsPayloadSanitizer;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebmotorsRestTokenClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final Map<String, CachedToken> cache = new ConcurrentHashMap<>();
    private final HttpRequestExecutor httpRequestExecutor;

    @Autowired
    public WebmotorsRestTokenClient() {
        this(request -> HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()));
    }

    WebmotorsRestTokenClient(HttpRequestExecutor httpRequestExecutor) {
        this.httpRequestExecutor = httpRequestExecutor;
    }

    public WebmotorsTransportResult<WebmotorsRestAccessToken> getAccessToken(WebmotorsCredentialSnapshot credentials) {
        String cacheKey = credentials.companyId() + "::" + credentials.storeKey();
        CachedToken cached = cache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(Instant.now().plusSeconds(30))) {
            return new WebmotorsTransportResult<>(
                    new WebmotorsRestAccessToken(cached.accessToken(), cached.expiresAt().getEpochSecond() - Instant.now().getEpochSecond()),
                    200,
                    "",
                    ""
            );
        }

        try {
            String requestBody = OBJECT_MAPPER.writeValueAsString(Map.of(
                    "username", require(credentials.restUsername(), "Configure o usuario REST da Webmotors."),
                    "password", require(credentials.restPassword(), "Configure a senha REST da Webmotors.")
            ));
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(resolveLoginUrl(credentials)))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(20))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody));
            if (safe(credentials.restClientId()).isBlank() == false) {
                requestBuilder.header("client_id", safe(credentials.restClientId()));
            }
            if (safe(credentials.restClientSecret()).isBlank() == false) {
                String authorization = Base64.getEncoder().encodeToString((safe(credentials.restClientId()) + ":" + safe(credentials.restClientSecret()))
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                requestBuilder.header("Authorization", "Basic " + authorization);
            }

            HttpResponse<String> response = httpRequestExecutor.send(requestBuilder.build());
            if (response.statusCode() >= 400) {
                throw new BusinessException("WEBMOTORS_REST_TOKEN_FAILED", "Nao foi possivel obter o access token da Webmotors.");
            }
            JsonNode root = OBJECT_MAPPER.readTree(response.body());
            String accessToken = firstNonBlank(
                    root.path("access_token").asText(""),
                    root.path("accessToken").asText(""),
                    root.path("token").asText(""),
                    root.path("data").path("access_token").asText(""),
                    root.path("data").path("accessToken").asText(""),
                    root.path("data").path("token").asText("")
            );
            long expiresIn = Math.max(60L, root.path("expires_in").asLong(3600L));
            if (accessToken.isBlank()) {
                throw new BusinessException("WEBMOTORS_REST_TOKEN_MISSING", "A Webmotors nao retornou um access token valido.");
            }
            cache.put(cacheKey, new CachedToken(accessToken, Instant.now().plusSeconds(expiresIn)));
            return new WebmotorsTransportResult<>(
                    new WebmotorsRestAccessToken(accessToken, expiresIn),
                    response.statusCode(),
                    WebmotorsPayloadSanitizer.sanitize(requestBody),
                    WebmotorsPayloadSanitizer.sanitize(response.body())
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_REST_TOKEN_FAILED", "Nao foi possivel obter o access token da Webmotors.");
        }
    }

    public void invalidate(java.util.UUID companyId, String storeKey) {
        cache.remove(companyId + "::" + safe(storeKey));
    }

    private String resolveLoginUrl(WebmotorsCredentialSnapshot credentials) {
        String explicit = safe(credentials.restTokenUrl());
        if (explicit.isBlank() == false) {
            return explicit;
        }
        String base = safe(credentials.restApiBaseUrl());
        if (base.isBlank()) {
            throw new BusinessException("WEBMOTORS_REST_CONFIG_MISSING", "Configure a URL de login REST da Webmotors.");
        }
        return appendPath(base, "/login");
    }

    private String appendPath(String base, String suffix) {
        String normalizedBase = safe(base);
        if (normalizedBase.endsWith(suffix)) {
            return normalizedBase;
        }
        if (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        return normalizedBase + suffix;
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("WEBMOTORS_REST_CONFIG_MISSING", message);
        }
        return normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safe(value);
            if (normalized.isBlank() == false) {
                return normalized;
            }
        }
        return "";
    }

    @FunctionalInterface
    interface HttpRequestExecutor {
        HttpResponse<String> send(HttpRequest request) throws Exception;
    }

    private record CachedToken(String accessToken, Instant expiresAt) {
    }
}
