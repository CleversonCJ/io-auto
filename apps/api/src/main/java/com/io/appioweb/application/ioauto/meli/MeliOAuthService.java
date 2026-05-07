package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliOAuthStateStore;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class MeliOAuthService {

    private static final Logger log = LoggerFactory.getLogger(MeliOAuthService.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final MeliProperties properties;
    private final MeliOAuthStateStore stateStore;
    private final MeliAccountService accountService;
    private final MeliTokenService tokenService;
    private final RestClient restClient;
    private final String publicAppUrl;

    public MeliOAuthService(
            MeliProperties properties,
            MeliOAuthStateStore stateStore,
            MeliAccountService accountService,
            MeliTokenService tokenService,
            @Qualifier("meliRestClient") RestClient restClient,
            @Value("${APP_PUBLIC_URL:http://localhost:3000}") String publicAppUrl
    ) {
        this.properties = properties;
        this.stateStore = stateStore;
        this.accountService = accountService;
        this.tokenService = tokenService;
        this.restClient = restClient;
        this.publicAppUrl = trimTrailingSlash(publicAppUrl == null ? "" : publicAppUrl.trim(), "http://localhost:3000");
    }

    public AuthorizationUrlResponse buildAuthorizationUrl(UUID companyId) {
        properties.validateConfigured();
        String state = stateStore.create(companyId);
        Map<String, String> query = new LinkedHashMap<>();
        query.put("response_type", "code");
        query.put("client_id", properties.getClientId());
        query.put("redirect_uri", properties.getRedirectUri());
        query.put("state", state);
        log.info("MELI OAuth authorization requested companyId={} redirectUri={} state={}", companyId, properties.getRedirectUri(), shorten(state));
        return new AuthorizationUrlResponse(
                properties.getAuthBaseUrl() + "/authorization?" + buildQuery(query),
                state
        );
    }

    public MeliAccountService.MeliConnectionSnapshot handleCallback(String code, String state) {
        properties.validateConfigured();
        log.info("MELI OAuth callback received state={} hasCode={}", shorten(state), !safe(code).isBlank());
        if (safe(code).isBlank()) {
            throw new BusinessException("MELI_OAUTH_CODE_INVALID", "O Mercado Livre nao retornou o codigo de autorizacao.");
        }
        MeliOAuthStateStore.StatePayload payload = stateStore.consume(state);
        MeliTokenService.RawResponse tokenResponse = tokenService.executeTokenRequest(Map.of(
                "grant_type", "authorization_code",
                "client_id", properties.getClientId(),
                "client_secret", properties.getClientSecret(),
                "code", code.trim(),
                "redirect_uri", properties.getRedirectUri()
        ));
        JsonNode tokenRoot = parseJson(tokenResponse.rawBody(), "MELI_OAUTH_CODE_EXCHANGE_FAILED", "Resposta invalida ao concluir OAuth Mercado Livre.");
        if (tokenResponse.httpStatus() >= 400) {
            log.warn("MELI OAuth token exchange rejected companyId={} state={} status={}", payload.companyId(), shorten(state), tokenResponse.httpStatus());
            throw new BusinessException(
                    "MELI_OAUTH_CODE_EXCHANGE_FAILED",
                    tokenService.resolveOAuthErrorMessage(tokenRoot, "Nao foi possivel concluir a conexao com o Mercado Livre.")
            );
        }

        String accessToken = text(tokenRoot, "access_token");
        String refreshToken = text(tokenRoot, "refresh_token");
        Long userId = longValue(tokenRoot, "user_id");
        JsonNode me = fetchCurrentUser(accessToken);
        String nickname = firstNonBlank(text(me, "nickname"), text(tokenRoot, "nickname"));
        String siteId = firstNonBlank(text(me, "site_id"), properties.getSiteId());
        Instant tokenExpiresAt = tokenService.resolveTokenExpiry(tokenRoot);

        accountService.saveConnection(
                payload.companyId(),
                userId,
                nickname,
                siteId,
                accessToken,
                refreshToken,
                text(tokenRoot, "token_type"),
                tokenService.integer(tokenRoot, "expires_in"),
                tokenExpiresAt,
                text(tokenRoot, "scope")
        );
        log.info("MELI OAuth connected companyId={} meliUserId={} nickname={}", payload.companyId(), userId, nickname);
        return accountService.getStatus(payload.companyId());
    }

    public String buildFrontendRedirect(boolean success, String message) {
        String status = success ? "success" : "error";
        return publicAppUrl
                + "/protected/integracoes?provider=mercadolivre&status="
                + urlEncode(status)
                + "&message="
                + urlEncode(safe(message));
    }

    private JsonNode fetchCurrentUser(String accessToken) {
        return restClient.method(HttpMethod.GET)
                .uri("/users/me")
                .headers(headers -> headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .exchange((request, response) -> parseJson(
                        StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8),
                        "MELI_USERS_ME_INVALID",
                        "Nao foi possivel carregar os dados da conta Mercado Livre."
                ));
    }

    private JsonNode parseJson(String rawBody, String code, String message) {
        try {
            String source = rawBody == null || rawBody.isBlank() ? "{}" : rawBody;
            return OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            throw new BusinessException(code, message);
        }
    }

    private Long longValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        return value.asLong();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : safe(value.asText(""));
    }

    private String buildQuery(Map<String, String> query) {
        StringBuilder builder = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, String> entry : query.entrySet()) {
            if (!first) {
                builder.append("&");
            }
            first = false;
            builder.append(urlEncode(entry.getKey())).append("=").append(urlEncode(entry.getValue()));
        }
        return builder.toString();
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String trimTrailingSlash(String value, String fallback) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            normalized = fallback;
        }
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
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

    private String shorten(String value) {
        String normalized = safe(value);
        if (normalized.length() <= 8) {
            return normalized;
        }
        return normalized.substring(0, 8) + "...";
    }

    public record AuthorizationUrlResponse(String url, String state) {
    }
}
