package com.io.appioweb.adapters.web.onboarding;

import com.io.appioweb.adapters.persistence.auth.JpaUserEntity;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserActivateRequest;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserActivateResponse;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserRegisterRequest;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserRegisterResponse;
import com.io.appioweb.adapters.web.onboarding.dto.PaymentEventRequest;
import com.io.appioweb.adapters.web.onboarding.dto.SendAccessEmailRequest;
import com.io.appioweb.adapters.web.onboarding.dto.SendAccessEmailResponse;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * REST controller for first-user onboarding.
 * Endpoints:
 * - POST /v1/onboarding/first-user/register
 * - POST /v1/onboarding/first-user/activate
 * - POST /v1/onboarding/first-user/send-access-email
 * - POST /v1/onboarding/asaas/payment-event (orchestrates register -> activate -> send-access-email)
 */
@RestController
@RequestMapping("/v1/onboarding")
public class FirstUserOnboardingController {

    private static final Logger log = LoggerFactory.getLogger(FirstUserOnboardingController.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final FirstUserOnboardingService onboardingService;
    private final UserRepositoryJpa userRepo;

    public FirstUserOnboardingController(FirstUserOnboardingService onboardingService, UserRepositoryJpa userRepo) {
        this.onboardingService = onboardingService;
        this.userRepo = userRepo;
    }

    @PostMapping("/first-user/register")
    public ResponseEntity<FirstUserRegisterResponse> register(@Valid @RequestBody FirstUserRegisterRequest request) {
        log.info("[OnboardingController] POST /first-user/register - idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        FirstUserRegisterResponse response = onboardingService.register(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/first-user/activate")
    public ResponseEntity<FirstUserActivateResponse> activate(@Valid @RequestBody FirstUserActivateRequest request) {
        log.info("[OnboardingController] POST /first-user/activate - idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        FirstUserActivateResponse response = onboardingService.activate(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/first-user/send-access-email")
    public ResponseEntity<SendAccessEmailResponse> sendAccessEmail(@Valid @RequestBody SendAccessEmailRequest request) {
        log.info("[OnboardingController] POST /first-user/send-access-email - idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        SendAccessEmailResponse response = onboardingService.sendAccessEmail(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/asaas/payment-event")
    public ResponseEntity<Map<String, Object>> handlePaymentEvent(
            @RequestHeader(name = "x-asaas-forwarded-app", required = false) String forwardedApp,
            @RequestBody JsonNode rawRequest
    ) {
        verifyForwardedApp(forwardedApp);
        if (rawRequest == null || rawRequest.isMissingNode() || rawRequest.isNull()) {
            throw new BusinessException("ONBOARDING_INVALID_PAYLOAD", "Payload de payment-event vazio.");
        }

        String receivedEvent = firstNonBlank(
                text(rawRequest, "eventType"),
                text(rawRequest, "event"),
                text(rawRequest.path("payment"), "status")
        ).toUpperCase(Locale.ROOT);
        if (!eventShouldActivateAccount(receivedEvent)) {
            Map<String, Object> ignored = new LinkedHashMap<>();
            ignored.put("ok", true);
            ignored.put("ignored", true);
            ignored.put("event", receivedEvent);
            return ResponseEntity.ok(ignored);
        }

        PaymentEventRequest request = normalizePaymentEventRequest(rawRequest);
        log.info("[OnboardingController] POST /asaas/payment-event - idempotencyKey={}", request.idempotencyKey());

        String payloadJson = toJson(rawRequest);
        String baseKey = request.idempotencyKey();

        FirstUserRegisterResponse registerResponse = new FirstUserRegisterResponse(null, null, false, "INACTIVE");
        boolean registerAttempted = false;

        if (hasCustomerIdentityForRegister(request)) {
            registerAttempted = true;
            FirstUserRegisterRequest registerRequest = mapToRegisterRequest(request, baseKey);
            registerResponse = onboardingService.register(registerRequest, payloadJson);
        } else {
            log.info("[OnboardingController] Register skipped for key={} because customer identity is missing in payload", baseKey);
        }

        FirstUserActivateRequest activateRequest = mapToActivateRequest(request, baseKey);
        FirstUserActivateResponse activateResponse;
        try {
            activateResponse = onboardingService.activate(activateRequest, payloadJson);
        } catch (BusinessException e) {
            if ("ONBOARDING_INVALID_PAYMENT_STATUS".equals(e.code())) {
                Map<String, Object> notActivated = new LinkedHashMap<>();
                notActivated.put("registered", registerAttempted);
                notActivated.put("activated", false);
                notActivated.put("emailSent", false);
                notActivated.put("companyId", registerResponse.companyId() != null ? registerResponse.companyId().toString() : "");
                notActivated.put("userId", registerResponse.userId() != null ? registerResponse.userId().toString() : "");
                notActivated.put("message", e.getMessage());
                return ResponseEntity.ok(notActivated);
            }
            throw e;
        }

        SendAccessEmailResponse emailResponse = new SendAccessEmailResponse(false, "");
        String emailMessage = "";
        if (activateResponse.activated() || activateResponse.alreadyActive()) {
            try {
                Optional<SendAccessEmailRequest> maybeEmailRequest =
                        mapToEmailRequest(request, registerResponse, activateResponse, baseKey);
                if (maybeEmailRequest.isPresent()) {
                    emailResponse = onboardingService.sendAccessEmail(maybeEmailRequest.get(), payloadJson);
                } else {
                    emailMessage = "Conta ativada, mas sem email no payload e sem email do usuario para envio.";
                    log.warn("[OnboardingController] {}", emailMessage);
                }
            } catch (Exception e) {
                emailMessage = normalizeText(e.getMessage(), "Falha ao enviar email de acesso.");
                log.error("[OnboardingController] Failed to send access email (non-blocking): {}", e.getMessage());
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("registered", registerAttempted);
        response.put("activated", activateResponse.activated());
        response.put("alreadyActive", activateResponse.alreadyActive());
        response.put("emailSent", emailResponse.emailSent());
        response.put(
                "companyId",
                activateResponse.companyId() != null
                        ? activateResponse.companyId().toString()
                        : (registerResponse.companyId() != null ? registerResponse.companyId().toString() : "")
        );
        response.put(
                "userId",
                activateResponse.userId() != null
                        ? activateResponse.userId().toString()
                        : (registerResponse.userId() != null ? registerResponse.userId().toString() : "")
        );
        response.put("timestamp", Instant.now().toString());
        if (!emailMessage.isBlank()) {
            response.put("message", emailMessage);
        }
        return ResponseEntity.ok(response);
    }

    private void verifyForwardedApp(String forwardedApp) {
        if (forwardedApp == null || !"io_auto".equalsIgnoreCase(forwardedApp.trim())) {
            throw new AccessDeniedException("Evento encaminhado para o aplicativo incorreto");
        }
    }

    private boolean eventShouldActivateAccount(String eventType) {
        return "PAYMENT_CONFIRMED".equals(eventType)
                || "PAYMENT_RECEIVED".equals(eventType)
                || "CONFIRMED".equals(eventType)
                || "RECEIVED".equals(eventType)
                || "RECEIVED_IN_CASH".equals(eventType);
    }

    private FirstUserRegisterRequest mapToRegisterRequest(PaymentEventRequest event, String baseKey) {
        PaymentEventRequest.Customer c = event.customer();
        PaymentEventRequest.BillingInfo b = event.billing();

        return new FirstUserRegisterRequest(
                baseKey + ":register",
                new FirstUserRegisterRequest.FirstUserRegistration(
                        null,
                        c.razaoSocial(),
                        c.nomeFantasia(),
                        c.companyEmail(),
                        null,
                        c.cnpj(),
                        c.whatsappNumber(),
                        c.endereco(),
                        c.cidade(),
                        c.uf(),
                        c.cep(),
                        c.responsavelNome(),
                        c.responsavelEmail(),
                        c.responsavelWhatsapp(),
                        "INACTIVE"
                ),
                new FirstUserRegisterRequest.Comercial(
                        b.valorPagoCliente(),
                        b.recorrenciaPagamento(),
                        b.dataAssinatura(),
                        b.origem()
                ),
                new FirstUserRegisterRequest.Billing(
                        b.paymentId(),
                        b.subscriptionId(),
                        b.planName()
                )
        );
    }

    private FirstUserActivateRequest mapToActivateRequest(PaymentEventRequest event, String baseKey) {
        PaymentEventRequest.BillingInfo b = event.billing();
        return new FirstUserActivateRequest(
                baseKey + ":activate",
                b.paymentId(),
                b.subscriptionId(),
                event.paymentStatus() != null ? event.paymentStatus() : event.eventType(),
                b.valorPagoCliente(),
                b.recorrenciaPagamento(),
                b.dataAssinatura(),
                b.origem(),
                b.planName()
        );
    }

    private Optional<SendAccessEmailRequest> mapToEmailRequest(
            PaymentEventRequest event,
            FirstUserRegisterResponse registerResponse,
            FirstUserActivateResponse activateResponse,
            String baseKey
    ) {
        PaymentEventRequest.Customer c = event.customer();
        String userId = activateResponse.userId() != null
                ? activateResponse.userId().toString()
                : (registerResponse.userId() != null ? registerResponse.userId().toString() : "");
        String companyId = activateResponse.companyId() != null
                ? activateResponse.companyId().toString()
                : (registerResponse.companyId() != null ? registerResponse.companyId().toString() : "");

        String email = c != null ? normalizeText(c.responsavelEmail()) : "";
        String nome = c != null ? normalizeText(c.responsavelNome()) : "";

        if (email.isBlank() && !userId.isBlank()) {
            UUID parsedUserId = parseUuidOrNull(userId);
            if (parsedUserId != null) {
                JpaUserEntity user = userRepo.findById(parsedUserId).orElse(null);
                if (user != null) {
                    email = normalizeText(user.getEmail());
                    if (nome.isBlank()) {
                        nome = normalizeText(user.getFullName(), normalizeText(user.getNome()));
                    }
                }
            }
        }

        if (email.isBlank()) {
            return Optional.empty();
        }

        return Optional.of(new SendAccessEmailRequest(
                baseKey + ":email",
                userId,
                companyId,
                email,
                nome,
                null,
                null,
                null
        ));
    }

    private PaymentEventRequest normalizePaymentEventRequest(JsonNode rawRequest) {
        if (rawRequest == null || rawRequest.isMissingNode() || rawRequest.isNull()) {
            throw new BusinessException("ONBOARDING_INVALID_PAYLOAD", "Payload de payment-event vazio.");
        }

        JsonNode paymentNode = rawRequest.path("payment");
        JsonNode customerNode = rawRequest.path("customer");
        JsonNode billingNode = rawRequest.path("billing");

        String eventType = firstNonBlank(
                text(rawRequest, "eventType"),
                text(rawRequest, "event"),
                text(paymentNode, "status"),
                "UNKNOWN"
        );

        String paymentId = firstNonBlank(text(billingNode, "paymentId"), text(paymentNode, "id"));
        String subscriptionId = firstNonBlank(text(billingNode, "subscriptionId"), text(paymentNode, "subscription"));

        String idempotencyKey = normalizeText(text(rawRequest, "idempotencyKey"));
        if (idempotencyKey.isBlank()) {
            idempotencyKey = "asaas:" + eventType + ":" + firstNonBlank(text(rawRequest, "id"), paymentId, subscriptionId, Instant.now().toString());
            idempotencyKey = idempotencyKey.replaceAll("\\s+", "_");
        }

        String paymentStatus = firstNonBlank(
                text(rawRequest, "paymentStatus"),
                text(paymentNode, "status"),
                eventType
        );

        PaymentEventRequest.Customer customer = new PaymentEventRequest.Customer(
                firstNonBlank(text(customerNode, "razaoSocial"), text(rawRequest, "razaoSocial")),
                firstNonBlank(text(customerNode, "nomeFantasia"), text(rawRequest, "nomeFantasia")),
                firstNonBlank(text(customerNode, "companyEmail"), text(rawRequest, "companyEmail")),
                firstNonBlank(text(customerNode, "cnpj"), text(rawRequest, "cnpj")),
                firstNonBlank(text(customerNode, "whatsappNumber"), text(rawRequest, "whatsappNumber")),
                firstNonBlank(text(customerNode, "endereco"), text(rawRequest, "endereco")),
                firstNonBlank(text(customerNode, "cidade"), text(rawRequest, "cidade")),
                firstNonBlank(text(customerNode, "uf"), text(rawRequest, "uf")),
                firstNonBlank(text(customerNode, "cep"), text(rawRequest, "cep")),
                firstNonBlank(
                        text(customerNode, "responsavelNome"),
                        text(rawRequest, "responsavelNome"),
                        text(paymentNode, "description"),
                        "Cliente"
                ),
                firstNonBlank(text(customerNode, "responsavelEmail"), text(rawRequest, "responsavelEmail")),
                firstNonBlank(
                        text(customerNode, "responsavelWhatsapp"),
                        text(rawRequest, "responsavelWhatsapp"),
                        text(customerNode, "whatsappNumber")
                )
        );

        PaymentEventRequest.BillingInfo billing = new PaymentEventRequest.BillingInfo(
                paymentId,
                subscriptionId,
                firstNonNull(numberNode(billingNode, "valorPagoCliente"), numberNode(paymentNode, "value")),
                firstNonBlank(
                        text(billingNode, "recorrenciaPagamento"),
                        recurrenceFromCycle(firstNonBlank(text(rawRequest, "cycle"), text(paymentNode, "cycle"))),
                        "mensal"
                ),
                firstNonBlank(
                        text(billingNode, "dataAssinatura"),
                        dateOnly(text(paymentNode, "confirmedDate")),
                        dateOnly(text(paymentNode, "clientPaymentDate")),
                        dateOnly(text(paymentNode, "paymentDate")),
                        dateOnly(text(paymentNode, "dateCreated"))
                ),
                firstNonBlank(
                        text(billingNode, "origem"),
                        text(rawRequest, "origem"),
                        text(paymentNode, "externalReference"),
                        "asaas-webhook"
                ),
                firstNonBlank(text(billingNode, "planName"), text(rawRequest, "planName"), text(paymentNode, "description"))
        );

        return new PaymentEventRequest(idempotencyKey, eventType, paymentStatus, customer, billing);
    }

    private boolean hasCustomerIdentityForRegister(PaymentEventRequest request) {
        if (request == null || request.customer() == null) {
            return false;
        }

        return !normalizeText(request.customer().responsavelNome()).isBlank()
                && !normalizeText(request.customer().responsavelEmail()).isBlank();
    }

    private Number numberNode(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }

        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.decimalValue();
        }

        String raw = normalizeText(value.asText());
        if (raw.isBlank()) {
            return null;
        }

        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String dateOnly(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return "";
        }
        return normalized.substring(0, Math.min(10, normalized.length()));
    }

    private String recurrenceFromCycle(String cycle) {
        String normalized = normalizeText(cycle).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WEEKLY" -> "semanal";
            case "BIWEEKLY" -> "quinzenal";
            case "QUARTERLY" -> "trimestral";
            case "SEMIANNUALLY" -> "semestral";
            case "YEARLY" -> "anual";
            default -> "";
        };
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }

        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return "";
        }

        return normalizeText(value.asText());
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        if (values == null) {
            return null;
        }

        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            String normalized = normalizeText(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private UUID parseUuidOrNull(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String toJson(Object obj) {
        try {
            return OBJECT_MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
