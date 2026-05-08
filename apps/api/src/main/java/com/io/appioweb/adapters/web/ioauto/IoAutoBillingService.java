package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoBillingSubscriptionRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoSignupIntentRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoBillingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoSignupIntentEntity;
import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.JpaOnboardingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.onboarding.OnboardingSubscriptionRepositoryJpa;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserActivateRequest;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserActivateResponse;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserRegisterRequest;
import com.io.appioweb.adapters.web.onboarding.dto.FirstUserRegisterResponse;
import com.io.appioweb.adapters.web.onboarding.dto.SendAccessEmailRequest;
import com.io.appioweb.shared.errors.BusinessException;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class IoAutoBillingService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder().build();
    private static final ZoneId BILLING_ZONE = ZoneId.of("America/Sao_Paulo");

    private static final String BILLING_PROVIDER = "ASAAS";
    private static final String SIGNUP_PENDING = "PENDING_PAYMENT";
    private static final String SIGNUP_ACTIVE = "ACTIVE";
    private static final String DEFAULT_PLAN_KEY = "ioauto-growth";
    private static final String DEFAULT_PLAN_NAME = "IOAuto Growth";
    private static final String DEFAULT_PLAN_DESCRIPTION = "Assinatura recorrente do IOAuto";
    private static final String DEFAULT_PLAN_CYCLE = "MONTHLY";
    private static final String DEFAULT_SIGNUP_ORIGIN = "lp-asaas";

    private final IoAutoSignupIntentRepositoryJpa signupIntents;
    private final IoAutoBillingSubscriptionRepositoryJpa subscriptions;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final OnboardingSubscriptionRepositoryJpa onboardingSubscriptions;
    private final CompanyRepositoryJpa companyRepo;
    private final UserRepositoryJpa userRepo;
    private final FirstUserOnboardingService onboardingService;
    private final String asaasApiKey;
    private final String asaasWebhookToken;
    private final String asaasApiBaseUrl;
    private final String asaasCheckoutBaseUrl;
    private final String publicAppUrl;
    private final String planKey;
    private final String planName;
    private final String planDescription;
    private final BigDecimal planValue;
    private final String planCycle;
    private final List<String> billingTypes;

    public IoAutoBillingService(
            IoAutoSignupIntentRepositoryJpa signupIntents,
            IoAutoBillingSubscriptionRepositoryJpa subscriptions,
            IoAutoIntegrationRepositoryJpa integrations,
            OnboardingSubscriptionRepositoryJpa onboardingSubscriptions,
            CompanyRepositoryJpa companyRepo,
            UserRepositoryJpa userRepo,
            FirstUserOnboardingService onboardingService,
            @Value("${ASAAS_API_KEY:}") String asaasApiKey,
            @Value("${ASAAS_WEBHOOK_TOKEN:}") String asaasWebhookToken,
            @Value("${ASAAS_API_BASE_URL:https://api.asaas.com/v3}") String asaasApiBaseUrl,
            @Value("${ASAAS_CHECKOUT_BASE_URL:https://asaas.com}") String asaasCheckoutBaseUrl,
            @Value("${APP_PUBLIC_URL:http://localhost:3000}") String publicAppUrl,
            @Value("${IOAUTO_PLAN_KEY:" + DEFAULT_PLAN_KEY + "}") String planKey,
            @Value("${IOAUTO_PLAN_NAME:" + DEFAULT_PLAN_NAME + "}") String planName,
            @Value("${IOAUTO_PLAN_DESCRIPTION:" + DEFAULT_PLAN_DESCRIPTION + "}") String planDescription,
            @Value("${IOAUTO_PLAN_VALUE:349.00}") BigDecimal planValue,
            @Value("${IOAUTO_PLAN_CYCLE:" + DEFAULT_PLAN_CYCLE + "}") String planCycle,
            @Value("${ASAAS_BILLING_TYPES:CREDIT_CARD,BOLETO}") String billingTypes
    ) {
        this.signupIntents = signupIntents;
        this.subscriptions = subscriptions;
        this.integrations = integrations;
        this.onboardingSubscriptions = onboardingSubscriptions;
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
        this.onboardingService = onboardingService;
        this.asaasApiKey = normalizeText(asaasApiKey);
        this.asaasWebhookToken = normalizeText(asaasWebhookToken);
        this.asaasApiBaseUrl = trimTrailingSlash(normalizeText(asaasApiBaseUrl, "https://api.asaas.com/v3"));
        this.asaasCheckoutBaseUrl = trimTrailingSlash(normalizeText(asaasCheckoutBaseUrl, "https://asaas.com"));
        this.publicAppUrl = trimTrailingSlash(normalizeText(publicAppUrl, "http://localhost:3000"));
        this.planKey = normalizeText(planKey, DEFAULT_PLAN_KEY);
        this.planName = normalizeText(planName, DEFAULT_PLAN_NAME);
        this.planDescription = normalizeText(planDescription, DEFAULT_PLAN_DESCRIPTION);
        this.planValue = planValue == null ? new BigDecimal("349.00") : planValue.setScale(2, RoundingMode.HALF_UP);
        this.planCycle = normalizeText(planCycle, DEFAULT_PLAN_CYCLE).toUpperCase(Locale.ROOT);
        this.billingTypes = parseBillingTypes(billingTypes);
    }

    @Transactional
    public CheckoutLaunch createSignupCheckout(PublicSignupPayload payload) {
        requireAsaasCheckoutConfiguration();

        String ownerFullName = requireText(payload.ownerFullName(), "Informe o nome completo.");
        String companyName = requireText(payload.companyName(), "Informe o nome da empresa.");
        String email = normalizeEmail(payload.email());
        String phone = normalizePhone(payload.phone());
        Instant now = Instant.now();

        Optional<JpaIoAutoSignupIntentEntity> existingIntent = signupIntents.findTopByEmailOrderByCreatedAtDesc(email);
        JpaIoAutoSignupIntentEntity intent;

        if (existingIntent.isPresent()) {
            intent = existingIntent.get();
            if (SIGNUP_ACTIVE.equalsIgnoreCase(intent.getStatus())) {
                throw new BusinessException("SIGNUP_EMAIL_ALREADY_EXISTS", "Ja existe uma conta ativa criada com este e-mail.");
            }
        } else {
            if (!userRepo.findAllByEmail(email).isEmpty()) {
                throw new BusinessException("SIGNUP_EMAIL_ALREADY_EXISTS", "Ja existe uma conta criada com este e-mail.");
            }

            intent = new JpaIoAutoSignupIntentEntity();
            intent.setId(UUID.randomUUID());
            intent.setCreatedAt(now);
        }

        intent.setCompanyName(companyName);
        intent.setOwnerFullName(ownerFullName);
        intent.setEmail(email);
        intent.setWhatsappNumber(phone);
        intent.setPasswordHash(normalizeText(intent.getPasswordHash(), "ONBOARDING_EMAIL_PENDING"));
        intent.setPlanKey(planKey);
        intent.setProvider(BILLING_PROVIDER);
        intent.setStatus(SIGNUP_PENDING);
        intent.setProviderPriceId(planKey);
        intent.setUpdatedAt(now);

        if (intent.getCompanyId() == null || intent.getUserId() == null) {
            FirstUserRegisterResponse registerResponse = registerInactiveSignup(intent);
            if (registerResponse.companyId() == null || registerResponse.userId() == null) {
                throw new BusinessException("SIGNUP_ONBOARDING_FAILED", "Nao foi possivel preparar a conta antes do checkout.");
            }
            intent.setCompanyId(registerResponse.companyId());
            intent.setUserId(registerResponse.userId());
        }

        signupIntents.save(intent);

        AsaasCheckout checkout = createAsaasCheckout(intent);
        intent.setCheckoutSessionId(checkout.id());
        intent.setUpdatedAt(Instant.now());
        signupIntents.save(intent);

        return new CheckoutLaunch(intent.getId(), checkout.url(), checkout.id());
    }

    @Transactional
    public SignupStatusSnapshot getSignupStatus(UUID intentId, String sessionId) {
        JpaIoAutoSignupIntentEntity intent = signupIntents.findById(intentId)
                .orElseThrow(() -> new BusinessException("SIGNUP_INTENT_NOT_FOUND", "Cadastro nao encontrado."));

        if (SIGNUP_ACTIVE.equalsIgnoreCase(intent.getStatus())) {
            return toSignupStatus(intent, "Pagamento confirmado. Enviamos para o seu e-mail o link para definir a senha e acessar a plataforma.");
        }

        if (!normalizeText(intent.getCheckoutSessionId()).isBlank() && !asaasApiKey.isBlank()) {
            Optional<AsaasPayment> payment = findPaymentByCheckout(intent.getCheckoutSessionId());
            if (payment.isPresent()) {
                syncIntentReferences(intent, payment.get(), intent.getCheckoutSessionId());
                if (isPaidPaymentStatus(payment.get().status())) {
                    return toSignupStatus(intent, "Pagamento confirmado. Estamos finalizando a ativacao da conta e o envio do e-mail para definir sua senha.");
                }
                return toSignupStatus(intent, pendingMessageForPayment(payment.get()));
            }
        }

        return toSignupStatus(intent, "Checkout criado. Conclua o pagamento no Asaas para liberar o acesso.");
    }

    @Transactional(readOnly = true)
    public BillingSnapshot getBillingSnapshot(UUID companyId) {
        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = subscriptions.findTopByCompanyIdOrderByUpdatedAtDesc(companyId);
        return subscription
                .map(item -> new BillingSnapshot(
                        true,
                        normalizeText(item.getPlanName(), planName),
                        normalizeText(item.getStatus(), "inactive"),
                        item.getAmountCents(),
                        normalizeText(item.getCurrency(), "brl"),
                        normalizeText(item.getBillingInterval(), toBillingInterval(planCycle)),
                        item.getCurrentPeriodEnd(),
                        item.isCancelAtPeriodEnd(),
                        normalizeText(item.getProvider(), BILLING_PROVIDER),
                        normalizeText(item.getProviderCustomerId()),
                        normalizeText(item.getProviderSubscriptionId())
                ))
                .orElseGet(() -> new BillingSnapshot(
                        false,
                        planName,
                        "pending_configuration",
                        null,
                        "brl",
                        toBillingInterval(planCycle),
                        null,
                        false,
                        BILLING_PROVIDER,
                        "",
                        ""
                ));
    }

    public PortalLaunch createPortalSession(UUID companyId) {
        requireAsaasCheckoutConfiguration();

        JpaIoAutoBillingSubscriptionEntity subscription = subscriptions.findTopByCompanyIdOrderByUpdatedAtDesc(companyId)
                .orElseThrow(() -> new BusinessException("BILLING_NOT_FOUND", "Nao existe uma assinatura vinculada a esta conta."));

        Optional<AsaasPayment> payment = Optional.empty();
        if (!normalizeText(subscription.getProviderSubscriptionId()).isBlank()) {
            payment = findPaymentForPortal(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", "20"));
        }
        if (payment.isEmpty() && !normalizeText(subscription.getProviderCustomerId()).isBlank()) {
            payment = findPaymentForPortal(Map.of("customer", subscription.getProviderCustomerId(), "limit", "20"));
        }

        String invoiceUrl = payment.map(AsaasPayment::invoiceUrl).orElse("");
        if (invoiceUrl.isBlank()) {
            throw new BusinessException("BILLING_PORTAL_FAILED", "Nao foi possivel localizar uma cobranca do Asaas para abrir.");
        }

        return new PortalLaunch(invoiceUrl);
    }

    @Transactional
    public void handleAsaasWebhook(String payload, String authTokenHeader) {
        requireAsaasWebhookConfiguration();

        String normalizedHeader = normalizeText(authTokenHeader);
        if (normalizedHeader.isBlank() || !normalizedHeader.equals(asaasWebhookToken)) {
            throw new BusinessException("BILLING_WEBHOOK_INVALID_TOKEN", "Token do webhook Asaas invalido.");
        }

        JsonNode root = readJson(payload);
        String event = text(root, "event").toUpperCase(Locale.ROOT);
        JsonNode paymentNode = root.path("payment");
        JsonNode checkoutNode = root.path("checkout");
        String checkoutId = text(checkoutNode, "id");

        if (paymentNode.isObject()) {
            processPaymentEvent(toAsaasPayment(paymentNode), checkoutId);
            return;
        }

        if ("CHECKOUT_PAID".equals(event) && !checkoutId.isBlank()) {
            signupIntents.findByCheckoutSessionId(checkoutId).ifPresent(intent -> {
                Optional<AsaasPayment> payment = findPaymentByCheckout(checkoutId);
                payment.ifPresent(value -> processPaymentEvent(value, checkoutId));
            });
        }
    }

    private SignupStatusSnapshot toSignupStatus(JpaIoAutoSignupIntentEntity intent, String message) {
        boolean ready = SIGNUP_ACTIVE.equalsIgnoreCase(intent.getStatus());
        return new SignupStatusSnapshot(
                intent.getId(),
                normalizeText(intent.getStatus(), SIGNUP_PENDING),
                message,
                ready,
                normalizeText(intent.getEmail()),
                normalizeText(intent.getCompanyName())
        );
    }

    private void requireAsaasCheckoutConfiguration() {
        if (asaasApiKey.isBlank()) {
            throw new BusinessException("BILLING_NOT_CONFIGURED", "Configure ASAAS_API_KEY antes de usar o checkout.");
        }
        if (planValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("BILLING_NOT_CONFIGURED", "Defina IOAUTO_PLAN_VALUE com um valor valido.");
        }
    }

    private void requireAsaasWebhookConfiguration() {
        requireAsaasCheckoutConfiguration();
        if (asaasWebhookToken.isBlank()) {
            throw new BusinessException("BILLING_WEBHOOK_NOT_CONFIGURED", "Configure ASAAS_WEBHOOK_TOKEN para validar os eventos do Asaas.");
        }
    }

    private AsaasCheckout createAsaasCheckout(JpaIoAutoSignupIntentEntity intent) {
        OffsetDateTime now = OffsetDateTime.now(BILLING_ZONE);
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("name", planName);
        body.put("description", planDescription);
        body.put("externalReference", intent.getId().toString());
        body.put("expiresAt", formatAsaasDateTime(now.plusHours(2)));

        ArrayNode billingTypesNode = body.putArray("billingTypes");
        billingTypes.forEach(billingTypesNode::add);

        ArrayNode chargeTypesNode = body.putArray("chargeTypes");
        chargeTypesNode.add("RECURRENT");

        ObjectNode customerData = body.putObject("customerData");
        customerData.put("name", intent.getOwnerFullName());
        customerData.put("email", intent.getEmail());
        customerData.put("phone", intent.getWhatsappNumber());
        customerData.put("mobilePhone", intent.getWhatsappNumber());

        ObjectNode callback = body.putObject("callback");
        callback.put("successUrl", publicAppUrl + "/assinar/sucesso?intent=" + intent.getId());
        callback.put("cancelUrl", publicAppUrl + "/assinar/cancelado?intent=" + intent.getId());
        callback.put("expiredUrl", publicAppUrl + "/assinar/cancelado?intent=" + intent.getId());
        callback.put("autoRedirect", true);

        ObjectNode subscription = body.putObject("subscription");
        subscription.put("cycle", planCycle);
        subscription.put("nextDueDate", formatAsaasDateTime(now.plusMinutes(5)));
        subscription.put("endDate", formatAsaasDateTime(now.plusYears(10)));

        ArrayNode items = body.putArray("items");
        ObjectNode item = items.addObject();
        item.put("name", planName);
        item.put("description", planDescription);
        item.put("quantity", 1);
        item.put("value", planValue);

        JsonNode response = callAsaas("POST", "/checkouts", body);
        String checkoutId = text(response, "id");
        if (checkoutId.isBlank()) {
            throw new BusinessException("BILLING_CHECKOUT_FAILED", "O Asaas nao retornou um identificador de checkout valido.");
        }

        String checkoutUrl = text(response, "url");
        if (checkoutUrl.isBlank()) {
            checkoutUrl = asaasCheckoutBaseUrl + "/checkoutSession/show?id=" + urlEncode(checkoutId);
        }

        return new AsaasCheckout(checkoutId, checkoutUrl);
    }

    private Optional<AsaasPayment> findPaymentByCheckout(String checkoutId) {
        if (normalizeText(checkoutId).isBlank()) {
            return Optional.empty();
        }
        List<AsaasPayment> payments = listPayments(Map.of("checkoutSession", checkoutId, "limit", "20"));
        return selectMostRelevantPayment(payments);
    }

    private Optional<AsaasPayment> findPaymentForPortal(Map<String, String> params) {
        List<AsaasPayment> payments = listPayments(params);
        return payments.stream()
                .filter(item -> !normalizeText(item.invoiceUrl()).isBlank())
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> isPaidPaymentStatus(item.status()) ? 1 : 0)
                        .thenComparing(item -> item.dueDate() == null ? LocalDate.MIN : item.dueDate())
                        .thenComparing(item -> item.createdAt() == null ? Instant.EPOCH : item.createdAt())
                        .reversed())
                .findFirst();
    }

    private List<AsaasPayment> listPayments(Map<String, String> params) {
        JsonNode response = callAsaas("GET", "/payments?" + buildQueryString(params), null);
        JsonNode dataNode = response.path("data");
        if (!dataNode.isArray()) {
            return List.of();
        }

        List<AsaasPayment> payments = new ArrayList<>();
        for (JsonNode item : dataNode) {
            payments.add(toAsaasPayment(item));
        }
        return List.copyOf(payments);
    }

    private Optional<AsaasPayment> selectMostRelevantPayment(List<AsaasPayment> payments) {
        return payments.stream()
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> paymentPriority(item.status()))
                        .thenComparing(item -> item.confirmedAt() == null ? Instant.EPOCH : item.confirmedAt())
                        .thenComparing(item -> item.dueDate() == null ? LocalDate.MIN : item.dueDate())
                        .reversed())
                .findFirst();
    }

    private int paymentPriority(String status) {
        String normalized = normalizeText(status).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH" -> 3;
            case "PENDING", "AWAITING_RISK_ANALYSIS" -> 2;
            case "OVERDUE" -> 1;
            default -> 0;
        };
    }

    private void processPaymentEvent(AsaasPayment payment, String checkoutId) {
        String normalizedCheckoutId = normalizeText(checkoutId, payment.checkoutSession());
        Optional<JpaIoAutoSignupIntentEntity> intentByCheckout = normalizedCheckoutId.isBlank()
                ? Optional.empty()
                : signupIntents.findByCheckoutSessionId(normalizedCheckoutId);

        if (intentByCheckout.isPresent()) {
            JpaIoAutoSignupIntentEntity intent = intentByCheckout.get();
            syncIntentReferences(intent, payment, normalizedCheckoutId);
            if (isPaidPaymentStatus(payment.status())) {
                activateConfirmedIntent(intent, payment, normalizedCheckoutId);
            }
            return;
        }

        String externalReference = normalizeText(payment.externalReference());
        if (!externalReference.isBlank()) {
            try {
                UUID intentId = UUID.fromString(externalReference);
                signupIntents.findById(intentId).ifPresent(intent -> {
                    syncIntentReferences(intent, payment, normalizedCheckoutId);
                    if (isPaidPaymentStatus(payment.status())) {
                        activateConfirmedIntent(intent, payment, normalizedCheckoutId);
                    }
                });
                return;
            } catch (IllegalArgumentException ignored) {
                // Ignora referencias que nao sao UUID.
            }
        }

        if (!normalizeText(payment.subscription()).isBlank()) {
            subscriptions.findByProviderAndProviderSubscriptionId(BILLING_PROVIDER, payment.subscription())
                    .ifPresent(existing -> syncSubscription(existing.getCompanyId(), payment, normalizedCheckoutId));
        }
    }

    private void syncIntentReferences(JpaIoAutoSignupIntentEntity intent, AsaasPayment payment, String checkoutId) {
        boolean changed = false;
        String normalizedCheckoutId = normalizeText(checkoutId, payment.checkoutSession());
        if (!normalizedCheckoutId.isBlank() && !normalizedCheckoutId.equals(normalizeText(intent.getCheckoutSessionId()))) {
            intent.setCheckoutSessionId(normalizedCheckoutId);
            changed = true;
        }
        if (!normalizeText(payment.customer()).isBlank() && !normalizeText(payment.customer()).equals(normalizeText(intent.getProviderCustomerId()))) {
            intent.setProviderCustomerId(payment.customer());
            changed = true;
        }
        if (!normalizeText(payment.subscription()).isBlank() && !normalizeText(payment.subscription()).equals(normalizeText(intent.getProviderSubscriptionId()))) {
            intent.setProviderSubscriptionId(payment.subscription());
            changed = true;
        }
        if (changed) {
            intent.setUpdatedAt(Instant.now());
            signupIntents.save(intent);
        }
    }

    private boolean isPaidPaymentStatus(String status) {
        String normalized = normalizeText(status).toUpperCase(Locale.ROOT);
        return "RECEIVED".equals(normalized) || "CONFIRMED".equals(normalized) || "RECEIVED_IN_CASH".equals(normalized);
    }

    private String pendingMessageForPayment(AsaasPayment payment) {
        String status = normalizeText(payment.status()).toUpperCase(Locale.ROOT);
        return switch (status) {
            case "PENDING", "AWAITING_RISK_ANALYSIS" -> "Pagamento iniciado no Asaas. Assim que a cobranca for confirmada a conta sera liberada.";
            case "OVERDUE" -> "A cobranca ficou vencida no Asaas. Reabra a cobranca ou gere uma nova tentativa.";
            default -> "A assinatura ainda esta aguardando confirmacao de pagamento no Asaas.";
        };
    }

    private void activateConfirmedIntent(JpaIoAutoSignupIntentEntity intent, AsaasPayment payment, String checkoutId) {
        if (!isPaidPaymentStatus(payment.status())) {
            return;
        }

        if (intent.getCompanyId() == null || intent.getUserId() == null) {
            FirstUserRegisterResponse registerResponse = registerInactiveSignup(intent);
            if (registerResponse.companyId() != null) {
                intent.setCompanyId(registerResponse.companyId());
            }
            if (registerResponse.userId() != null) {
                intent.setUserId(registerResponse.userId());
            }
        }

        if (intent.getCompanyId() == null || intent.getUserId() == null) {
            throw new BusinessException("SIGNUP_ONBOARDING_NOT_FOUND", "Nao foi possivel localizar a conta pendente para ativacao.");
        }

        attachPaymentToOnboardingSubscription(intent, payment);

        FirstUserActivateRequest activateRequest = buildActivateRequest(intent, payment);
        FirstUserActivateResponse activateResponse = onboardingService.activate(activateRequest, toJson(activateRequest));

        SendAccessEmailRequest emailRequest = buildAccessEmailRequest(intent, activateResponse, payment);
        onboardingService.sendAccessEmail(emailRequest, toJson(emailRequest));

        Instant now = Instant.now();
        UUID companyId = activateResponse.companyId() != null ? activateResponse.companyId() : intent.getCompanyId();

        ensureDefaultIntegrations(companyId, now);
        syncSubscription(companyId, payment, checkoutId);

        intent.setStatus(SIGNUP_ACTIVE);
        intent.setCheckoutSessionId(normalizeText(checkoutId, payment.checkoutSession()));
        intent.setProviderCustomerId(normalizeText(payment.customer()));
        intent.setProviderSubscriptionId(normalizeText(payment.subscription()));
        intent.setCompanyId(companyId);
        intent.setUserId(activateResponse.userId() != null ? activateResponse.userId() : intent.getUserId());
        intent.setActivatedAt(now);
        intent.setUpdatedAt(now);
        signupIntents.save(intent);
    }

    private FirstUserRegisterResponse registerInactiveSignup(JpaIoAutoSignupIntentEntity intent) {
        FirstUserRegisterRequest registerRequest = buildRegisterRequest(intent);
        FirstUserRegisterResponse response = onboardingService.register(registerRequest, toJson(registerRequest));

        UUID companyId = response.companyId();
        if (companyId == null) {
            companyId = companyRepo.findByEmail(normalizeEmail(intent.getEmail()))
                    .map(JpaCompanyEntity::getId)
                    .orElse(null);
        }

        UUID resolvedCompanyId = companyId;
        UUID userId = response.userId();
        if (userId == null && resolvedCompanyId != null) {
            userId = userRepo.findAllByEmail(normalizeEmail(intent.getEmail())).stream()
                    .filter(user -> resolvedCompanyId.equals(user.getCompanyId()))
                    .map(user -> user.getId())
                    .findFirst()
                    .orElse(null);
        }

        return new FirstUserRegisterResponse(companyId, userId, response.created(), response.status());
    }

    private FirstUserRegisterRequest buildRegisterRequest(JpaIoAutoSignupIntentEntity intent) {
        return new FirstUserRegisterRequest(
                "public-signup:" + intent.getId() + ":register",
                new FirstUserRegisterRequest.FirstUserRegistration(
                        null,
                        intent.getCompanyName(),
                        intent.getCompanyName(),
                        intent.getEmail(),
                        null,
                        null,
                        intent.getWhatsappNumber(),
                        null,
                        null,
                        null,
                        null,
                        intent.getOwnerFullName(),
                        intent.getEmail(),
                        intent.getWhatsappNumber(),
                        "INACTIVE"
                ),
                new FirstUserRegisterRequest.Comercial(
                        planValue,
                        toPortugueseRecurrence(planCycle),
                        null,
                        DEFAULT_SIGNUP_ORIGIN
                ),
                new FirstUserRegisterRequest.Billing(
                        null,
                        null,
                        planName
                )
        );
    }

    private FirstUserActivateRequest buildActivateRequest(JpaIoAutoSignupIntentEntity intent, AsaasPayment payment) {
        return new FirstUserActivateRequest(
                "public-signup:" + intent.getId() + ":" + normalizeText(payment.id()) + ":activate",
                normalizeText(payment.id()),
                normalizeText(payment.subscription()),
                normalizeText(payment.status()),
                payment.value() != null ? payment.value() : planValue,
                toPortugueseRecurrence(planCycle),
                payment.confirmedAt() != null ? payment.confirmedAt().atZone(BILLING_ZONE).toLocalDate().toString() : null,
                DEFAULT_SIGNUP_ORIGIN,
                planName
        );
    }

    private SendAccessEmailRequest buildAccessEmailRequest(
            JpaIoAutoSignupIntentEntity intent,
            FirstUserActivateResponse activateResponse,
            AsaasPayment payment
    ) {
        UUID resolvedUserId = activateResponse.userId() != null ? activateResponse.userId() : intent.getUserId();
        UUID resolvedCompanyId = activateResponse.companyId() != null ? activateResponse.companyId() : intent.getCompanyId();

        return new SendAccessEmailRequest(
                "public-signup:" + intent.getId() + ":" + normalizeText(payment.id()) + ":email",
                resolvedUserId != null ? resolvedUserId.toString() : "",
                resolvedCompanyId != null ? resolvedCompanyId.toString() : "",
                intent.getEmail(),
                intent.getOwnerFullName(),
                null,
                null,
                null
        );
    }

    private void attachPaymentToOnboardingSubscription(JpaIoAutoSignupIntentEntity intent, AsaasPayment payment) {
        Instant now = Instant.now();
        JpaOnboardingSubscriptionEntity subscription = onboardingSubscriptions.findByCompanyId(intent.getCompanyId())
                .orElseGet(() -> {
                    JpaOnboardingSubscriptionEntity created = new JpaOnboardingSubscriptionEntity();
                    created.setId(UUID.randomUUID());
                    created.setCompanyId(intent.getCompanyId());
                    created.setCreatedAt(now);
                    created.setAsaasDescriptionSynced(false);
                    return created;
                });

        if (!normalizeText(payment.subscription()).isBlank()) {
            subscription.setAsaasSubscriptionId(payment.subscription());
        }
        if (!normalizeText(payment.id()).isBlank()) {
            subscription.setAsaasPaymentId(payment.id());
        }

        subscription.setValor(payment.value() != null ? payment.value() : (subscription.getValor() != null ? subscription.getValor() : planValue));
        subscription.setRecorrencia(normalizeText(subscription.getRecorrencia(), toPortugueseRecurrence(planCycle)));
        subscription.setOrigem(normalizeText(subscription.getOrigem(), DEFAULT_SIGNUP_ORIGIN));
        subscription.setDescription(normalizeText(subscription.getDescription(), planName));
        subscription.setStatus(normalizeText(subscription.getStatus(), "PENDING"));
        subscription.setUpdatedAt(now);
        onboardingSubscriptions.save(subscription);
    }

    private void syncSubscription(UUID companyId, AsaasPayment payment, String checkoutId) {
        if (companyId == null || payment == null) {
            return;
        }

        JpaIoAutoBillingSubscriptionEntity entity = null;
        String providerSubscriptionId = normalizeText(payment.subscription());
        if (!providerSubscriptionId.isBlank()) {
            entity = subscriptions.findByProviderAndProviderSubscriptionId(BILLING_PROVIDER, providerSubscriptionId).orElse(null);
        }
        if (entity == null) {
            entity = subscriptions.findTopByCompanyIdOrderByUpdatedAtDesc(companyId).orElseGet(JpaIoAutoBillingSubscriptionEntity::new);
        }

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCreatedAt(Instant.now());
        }

        entity.setCompanyId(companyId);
        entity.setProvider(BILLING_PROVIDER);
        entity.setProviderCustomerId(normalizeText(payment.customer()));
        entity.setProviderSubscriptionId(providerSubscriptionId);
        entity.setProviderPriceId(planKey);
        entity.setPlanKey(planKey);
        entity.setPlanName(planName);
        entity.setStatus(normalizePaymentStatus(payment.status()));
        entity.setAmountCents(toCents(payment.value()));
        entity.setCurrency("brl");
        entity.setBillingInterval(toBillingInterval(planCycle));
        entity.setCurrentPeriodEnd(resolveCurrentPeriodEnd(payment));
        entity.setCancelAtPeriodEnd(false);
        entity.setCheckoutSessionId(normalizeText(checkoutId, payment.checkoutSession()));
        entity.setUpdatedAt(Instant.now());
        subscriptions.save(entity);

        companyRepo.findById(companyId).ifPresent(company -> {
            company.setContractEndDate(toContractEndDate(payment, Instant.now()));
            company.setUpdatedAt(Instant.now());
            companyRepo.save(company);
        });
    }

    private Long toCents(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private String normalizePaymentStatus(String status) {
        String normalized = normalizeText(status).toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? "inactive" : normalized;
    }

    private LocalDate toContractEndDate(AsaasPayment payment, Instant fallbackNow) {
        Instant contractEnd = resolveCurrentPeriodEnd(payment);
        if (contractEnd == null) {
            contractEnd = fallbackNow.plusSeconds(30L * 24 * 60 * 60);
        }
        return contractEnd.atZone(BILLING_ZONE).toLocalDate();
    }

    private Instant resolveCurrentPeriodEnd(AsaasPayment payment) {
        if (payment == null || payment.dueDate() == null) {
            return null;
        }

        LocalDate baseDate = payment.dueDate();
        if (isPaidPaymentStatus(payment.status())) {
            baseDate = advanceCycle(baseDate, planCycle);
        }
        return baseDate.plusDays(1).atStartOfDay(BILLING_ZONE).toInstant();
    }

    private LocalDate advanceCycle(LocalDate source, String cycle) {
        String normalized = normalizeText(cycle).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WEEKLY" -> source.plusWeeks(1);
            case "BIWEEKLY" -> source.plusWeeks(2);
            case "QUARTERLY" -> source.plusMonths(3);
            case "SEMIANNUALLY" -> source.plusMonths(6);
            case "YEARLY" -> source.plusYears(1);
            default -> source.plusMonths(1);
        };
    }

    private String toBillingInterval(String cycle) {
        String normalized = normalizeText(cycle).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WEEKLY", "BIWEEKLY" -> "week";
            case "YEARLY" -> "year";
            default -> "month";
        };
    }

    private void ensureDefaultIntegrations(UUID companyId, Instant now) {
        upsertIntegration(companyId, "webmotors", "Webmotors / Estoque e Leads", now);
        upsertIntegration(companyId, "olx", "OLX", now);
    }

    private void upsertIntegration(UUID companyId, String providerKey, String displayName, Instant now) {
        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKey(companyId, providerKey)
                .orElseGet(JpaIoAutoIntegrationEntity::new);

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setProviderKey(providerKey);
            entity.setCreatedAt(now);
        }
        entity.setDisplayName(displayName);
        entity.setStatus(normalizeText(entity.getStatus(), "CONFIGURATION_REQUIRED"));
        entity.setSettingsJson(normalizeText(entity.getSettingsJson(), "{}"));
        entity.setUpdatedAt(now);
        integrations.save(entity);
    }

    private JsonNode callAsaas(String method, String pathWithQuery, JsonNode body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(asaasApiBaseUrl + pathWithQuery))
                    .header("accept", "application/json")
                    .header("access_token", asaasApiKey);

            if (body != null) {
                builder.header("content-type", "application/json");
            }

            HttpRequest request = switch (method) {
                case "POST" -> builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : OBJECT_MAPPER.writeValueAsString(body))).build();
                case "GET" -> builder.GET().build();
                default -> throw new IllegalArgumentException("Metodo HTTP nao suportado: " + method);
            };

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode payload = readJson(response.body());
            if (response.statusCode() >= 400) {
                throw new BusinessException("ASAAS_API_ERROR", extractAsaasError(payload, "Nao foi possivel concluir a comunicacao com o Asaas."));
            }
            return payload;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("ASAAS_API_ERROR", "Nao foi possivel concluir a comunicacao com o Asaas.");
        }
    }

    private String extractAsaasError(JsonNode payload, String fallback) {
        JsonNode errors = payload.path("errors");
        if (errors.isArray() && !errors.isEmpty()) {
            String description = text(errors.get(0), "description");
            if (!description.isBlank()) {
                return description;
            }
        }
        String message = text(payload, "message");
        return message.isBlank() ? fallback : message;
    }

    private JsonNode readJson(String raw) {
        try {
            String source = normalizeText(raw);
            return source.isBlank() ? OBJECT_MAPPER.createObjectNode() : OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            throw new BusinessException("ASAAS_INVALID_RESPONSE", "O retorno do Asaas nao pode ser interpretado.");
        }
    }

    private AsaasPayment toAsaasPayment(JsonNode node) {
        return new AsaasPayment(
                text(node, "id"),
                text(node, "customer"),
                text(node, "subscription"),
                firstNonBlank(text(node, "invoiceUrl"), text(node, "bankSlipUrl")),
                text(node, "status"),
                text(node, "billingType"),
                text(node, "externalReference"),
                firstNonBlank(text(node, "checkoutSession"), text(node, "checkout")),
                decimal(node, "value"),
                parseLocalDate(firstNonBlank(text(node, "dueDate"), text(node, "dateCreated"))),
                parseInstant(firstNonBlank(text(node, "confirmedDate"), text(node, "clientPaymentDate"), text(node, "paymentDate"))),
                parseInstant(text(node, "dateCreated"))
        );
    }

    private BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.decimalValue();
        }
        String text = normalizeText(value.asText());
        if (text.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
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

    private LocalDate parseLocalDate(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(normalized.substring(0, 10));
        } catch (Exception ignored) {
            return null;
        }
    }

    private Instant parseInstant(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(normalized);
        } catch (Exception ignored) {
            try {
                return OffsetDateTime.parse(normalized).toInstant();
            } catch (Exception ignoredAgain) {
                LocalDate localDate = parseLocalDate(normalized);
                return localDate == null ? null : localDate.atStartOfDay(BILLING_ZONE).toInstant();
            }
        }
    }

    private String formatAsaasDateTime(OffsetDateTime value) {
        OffsetDateTime normalized = value == null ? OffsetDateTime.now(BILLING_ZONE) : value;
        return normalized.withNano(0).toLocalDateTime().toString().replace("T", " ");
    }

    private String buildQueryString(Map<String, String> params) {
        return params.entrySet().stream()
                .filter(entry -> !normalizeText(entry.getValue()).isBlank())
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(normalizeText(value), StandardCharsets.UTF_8);
    }

    private List<String> parseBillingTypes(String raw) {
        List<String> values = new ArrayList<>();
        for (String item : normalizeText(raw, "CREDIT_CARD,BOLETO").split(",")) {
            String normalized = normalizeText(item).toUpperCase(Locale.ROOT);
            if (!normalized.isBlank()) {
                values.add(normalized);
            }
        }
        return values.isEmpty() ? List.of("CREDIT_CARD", "BOLETO") : List.copyOf(values);
    }

    private String toJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            return "{}";
        }
    }

    private String toPortugueseRecurrence(String cycle) {
        String normalized = normalizeText(cycle).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WEEKLY" -> "semanal";
            case "BIWEEKLY" -> "quinzenal";
            case "QUARTERLY" -> "trimestral";
            case "SEMIANNUALLY" -> "semestral";
            case "YEARLY" -> "anual";
            default -> "mensal";
        };
    }

    private String normalizePhone(String value) {
        String digits = normalizeText(value).replaceAll("\\D", "");
        if (digits.length() < 10 || digits.length() > 11) {
            throw new BusinessException("SIGNUP_INVALID_PHONE", "Informe um telefone valido com DDD.");
        }
        return digits;
    }

    private String normalizeEmail(String value) {
        String normalized = normalizeText(value).toLowerCase(Locale.ROOT);
        if (!normalized.contains("@")) {
            throw new BusinessException("SIGNUP_INVALID_EMAIL", "Informe um e-mail valido.");
        }
        return normalized;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            throw new BusinessException("SIGNUP_INVALID_PAYLOAD", message);
        }
        return normalized;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = normalizeText(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private static String trimTrailingSlash(String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    private static String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? fallback : normalized;
    }
}

record PublicSignupPayload(
        String ownerFullName,
        String companyName,
        String email,
        String phone
) {
}

record CheckoutLaunch(UUID intentId, String checkoutUrl, String checkoutId) {
}

record SignupStatusSnapshot(
        UUID intentId,
        String status,
        String message,
        boolean accessReady,
        String loginEmail,
        String companyName
) {
}

record BillingSnapshot(
        boolean hasSubscription,
        String planName,
        String status,
        Long amountCents,
        String currency,
        String billingInterval,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        String provider,
        String providerCustomerId,
        String providerSubscriptionId
) {
}

record PortalLaunch(String portalUrl) {
}

record AsaasCheckout(String id, String url) {
}

record AsaasPayment(
        String id,
        String customer,
        String subscription,
        String invoiceUrl,
        String status,
        String billingType,
        String externalReference,
        String checkoutSession,
        BigDecimal value,
        LocalDate dueDate,
        Instant confirmedAt,
        Instant createdAt
) {
}
