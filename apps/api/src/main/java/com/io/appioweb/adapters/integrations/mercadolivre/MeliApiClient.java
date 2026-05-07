package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.application.ioauto.meli.MeliTokenService;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Component
public class MeliApiClient {

    private static final Logger log = LoggerFactory.getLogger(MeliApiClient.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final List<Long> DEFAULT_BACKOFF_MS = List.of(400L, 900L, 1500L);

    private final RestClient restClient;
    private final MeliTokenService tokenService;

    public MeliApiClient(
            @Qualifier("meliRestClient") RestClient restClient,
            MeliTokenService tokenService
    ) {
        this.restClient = restClient;
        this.tokenService = tokenService;
    }

    public JsonResponse get(String path, UUID companyId) {
        return execute(HttpMethod.GET, path, companyId, null, true, false);
    }

    public JsonResponse getPublic(String path) {
        return execute(HttpMethod.GET, path, null, null, false, false);
    }

    public JsonResponse post(String path, UUID companyId, Object body) {
        return execute(HttpMethod.POST, path, companyId, body, true, false);
    }

    public JsonResponse put(String path, UUID companyId, Object body) {
        return execute(HttpMethod.PUT, path, companyId, body, true, false);
    }

    public JsonResponse delete(String path, UUID companyId) {
        return execute(HttpMethod.DELETE, path, companyId, null, true, false);
    }

    private JsonResponse execute(
            HttpMethod method,
            String path,
            UUID companyId,
            Object body,
            boolean authenticated,
            boolean tokenRefreshed
    ) {
        String accessToken = authenticated ? tokenService.getValidAccessToken(companyId) : "";
        MeliApiException lastRetryable = null;

        for (int attempt = 0; attempt < DEFAULT_BACKOFF_MS.size() + 1; attempt++) {
            if (attempt > 0) {
                sleep(DEFAULT_BACKOFF_MS.get(attempt - 1));
            }
            try {
                JsonResponse response = restClient.method(method)
                        .uri(path)
                        .headers(headers -> {
                            if (authenticated) {
                                headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
                            }
                            if (body != null) {
                                headers.setContentType(MediaType.APPLICATION_JSON);
                            }
                        })
                        .body(body == null ? "" : body)
                        .exchange((request, clientResponse) -> {
                            String rawBody = StreamUtils.copyToString(clientResponse.getBody(), StandardCharsets.UTF_8);
                            return new JsonResponse(
                                    parseJson(rawBody),
                                    rawBody,
                                    clientResponse.getStatusCode().value()
                            );
                        });

                if (response.httpStatus() >= 400) {
                    throw mapHttpError(response);
                }
                return response;
            } catch (MeliUnauthorizedException unauthorized) {
                if (authenticated && !tokenRefreshed) {
                    log.info("MELI unauthorized for company {} on path {}, refreshing token and retrying once.", companyId, path);
                    tokenService.refreshAccessToken(companyId);
                    return execute(method, path, companyId, body, true, true);
                }
                throw unauthorized;
            } catch (MeliRateLimitException | MeliUnexpectedException retryable) {
                lastRetryable = retryable;
                if (attempt >= DEFAULT_BACKOFF_MS.size() || !shouldRetry(retryable.httpStatus())) {
                    throw retryable;
                }
            } catch (BusinessException exception) {
                throw exception;
            } catch (Exception exception) {
                if (attempt >= DEFAULT_BACKOFF_MS.size()) {
                    throw new MeliUnexpectedException(
                            "MELI_REQUEST_FAILED",
                            "Nao foi possivel concluir a comunicacao com o Mercado Livre.",
                            500,
                            ""
                    );
                }
            }
        }

        if (lastRetryable != null) {
            throw lastRetryable;
        }
        throw new MeliUnexpectedException(
                "MELI_REQUEST_FAILED",
                "Nao foi possivel concluir a comunicacao com o Mercado Livre.",
                500,
                ""
        );
    }

    private boolean shouldRetry(int httpStatus) {
        return httpStatus == 429 || httpStatus >= 500;
    }

    private JsonNode parseJson(String rawBody) {
        try {
            String source = rawBody == null || rawBody.isBlank() ? "{}" : rawBody;
            return OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            throw new MeliUnexpectedException(
                    "MELI_INVALID_RESPONSE",
                    "O Mercado Livre retornou um JSON invalido.",
                    500,
                    ""
            );
        }
    }

    private MeliApiException mapHttpError(JsonResponse response) {
        JsonNode root = response.body();
        String reason = firstNonBlank(text(root, "error"), text(root, "message"));
        String message = firstNonBlank(text(root, "message"), text(root, "error_description"), text(root, "error"));
        String fallbackMessage = message.isBlank() ? "O Mercado Livre rejeitou a requisicao." : message;
        return switch (response.httpStatus()) {
            case 400 -> new MeliValidationException(fallbackMessage, response.httpStatus(), reason);
            case 401 -> new MeliUnauthorizedException(fallbackMessage, response.httpStatus(), reason);
            case 403 -> new MeliForbiddenException(fallbackMessage, response.httpStatus(), reason);
            case 404 -> new MeliNotFoundException(fallbackMessage, response.httpStatus(), reason);
            case 409 -> new MeliValidationException(fallbackMessage, response.httpStatus(), reason);
            case 429 -> new MeliRateLimitException("O Mercado Livre bloqueou temporariamente a requisicao por excesso de chamadas.", response.httpStatus(), reason);
            default -> new MeliUnexpectedException("MELI_UNEXPECTED_ERROR", fallbackMessage, response.httpStatus(), reason);
        };
    }

    private String text(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? "" : safe(node.asText(""));
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

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new MeliUnexpectedException(
                    "MELI_REQUEST_INTERRUPTED",
                    "A comunicacao com o Mercado Livre foi interrompida.",
                    500,
                    ""
            );
        }
    }

    public record JsonResponse(JsonNode body, String rawBody, int httpStatus) {
    }
}
