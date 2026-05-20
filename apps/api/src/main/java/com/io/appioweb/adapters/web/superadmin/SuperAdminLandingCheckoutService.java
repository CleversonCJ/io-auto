package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class SuperAdminLandingCheckoutService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder().build();

    private final CompanyRepositoryJpa companies;
    private final String checkoutEndpointUrl;
    private final String checkoutBearerToken;

    public SuperAdminLandingCheckoutService(
            CompanyRepositoryJpa companies,
            @Value("${IOAUTO_LANDING_CHECKOUT_URL:https://ioauto.com.br/api/checkout/link}") String checkoutEndpointUrl,
            @Value("${IOAUTO_LANDING_CHECKOUT_BEARER:}") String checkoutBearerToken
    ) {
        this.companies = companies;
        this.checkoutEndpointUrl = normalizeText(checkoutEndpointUrl);
        this.checkoutBearerToken = normalizeText(checkoutBearerToken);
    }

    @Transactional
    public ManualCheckoutLinkResult createAndStoreManualCheckoutLink(UUID companyId, ManualCheckoutLinkCommand command) {
        if (checkoutEndpointUrl.isBlank()) {
            throw new BusinessException("MANUAL_CHECKOUT_NOT_CONFIGURED", "URL da landing para gerar checkout não foi configurada.");
        }
        if (checkoutBearerToken.isBlank()) {
            throw new BusinessException("MANUAL_CHECKOUT_NOT_CONFIGURED", "Token da landing para gerar checkout não foi configurado.");
        }

        JpaCompanyEntity company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada."));

        String planName = normalizeText(command.planName());
        if (planName.isBlank()) {
            throw new BusinessException("MANUAL_CHECKOUT_PLAN_REQUIRED", "Informe o nome do plano para gerar o checkout.");
        }

        BigDecimal value = normalizeValue(command.value());
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("MANUAL_CHECKOUT_VALUE_INVALID", "O valor do plano personalizado deve ser maior que zero.");
        }

        String billingPeriod = normalizeBillingPeriod(command.billingPeriod());
        String origin = normalizeText(command.origem(), "superadmin-manual:" + companyId);
        int expiresInMinutes = normalizeExpiresInMinutes(command.expiresInMinutes());

        ObjectNode payload = OBJECT_MAPPER.createObjectNode();
        payload.put("value", value);
        payload.put("planName", planName);
        payload.put("billingPeriod", billingPeriod);
        payload.put("origem", origin);
        payload.put("expiresInMinutes", expiresInMinutes);

        JsonNode responseBody = executeCheckoutRequest(payload);
        String paymentUrl = firstNonBlank(
                text(responseBody, "checkoutUrl"),
                text(responseBody, "paymentUrl"),
                text(responseBody, "url"),
                text(responseBody, "link"),
                text(responseBody.path("data"), "checkoutUrl"),
                text(responseBody.path("data"), "paymentUrl"),
                text(responseBody.path("data"), "url"),
                text(responseBody.path("data"), "link")
        );

        if (paymentUrl.isBlank()) {
            throw new BusinessException("MANUAL_CHECKOUT_LINK_MISSING", "A landing não retornou o link de pagamento.");
        }

        String reference = firstNonBlank(
                text(responseBody, "checkoutId"),
                text(responseBody, "id"),
                text(responseBody, "reference"),
                text(responseBody.path("data"), "checkoutId"),
                text(responseBody.path("data"), "id"),
                text(responseBody.path("data"), "reference")
        );

        Instant expiresAt = parseInstant(firstNonBlank(
                text(responseBody, "expiresAt"),
                text(responseBody.path("data"), "expiresAt")
        ));

        Instant now = Instant.now();
        company.setManualCheckoutUrl(paymentUrl);
        company.setManualCheckoutReference(reference);
        company.setManualCheckoutCreatedAt(now);
        company.setManualCheckoutExpiresAt(expiresAt);
        company.setUpdatedAt(now);
        companies.save(company);

        return new ManualCheckoutLinkResult(companyId, paymentUrl, reference, expiresAt);
    }

    private JsonNode executeCheckoutRequest(ObjectNode payload) {
        String payloadJson;
        try {
            payloadJson = OBJECT_MAPPER.writeValueAsString(payload);
        } catch (Exception exception) {
            throw new BusinessException("MANUAL_CHECKOUT_PAYLOAD_INVALID", "Falha ao preparar os dados para geração do checkout.");
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(checkoutEndpointUrl))
                .header("Authorization", "Bearer " + checkoutBearerToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                .build();

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception exception) {
            throw new BusinessException("MANUAL_CHECKOUT_REQUEST_FAILED", "Não foi possível conectar com a landing para gerar o checkout.");
        }

        JsonNode body = parseJson(response.body());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String detail = firstNonBlank(
                    text(body, "message"),
                    text(body, "error"),
                    text(body.path("data"), "message")
            );
            throw new BusinessException(
                    "MANUAL_CHECKOUT_REQUEST_FAILED",
                    detail.isBlank()
                            ? "A landing recusou a geração do checkout para o plano personalizado."
                            : detail
            );
        }
        return body;
    }

    private JsonNode parseJson(String raw) {
        try {
            return OBJECT_MAPPER.readTree(raw == null ? "{}" : raw);
        } catch (Exception ignored) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    private String text(JsonNode node, String key) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        JsonNode value = node.path(key);
        if (value.isMissingNode() || value.isNull()) return "";
        return normalizeText(value.asText());
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? normalizeText(fallback) : normalized;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            String normalized = normalizeText(value);
            if (!normalized.isBlank()) return normalized;
        }
        return "";
    }

    private BigDecimal normalizeValue(BigDecimal value) {
        if (value == null) return BigDecimal.ZERO;
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeBillingPeriod(String raw) {
        String normalized = normalizeText(raw).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) return "monthly";
        if ("monthly".equals(normalized) || "mensal".equals(normalized)) return "monthly";
        if ("annual".equals(normalized) || "yearly".equals(normalized) || "anual".equals(normalized)) return "annual";
        if ("quarterly".equals(normalized) || "trimestral".equals(normalized)) return "quarterly";
        if ("semiannually".equals(normalized) || "semestral".equals(normalized)) return "semiannually";
        return normalized;
    }

    private int normalizeExpiresInMinutes(Integer raw) {
        if (raw == null) return 1440;
        if (raw < 15) return 15;
        return Math.min(raw, 7 * 24 * 60);
    }

    private Instant parseInstant(String raw) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) return null;
        try {
            return Instant.parse(normalized);
        } catch (Exception ignored) {
            return null;
        }
    }

    public record ManualCheckoutLinkCommand(
            BigDecimal value,
            String planName,
            String billingPeriod,
            String origem,
            Integer expiresInMinutes
    ) {
    }

    public record ManualCheckoutLinkResult(
            UUID companyId,
            String checkoutUrl,
            String checkoutReference,
            Instant expiresAt
    ) {
    }
}
