package com.io.appioweb.adapters.web.onboarding;

import com.io.appioweb.adapters.web.onboarding.dto.*;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;

/**
 * REST controller for the onboarding post-payment flow.
 * <p>
 * Endpoints:
 * <ul>
 *   <li>POST /v1/onboarding/first-user/register</li>
 *   <li>POST /v1/onboarding/first-user/activate</li>
 *   <li>POST /v1/onboarding/first-user/send-access-email</li>
 *   <li>POST /v1/onboarding/asaas/payment-event (simplified)</li>
 * </ul>
 * <p>
 * Authentication is handled by {@code OnboardingSecurityFilter}.
 */
@RestController
@RequestMapping("/v1/onboarding")
public class FirstUserOnboardingController {

    private static final Logger log = LoggerFactory.getLogger(FirstUserOnboardingController.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final FirstUserOnboardingService onboardingService;

    public FirstUserOnboardingController(FirstUserOnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    // ====================================================================
    // 1. REGISTER
    // ====================================================================

    @PostMapping("/first-user/register")
    public ResponseEntity<FirstUserRegisterResponse> register(@Valid @RequestBody FirstUserRegisterRequest request) {
        log.info("[OnboardingController] POST /first-user/register – idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        FirstUserRegisterResponse response = onboardingService.register(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    // ====================================================================
    // 2. ACTIVATE
    // ====================================================================

    @PostMapping("/first-user/activate")
    public ResponseEntity<FirstUserActivateResponse> activate(@Valid @RequestBody FirstUserActivateRequest request) {
        log.info("[OnboardingController] POST /first-user/activate – idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        FirstUserActivateResponse response = onboardingService.activate(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    // ====================================================================
    // 3. SEND ACCESS EMAIL
    // ====================================================================

    @PostMapping("/first-user/send-access-email")
    public ResponseEntity<SendAccessEmailResponse> sendAccessEmail(@Valid @RequestBody SendAccessEmailRequest request) {
        log.info("[OnboardingController] POST /first-user/send-access-email – idempotencyKey={}", request.idempotencyKey());
        String payloadJson = toJson(request);
        SendAccessEmailResponse response = onboardingService.sendAccessEmail(request, payloadJson);
        return ResponseEntity.ok(response);
    }

    // ====================================================================
    // 4. SIMPLIFIED PAYMENT EVENT (orchestrates register → activate → send-access-email)
    // ====================================================================

    @PostMapping("/asaas/payment-event")
    public ResponseEntity<Map<String, Object>> handlePaymentEvent(@Valid @RequestBody PaymentEventRequest request) {
        log.info("[OnboardingController] POST /asaas/payment-event – idempotencyKey={}", request.idempotencyKey());

        String payloadJson = toJson(request);
        String baseKey = request.idempotencyKey();

        // 1. Register
        FirstUserRegisterRequest registerRequest = mapToRegisterRequest(request, baseKey);
        FirstUserRegisterResponse registerResponse = onboardingService.register(registerRequest, payloadJson);

        // 2. Activate
        FirstUserActivateRequest activateRequest = mapToActivateRequest(request, baseKey);
        FirstUserActivateResponse activateResponse;
        try {
            activateResponse = onboardingService.activate(activateRequest, payloadJson);
        } catch (BusinessException e) {
            if ("ONBOARDING_INVALID_PAYMENT_STATUS".equals(e.code())) {
                log.warn("[OnboardingController] Payment event not activatable – status: {}", request.paymentStatus());
                return ResponseEntity.ok(Map.of(
                        "registered", true,
                        "activated", false,
                        "emailSent", false,
                        "companyId", registerResponse.companyId() != null ? registerResponse.companyId().toString() : "",
                        "userId", registerResponse.userId() != null ? registerResponse.userId().toString() : "",
                        "message", e.getMessage()
                ));
            }
            throw e;
        }

        // 3. Send access email
        SendAccessEmailResponse emailResponse = new SendAccessEmailResponse(false, "");
        if (activateResponse.activated() || activateResponse.alreadyActive()) {
            try {
                SendAccessEmailRequest emailRequest = mapToEmailRequest(request, registerResponse, baseKey);
                emailResponse = onboardingService.sendAccessEmail(emailRequest, payloadJson);
            } catch (Exception e) {
                log.error("[OnboardingController] Failed to send access email (non-blocking): {}", e.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of(
                "registered", true,
                "activated", activateResponse.activated(),
                "alreadyActive", activateResponse.alreadyActive(),
                "emailSent", emailResponse.emailSent(),
                "companyId", activateResponse.companyId() != null ? activateResponse.companyId().toString() : (registerResponse.companyId() != null ? registerResponse.companyId().toString() : ""),
                "userId", activateResponse.userId() != null ? activateResponse.userId().toString() : (registerResponse.userId() != null ? registerResponse.userId().toString() : ""),
                "timestamp", Instant.now().toString()
        ));
    }

    // ====================================================================
    // Mapping helpers
    // ====================================================================

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

    private SendAccessEmailRequest mapToEmailRequest(PaymentEventRequest event, FirstUserRegisterResponse registerResponse, String baseKey) {
        PaymentEventRequest.Customer c = event.customer();
        return new SendAccessEmailRequest(
                baseKey + ":email",
                registerResponse.userId() != null ? registerResponse.userId().toString() : "",
                registerResponse.companyId() != null ? registerResponse.companyId().toString() : "",
                c.responsavelEmail(),
                c.responsavelNome(),
                null,
                null,
                null
        );
    }

    private String toJson(Object obj) {
        try {
            return OBJECT_MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
