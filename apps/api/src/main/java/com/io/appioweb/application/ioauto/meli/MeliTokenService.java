package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class MeliTokenService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Duration REFRESH_THRESHOLD = Duration.ofMinutes(10);

    private final MeliAccountService accountService;
    private final MeliProperties properties;
    private final RestClient restClient;

    public MeliTokenService(
            MeliAccountService accountService,
            MeliProperties properties,
            @Qualifier("meliRestClient") RestClient restClient
    ) {
        this.accountService = accountService;
        this.properties = properties;
        this.restClient = restClient;
    }

    @Transactional
    public String getValidAccessToken(UUID companyId) {
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        String accessToken = accountService.decryptAccessToken(account);
        Instant expiresAt = account.getTokenExpiresAt();
        if (!accessToken.isBlank() && expiresAt != null && expiresAt.isAfter(Instant.now().plus(REFRESH_THRESHOLD))) {
            return accessToken;
        }
        return refreshAccessToken(companyId);
    }

    @Transactional
    public String refreshAccessToken(UUID companyId) {
        properties.validateConfigured();
        JpaMeliAccountEntity account = accountService.requireActiveAccount(companyId);
        String refreshToken = accountService.decryptRefreshToken(account);
        if (refreshToken.isBlank()) {
            accountService.markIntegrationError(companyId, "Token expirado; reconecte sua conta Mercado Livre.");
            throw new BusinessException("MELI_REFRESH_TOKEN_MISSING", "Token expirado; reconecte sua conta Mercado Livre.");
        }

        RawResponse response = executeTokenRequest(Map.of(
                "grant_type", "refresh_token",
                "client_id", properties.getClientId(),
                "client_secret", properties.getClientSecret(),
                "refresh_token", refreshToken
        ));
        JsonNode root = parseResponse(response.rawBody(), "MELI_REFRESH_FAILED", "Resposta invalida ao renovar token Mercado Livre.");
        if (response.httpStatus() >= 400) {
            String message = resolveOAuthErrorMessage(root, "Token expirado; reconecte sua conta Mercado Livre.");
            accountService.markIntegrationError(companyId, message);
            throw new BusinessException("MELI_REFRESH_FAILED", message);
        }

        String accessToken = text(root, "access_token");
        String nextRefreshToken = firstNonBlank(text(root, "refresh_token"), refreshToken);
        if (accessToken.isBlank() || nextRefreshToken.isBlank()) {
            accountService.markIntegrationError(companyId, "Token expirado; reconecte sua conta Mercado Livre.");
            throw new BusinessException("MELI_REFRESH_FAILED", "Token expirado; reconecte sua conta Mercado Livre.");
        }

        Instant tokenExpiresAt = resolveTokenExpiry(root);
        accountService.saveConnection(
                companyId,
                account.getMeliUserId(),
                account.getNickname(),
                firstNonBlank(text(root, "site_id"), account.getSiteId(), properties.getSiteId()),
                accessToken,
                nextRefreshToken,
                firstNonBlank(text(root, "token_type"), account.getTokenType()),
                integer(root, "expires_in"),
                tokenExpiresAt,
                firstNonBlank(text(root, "scope"), account.getScope())
        );
        accountService.markConnected(companyId, account.getNickname(), account.getMeliUserId());
        return accessToken;
    }

    RawResponse executeTokenRequest(Map<String, String> form) {
        String body = buildForm(form);
        return restClient.method(HttpMethod.POST)
                .uri("/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body)
                .exchange((request, response) -> new RawResponse(
                        response.getStatusCode().value(),
                        StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8)
                ));
    }

    JsonNode parseResponse(String rawBody, String code, String message) {
        try {
            String source = rawBody == null || rawBody.isBlank() ? "{}" : rawBody;
            return OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            throw new BusinessException(code, message);
        }
    }

    Instant resolveTokenExpiry(JsonNode node) {
        Integer expiresIn = integer(node, "expires_in");
        if (expiresIn == null || expiresIn <= 0) {
            return Instant.now().plus(Duration.ofHours(6));
        }
        return Instant.now().plusSeconds(expiresIn);
    }

    Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        return value.isInt() ? value.asInt() : value.asInt(0);
    }

    String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : safe(value.asText(""));
    }

    String resolveOAuthErrorMessage(JsonNode root, String fallback) {
        String error = text(root, "error");
        String description = text(root, "error_description");
        if ("invalid_grant".equalsIgnoreCase(error)) {
            return "Token expirado; reconecte sua conta Mercado Livre.";
        }
        if ("invalid_client".equalsIgnoreCase(error)) {
            return "Credenciais do app Mercado Livre invalidas. Revise MELI_CLIENT_ID e MELI_CLIENT_SECRET.";
        }
        if (!description.isBlank()) {
            return description;
        }
        return fallback;
    }

    private String buildForm(Map<String, String> values) {
        StringBuilder builder = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, String> entry : new LinkedHashMap<>(values).entrySet()) {
            if (!first) {
                builder.append("&");
            }
            first = false;
            builder.append(java.net.URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append("=")
                    .append(java.net.URLEncoder.encode(entry.getValue() == null ? "" : entry.getValue(), StandardCharsets.UTF_8));
        }
        return builder.toString();
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

    public record RawResponse(int httpStatus, String rawBody) {
    }
}
