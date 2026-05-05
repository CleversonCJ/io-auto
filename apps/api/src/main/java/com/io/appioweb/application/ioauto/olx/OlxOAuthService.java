package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.integrations.olx.OlxOAuthStateCodec;
import com.io.appioweb.adapters.integrations.olx.OlxProperties;
import com.io.appioweb.adapters.integrations.olx.OlxResponseParser;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class OlxOAuthService {

    private final OlxProperties properties;
    private final OlxOAuthStateCodec stateCodec;
    private final OlxApiClient apiClient;
    private final OlxResponseParser responseParser;
    private final OlxAccountService accountService;
    private final String publicAppUrl;

    public OlxOAuthService(
            OlxProperties properties,
            OlxOAuthStateCodec stateCodec,
            OlxApiClient apiClient,
            OlxResponseParser responseParser,
            OlxAccountService accountService,
            @Value("${APP_PUBLIC_URL:http://localhost:3000}") String publicAppUrl
    ) {
        this.properties = properties;
        this.stateCodec = stateCodec;
        this.apiClient = apiClient;
        this.responseParser = responseParser;
        this.accountService = accountService;
        this.publicAppUrl = trimTrailingSlash(publicAppUrl == null ? "" : publicAppUrl.trim(), "http://localhost:3000");
    }

    public AuthorizationUrlResponse buildAuthorizationUrl(UUID companyId) {
        properties.validateOauthConfigured();
        String state = stateCodec.encode(companyId);
        Map<String, String> query = new LinkedHashMap<>();
        query.put("client_id", properties.getClientId());
        query.put("redirect_uri", properties.getRedirectUri());
        query.put("response_type", "code");
        query.put("scope", "autoupload");
        query.put("state", state);
        return new AuthorizationUrlResponse(
                properties.getAuthBaseUrl() + "/oauth?" + buildQuery(query),
                state
        );
    }

    @Transactional
    public OlxAccountService.OlxConnectionSnapshot handleCallback(String code, String state) {
        if (safe(code).isBlank()) {
            throw new BusinessException("OLX_OAUTH_CODE_INVALID", "A OLX nao retornou o codigo de autorizacao.");
        }
        OlxOAuthStateCodec.StatePayload payload = stateCodec.decode(state);
        JsonNode tokenResponse = apiClient.exchangeAuthorizationCode(code);
        String accessToken = text(tokenResponse, "access_token");
        String tokenType = text(tokenResponse, "token_type");
        String scope = firstNonBlank(text(tokenResponse, "scope"), "autoupload");

        String userName = null;
        String userEmail = null;
        try {
            OlxResponseParser.BasicUserInfo userInfo = responseParser.parseBasicUserInfo(apiClient.basicUserInfo(accessToken).toString());
            userName = blankToNull(userInfo.userName());
            userEmail = blankToNull(userInfo.userEmail());
        } catch (Exception ignored) {
            // The basic profile endpoint is best-effort only.
        }
        return accountService.saveConnection(payload.companyId(), accessToken, tokenType, scope, userName, userEmail);
    }

    public String buildFrontendRedirect(boolean success, String message) {
        String status = success ? "success" : "error";
        return publicAppUrl
                + "/protected/integracoes?provider=olx&status=" + urlEncode(status)
                + "&message=" + urlEncode(safe(message));
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

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : safe(value.asText(""));
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

    private String blankToNull(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String trimTrailingSlash(String value, String fallback) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            normalized = fallback;
        }
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record AuthorizationUrlResponse(String url, String state) {
    }
}
