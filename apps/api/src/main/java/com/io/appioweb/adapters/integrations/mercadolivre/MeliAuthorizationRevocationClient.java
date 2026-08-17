package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

@Component
public class MeliAuthorizationRevocationClient {

    private static final Logger log = LoggerFactory.getLogger(MeliAuthorizationRevocationClient.class);

    private final RestClient restClient;

    public MeliAuthorizationRevocationClient(@Qualifier("meliRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    public RevocationOutcome revoke(Long userId, String applicationId, String accessToken) {
        if (userId == null || userId <= 0 || safe(applicationId).isBlank() || safe(accessToken).isBlank()) {
            throw new BusinessException(
                    "MELI_REVOCATION_CREDENTIALS_INVALID",
                    "Não foi possível identificar a autorização do Mercado Livre que deve ser revogada."
            );
        }

        try {
            int httpStatus = restClient.method(HttpMethod.DELETE)
                    .uri("/users/{userId}/applications/{applicationId}", userId, applicationId.trim())
                    .headers(headers -> headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken.trim()))
                    .exchange((request, clientResponse) -> {
                        StreamUtils.copyToString(clientResponse.getBody(), StandardCharsets.UTF_8);
                        return clientResponse.getStatusCode().value();
                    });

            if (httpStatus >= 200 && httpStatus < 300) {
                log.info("MELI authorization revoked meliUserId={} applicationId={}", userId, applicationId);
                return RevocationOutcome.REVOKED;
            }
            if (httpStatus == 404) {
                log.info("MELI authorization already absent meliUserId={} applicationId={}", userId, applicationId);
                return RevocationOutcome.ALREADY_REVOKED;
            }
            if (httpStatus == 401) {
                log.info("MELI authorization revocation requires a refreshed token meliUserId={} applicationId={}", userId, applicationId);
                return RevocationOutcome.UNAUTHORIZED;
            }

            log.warn(
                    "MELI authorization revocation rejected meliUserId={} applicationId={} status={}",
                    userId,
                    applicationId,
                    httpStatus
            );
            throw new BusinessException(
                    "MELI_REVOCATION_FAILED",
                    "O Mercado Livre não permitiu revogar a autorização. Tente novamente em instantes."
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("MELI authorization revocation failed meliUserId={} applicationId={} reason={}",
                    userId, applicationId, exception.getMessage(), exception);
            throw new BusinessException(
                    "MELI_REVOCATION_UNAVAILABLE",
                    "Não foi possível comunicar com o Mercado Livre para revogar a autorização. Tente novamente."
            );
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public enum RevocationOutcome {
        REVOKED,
        ALREADY_REVOKED,
        UNAUTHORIZED
    }
}
