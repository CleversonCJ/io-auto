package com.io.appioweb.adapters.integrations.webmotors.rest;

import com.io.appioweb.adapters.integrations.webmotors.WebmotorsPayloadSanitizer;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsInventoryItem;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsInventoryPage;
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
import java.util.ArrayList;
import java.util.List;

@Component
public class WebmotorsInventoryApiClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final HttpRequestExecutor httpRequestExecutor;

    @Autowired
    public WebmotorsInventoryApiClient() {
        this(request -> HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()));
    }

    WebmotorsInventoryApiClient(HttpRequestExecutor httpRequestExecutor) {
        this.httpRequestExecutor = httpRequestExecutor;
    }

    public WebmotorsTransportResult<WebmotorsInventoryPage> fetchInventory(
            WebmotorsCredentialSnapshot credentials,
            WebmotorsRestAccessToken accessToken
    ) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(resolveInventoryUrl(credentials)))
                    .header("client_id", require(credentials.restClientId(), "Configure o client_id REST da Webmotors."))
                    .header("access_token", require(accessToken.accessToken(), "A Webmotors nao retornou um access_token utilizavel."))
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(20))
                    .GET()
                    .build();
            HttpResponse<String> response = httpRequestExecutor.send(request);
            if (response.statusCode() == 401) {
                throw new BusinessException("WEBMOTORS_REST_UNAUTHORIZED", "O access token REST da Webmotors expirou ou foi rejeitado.");
            }
            if (response.statusCode() == 429 || response.statusCode() >= 500) {
                throw new BusinessException("WEBMOTORS_REST_TEMPORARILY_UNAVAILABLE", "A API REST da Webmotors esta indisponivel no momento.");
            }
            if (response.statusCode() >= 400) {
                throw new BusinessException("WEBMOTORS_REST_FETCH_INVENTORY_FAILED", "Nao foi possivel consultar o estoque da Webmotors.");
            }

            JsonNode root = OBJECT_MAPPER.readTree(response.body());
            JsonNode items = resolveItemsNode(root);
            List<WebmotorsInventoryItem> inventory = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode item : items) {
                    inventory.add(new WebmotorsInventoryItem(
                            firstNonBlank(item, "codigoAnuncio", "adId", "id"),
                            firstNonBlank(item, "codigoMarca", "brandId", "brandCode"),
                            firstNonBlank(item, "codigoModelo", "modelId", "modelCode"),
                            firstNonBlank(item, "codigoVersao", "versionId", "versionCode"),
                            firstNonBlank(item, "titulo", "title", "name"),
                            firstNonNullLong(item, "precoVenda", "price", "priceCents"),
                            firstNonNullInteger(item, "quilometragem", "mileage"),
                            firstNonBlank(item, "status", "adStatus"),
                            firstNonBlank(item, "dataInclusao", "createdAt"),
                            firstNonBlank(item, "dataUltimaAlteracao", "updatedAt"),
                            OBJECT_MAPPER.writeValueAsString(item)
                    ));
                }
            }

            WebmotorsInventoryPage page = new WebmotorsInventoryPage(
                    resolveInt(root, "pagina", 1),
                    Math.max(inventory.size(), resolveInt(root, "anunciosPorPagina", inventory.size())),
                    Math.max(inventory.size(), resolveInt(root, "totalAnuncios", inventory.size())),
                    firstNonBlank(root.path("codigoRetorno").asText(""), "0"),
                    inventory,
                    firstNonBlank(root.path("requestId").asText(""), root.path("request_id").asText(""))
            );
            return new WebmotorsTransportResult<>(
                    page,
                    response.statusCode(),
                    "",
                    WebmotorsPayloadSanitizer.sanitize(response.body())
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_REST_FETCH_INVENTORY_FAILED", "Nao foi possivel consultar o estoque da Webmotors.");
        }
    }

    private JsonNode resolveItemsNode(JsonNode root) {
        if (root.isArray()) {
            return root;
        }
        if (root.path("items").isArray()) {
            return root.path("items");
        }
        if (root.path("anuncios").isArray()) {
            return root.path("anuncios");
        }
        if (root.path("data").isArray()) {
            return root.path("data");
        }
        if (root.path("data").path("items").isArray()) {
            return root.path("data").path("items");
        }
        return tools.jackson.databind.node.MissingNode.getInstance();
    }

    private String resolveInventoryUrl(WebmotorsCredentialSnapshot credentials) {
        String url = safe(credentials.restApiBaseUrl());
        if (url.isBlank()) {
            throw new BusinessException("WEBMOTORS_REST_API_BASE_MISSING", "Configure a URL base REST da Webmotors.");
        }
        return url.endsWith("/estoque") ? url : appendPath(url, "/estoque");
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

    private int resolveInt(JsonNode node, String field, int fallback) {
        return node.path(field).canConvertToInt() ? node.path(field).asInt(fallback) : fallback;
    }

    private Long firstNonNullLong(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (value.isMissingNode() || value.isNull()) {
                continue;
            }
            if (value.isNumber()) {
                return value.asLong();
            }
            String raw = safe(value.asText(""));
            if (raw.isBlank() == false) {
                try {
                    return Long.parseLong(raw.replaceAll("[^0-9-]", ""));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }

    private Integer firstNonNullInteger(JsonNode node, String... fields) {
        Long value = firstNonNullLong(node, fields);
        return value == null ? null : value.intValue();
    }

    private String firstNonBlank(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = safe(node.path(field).asText(""));
            if (value.isBlank() == false) {
                return value;
            }
        }
        return "";
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

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    @FunctionalInterface
    interface HttpRequestExecutor {
        HttpResponse<String> send(HttpRequest request) throws Exception;
    }
}
