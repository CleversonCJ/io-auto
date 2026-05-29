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
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.shared.errors.BusinessException;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class IoAutoBillingService {

    private static final Logger log = LoggerFactory.getLogger(IoAutoBillingService.class);
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
    private static final long MIN_ASAAS_PAYMENT_CENTS = 1L;

    private final IoAutoSignupIntentRepositoryJpa signupIntents;
    private final IoAutoBillingSubscriptionRepositoryJpa subscriptions;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final OnboardingSubscriptionRepositoryJpa onboardingSubscriptions;
    private final CompanyRepositoryJpa companyRepo;
    private final UserRepositoryJpa userRepo;
    private final FirstUserOnboardingService onboardingService;
    private final SuperAdminPlanManagementService planManagementService;
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
            SuperAdminPlanManagementService planManagementService,
            @Value("${ASAAS_API_KEY:${ASAAS_ACCESS_TOKEN:}}") String asaasApiKey,
            @Value("${ASAAS_WEBHOOK_TOKEN:}") String asaasWebhookToken,
            @Value("${ASAAS_API_BASE_URL:${ASAAS_BASE_URL:https://api.asaas.com/v3}}") String asaasApiBaseUrl,
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
        this.planManagementService = planManagementService;
        this.asaasApiKey = normalizeText(asaasApiKey);
        this.asaasWebhookToken = normalizeText(asaasWebhookToken);
        this.asaasApiBaseUrl = normalizeAsaasApiBaseUrl(asaasApiBaseUrl);
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
        return buildBillingSnapshot(companyId, false);
    }

    @Transactional(readOnly = true)
    public BillingSnapshot getBillingSnapshotForSuperAdmin(UUID companyId) {
        return buildBillingSnapshot(companyId, true);
    }

    private BillingSnapshot buildBillingSnapshot(UUID companyId, boolean superAdminMode) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan);
        SuperAdminPlanManagementService.TenantPlanUsage usage = planManagementService.getTenantPlanUsage(companyId);
        String resolvedBillingInterval = normalizeBillingRecurrence(
                subscription.map(JpaIoAutoBillingSubscriptionEntity::getBillingInterval).orElse(currentPlan.billingRecurrence())
        );
        Long resolvedAmountCents = subscription.map(JpaIoAutoBillingSubscriptionEntity::getAmountCents)
                .orElseGet(() -> currentPlan.priceForRecurrence(resolvedBillingInterval));
        List<BillingPlanOption> availablePlans = planManagementService.listActivePlanSnapshots().stream()
                .map(plan -> {
                    SuperAdminPlanManagementService.PlanCompatibility compatibility =
                            superAdminMode
                                    ? planManagementService.evaluateTenantPlanCompatibilityForSuperAdmin(
                                    usage,
                                    currentPlan,
                                    resolvedBillingInterval,
                                    resolvedAmountCents,
                                    plan,
                                    resolvePreferredBillingIntervalForPlan(plan, resolvedBillingInterval),
                                    null
                            )
                                    : planManagementService.evaluateTenantPlanCompatibility(usage, plan);
                    return new BillingPlanOption(
                            plan.planId(),
                            plan.planKey(),
                            plan.planName(),
                            plan.billingRecurrence(),
                            plan.priceCents(),
                            plan.monthlyPriceCents(),
                            plan.annualPriceCents(),
                            plan.priceByInterval(),
                            plan.supportedBillingIntervals(),
                            plan.usersLimit(),
                            plan.vehiclesLimit(),
                            plan.activeAdsLimit(),
                            plan.features(),
                            plan.planId().equals(currentPlan.planId()),
                            compatibility.eligible(),
                            compatibility.blockingReasons()
                    );
                })
                .toList();
        BillingInvoiceSummary nextInvoice = resolveNextInvoiceSummary(
                subscription.orElse(null),
                currentPlan.planName(),
                normalizeText(subscription.map(JpaIoAutoBillingSubscriptionEntity::getCurrency).orElse("brl"), "brl"),
                resolvedAmountCents
        );
        List<BillingInvoiceSummary> paidInvoices = subscription
                .map(item -> listPaidInvoiceSummaries(
                        item,
                        currentPlan.planName(),
                        normalizeText(item.getCurrency(), "brl")
                ))
                .orElse(List.of());

        return subscription
                .map(item -> new BillingSnapshot(
                        true,
                        currentPlan.planId(),
                        normalizeText(item.getPlanKey(), currentPlan.planKey()),
                        normalizeText(item.getPlanName(), currentPlan.planName()),
                        normalizeText(item.getStatus(), "inactive"),
                        item.getAmountCents() == null ? resolvedAmountCents : item.getAmountCents(),
                        normalizeText(item.getCurrency(), "brl"),
                        normalizeBillingRecurrence(item.getBillingInterval()),
                        item.getCurrentPeriodEnd(),
                        item.isCancelAtPeriodEnd(),
                        normalizeText(item.getProvider(), BILLING_PROVIDER),
                        normalizeText(item.getProviderCustomerId()),
                        normalizeText(item.getProviderSubscriptionId()),
                        item.getPendingProrationCreditCents(),
                        normalizeText(item.getPendingProrationCreditNote()),
                        item.getPendingProrationCreditUpdatedAt(),
                        readPlanChangeNotice(company),
                        currentPlan.usersLimit(),
                        currentPlan.vehiclesLimit(),
                        currentPlan.activeAdsLimit(),
                        currentPlan.features(),
                        buildEnabledModules(currentPlan.features()),
                        usage,
                        availablePlans,
                        nextInvoice,
                        paidInvoices
                ))
                .orElseGet(() -> new BillingSnapshot(
                        false,
                        currentPlan.planId(),
                        currentPlan.planKey(),
                        currentPlan.planName(),
                        "pending_configuration",
                        resolvedAmountCents,
                        "brl",
                        resolvedBillingInterval,
                        null,
                        false,
                        BILLING_PROVIDER,
                        "",
                        "",
                        null,
                        "",
                        null,
                        null,
                        currentPlan.usersLimit(),
                        currentPlan.vehiclesLimit(),
                        currentPlan.activeAdsLimit(),
                        currentPlan.features(),
                        buildEnabledModules(currentPlan.features()),
                        usage,
                        availablePlans,
                        null,
                        List.of()
                ));
    }

    @Transactional
    public void dismissPlanChangeNotice(UUID companyId) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        StoredPlanChangeNotice storedNotice = parseStoredPlanChangeNotice(company.getPendingPlanChangeNoticeJson(), company.getId());
        if (storedNotice != null && storedNotice.requiresAction() && !isPlanChangeNoticePaymentSettled(storedNotice)) {
            throw new BusinessException(
                    "PLAN_CHANGE_NOTICE_PAYMENT_PENDING",
                    "Ainda existe uma cobranca pendente da troca de plano. Finalize o pagamento para concluir."
            );
        }
        company.setPendingPlanChangeNoticeJson(null);
        company.setPendingPlanChangeNoticeCreatedAt(null);
        company.setUpdatedAt(Instant.now());
        companyRepo.save(company);
    }

    @Transactional
    public void registerSuperAdminPlanChangeNotice(
            UUID companyId,
            PlanChangePreviewResponse preview,
            PlanChangeConfirmResponse confirm
    ) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        Instant now = Instant.now();
        StoredPlanChangeNotice notice = buildStoredPlanChangeNotice(preview, confirm, now);
        company.setPendingPlanChangeNoticeJson(toJson(notice));
        company.setPendingPlanChangeNoticeCreatedAt(now);
        company.setUpdatedAt(now);
        companyRepo.save(company);
    }

    @Transactional
    public BillingSnapshot applySuperAdminManagedPlanChange(UUID companyId, String targetPlanKey, String targetBillingInterval) {
        confirmSuperAdminManagedPlanChange(companyId, targetPlanKey, targetBillingInterval, null);
        return getBillingSnapshotForSuperAdmin(companyId);
    }

    @Transactional
    public PlanChangeConfirmResponse confirmSuperAdminManagedPlanChange(
            UUID companyId,
            String targetPlanKey,
            String targetBillingInterval,
            Boolean requestedUpdatePendingPayments
    ) {
        PlanChangePreviewResponse preview = previewPlanChangeForSuperAdmin(companyId, targetPlanKey, targetBillingInterval);
        PlanChangeConfirmResponse confirm = confirmPlanChangeForSuperAdmin(
                companyId,
                targetPlanKey,
                targetBillingInterval,
                requestedUpdatePendingPayments
        );
        registerSuperAdminPlanChangeNotice(companyId, preview, confirm);
        return confirm;
    }

    public void assertPlanChangeAllowed(Set<String> roles) {
        Set<String> normalizedRoles = roles == null
                ? Set.of()
                : roles.stream().map(role -> normalizeText(role).toUpperCase(Locale.ROOT)).collect(java.util.stream.Collectors.toSet());
        if (normalizedRoles.contains("ADMIN") || normalizedRoles.contains("SUPERADMIN")) {
            return;
        }
        throw new BusinessException("BILLING_PLAN_CHANGE_FORBIDDEN", "Apenas administradores da conta podem alterar o plano da assinatura.");
    }

    @Transactional(readOnly = true)
    public PlanChangePreviewResponse previewPlanChange(UUID companyId, String targetPlanKey, String targetBillingInterval) {
        PlanChangeContext context = resolvePlanChangeContext(companyId, targetPlanKey, targetBillingInterval, false);
        return buildPlanChangePreviewResponse(context, null);
    }

    @Transactional(readOnly = true)
    public PlanChangePreviewResponse previewPlanChangeForSuperAdmin(UUID companyId, String targetPlanKey, String targetBillingInterval) {
        PlanChangeContext context = resolvePlanChangeContext(companyId, targetPlanKey, targetBillingInterval, true);
        if (!canUseManagedAsaasPlanChange(context)) {
            return buildSuperAdminLocalPlanChangePreview(context);
        }
        return buildPlanChangePreviewResponse(context, null);
    }

    @Transactional
    public BillingSnapshot changePlan(UUID companyId, UUID planId, String requestedBillingRecurrence) {
        SuperAdminPlanManagementService.PlanSnapshot targetPlan = planManagementService.listActivePlanSnapshots().stream()
                .filter(plan -> plan.planId().equals(planId))
                .findFirst()
                .orElseThrow(() -> new BusinessException("INVALID_PLAN", "O plano selecionado nao esta disponivel."));
        confirmPlanChange(companyId, targetPlan.planKey(), requestedBillingRecurrence, null);
        return getBillingSnapshot(companyId);
    }

    @Transactional
    public PlanChangeConfirmResponse confirmPlanChange(
            UUID companyId,
            String targetPlanKey,
            String targetBillingInterval,
            Boolean requestedUpdatePendingPayments
    ) {
        PlanChangeContext context = resolvePlanChangeContext(companyId, targetPlanKey, targetBillingInterval, false);
        return confirmPlanChangeUsingContext(context, requestedUpdatePendingPayments);
    }

    @Transactional
    public PlanChangeConfirmResponse confirmPlanChangeForSuperAdmin(
            UUID companyId,
            String targetPlanKey,
            String targetBillingInterval,
            Boolean requestedUpdatePendingPayments
    ) {
        PlanChangeContext context = resolvePlanChangeContext(companyId, targetPlanKey, targetBillingInterval, true);
        if (canUseManagedAsaasPlanChange(context)) {
            return confirmPlanChangeUsingContext(context, requestedUpdatePendingPayments);
        }

        BillingSnapshot snapshot = applySuperAdminLocalPlanChange(context);
        return new PlanChangeConfirmResponse(
                true,
                "Plano alterado com sucesso para " + context.targetPlan().planName() + " " + billingIntervalLabel(context.targetBillingInterval()).toLowerCase(Locale.ROOT) + ".",
                new PlanChangeSubscriptionSnapshot(
                        snapshot.planKey(),
                        snapshot.planName(),
                        snapshot.amountCents(),
                        snapshot.billingInterval(),
                        snapshot.status()
                ),
                null
        );
    }

    private PlanChangePreviewResponse buildPlanChangePreviewResponse(
            PlanChangeContext context,
            Boolean requestedUpdatePendingPayments
    ) {
        PlanChangeProrationPreview proration = buildPlanChangeProrationPreview(context);
        boolean updatePendingPayments = shouldUpdatePendingPayments(context, proration, requestedUpdatePendingPayments);
        String message = buildPlanChangeMessage(context, proration);

        log.info(
                "Billing plan change preview companyId={} currentPlan={} currentInterval={} targetPlan={} targetInterval={} changeType={} updatePendingPayments={} adjustmentMode={} deltaCents={}",
                context.company().getId(),
                context.currentPlan().planKey(),
                context.currentBillingInterval(),
                context.targetPlan().planKey(),
                context.targetBillingInterval(),
                context.changeType(),
                updatePendingPayments,
                proration.adjustmentMode(),
                proration.deltaCents()
        );

        return new PlanChangePreviewResponse(
                new PlanChangePlanSummary(
                        context.currentPlan().planKey(),
                        context.currentPlan().planName(),
                        context.currentAmountCents(),
                        context.currentBillingInterval()
                ),
                new PlanChangePlanSummary(
                        context.targetPlan().planKey(),
                        context.targetPlan().planName(),
                        context.targetAmountCents(),
                        context.targetBillingInterval()
                ),
                context.changeType().name(),
                toAsaasSubscriptionCycle(context.targetBillingInterval()),
                updatePendingPayments,
                true,
                message,
                proration
        );
    }

    private PlanChangeConfirmResponse confirmPlanChangeUsingContext(
            PlanChangeContext context,
            Boolean requestedUpdatePendingPayments
    ) {
        PlanChangeProrationPreview proration = buildPlanChangeProrationPreview(context);
        boolean updatePendingPayments = shouldUpdatePendingPayments(context, proration, requestedUpdatePendingPayments);

        log.info(
                "Billing plan change confirm companyId={} currentPlan={} currentInterval={} targetPlan={} targetInterval={} changeType={} updatePendingPayments={} adjustmentMode={} deltaCents={}",
                context.company().getId(),
                context.currentPlan().planKey(),
                context.currentBillingInterval(),
                context.targetPlan().planKey(),
                context.targetBillingInterval(),
                context.changeType(),
                updatePendingPayments,
                proration.adjustmentMode(),
                proration.deltaCents()
        );

        AsaasSubscriptionMutation asaasMutation = syncPlanChangeWithAsaas(context, updatePendingPayments);
        PlanChangeAdjustmentResult adjustment;
        try {
            adjustment = applyPlanChangeProration(context, proration, asaasMutation);
        } catch (BusinessException exception) {
            rollbackSubscriptionPlanChange(context);
            throw exception;
        }
        BillingSnapshot snapshot = persistPlanChange(context, asaasMutation, adjustment);

        return new PlanChangeConfirmResponse(
                true,
                buildPlanChangeSuccessMessage(context, adjustment),
                new PlanChangeSubscriptionSnapshot(
                        snapshot.planKey(),
                        snapshot.planName(),
                        snapshot.amountCents(),
                        snapshot.billingInterval(),
                        snapshot.status()
                ),
                adjustment
        );
    }

    private BillingSnapshot persistPlanChange(
            PlanChangeContext context,
            AsaasSubscriptionMutation asaasMutation,
            PlanChangeAdjustmentResult adjustment
    ) {
        Instant now = Instant.now();
        JpaCompanyEntity company = context.company();
        JpaIoAutoBillingSubscriptionEntity subscription = context.subscription();

        String persistedBillingRecurrence = normalizeBillingRecurrence(asaasMutation.billingInterval());
        if (persistedBillingRecurrence.isBlank()) {
            persistedBillingRecurrence = context.targetBillingInterval();
        }
        Long persistedAmountCents = asaasMutation.amountCents() != null
                ? asaasMutation.amountCents()
                : context.targetAmountCents();

        company.setPlanId(context.targetPlan().planId());
        company.setSubscriptionAmountCents(persistedAmountCents);
        company.setBillingRecurrence(persistedBillingRecurrence);
        if (company.getSubscriptionStatus() == null || company.getSubscriptionStatus().isBlank()) {
            company.setSubscriptionStatus("ACTIVE");
        }
        company.setUpdatedAt(now);
        companyRepo.save(company);

        subscription.setPlanKey(context.targetPlan().planKey());
        subscription.setPlanName(context.targetPlan().planName());
        subscription.setAmountCents(persistedAmountCents);
        subscription.setBillingInterval(persistedBillingRecurrence);
        subscription.setProviderPriceId(context.targetPlan().planKey());
        subscription.setProviderCustomerId(normalizeText(asaasMutation.providerCustomerId(), subscription.getProviderCustomerId()));
        subscription.setProviderSubscriptionId(normalizeText(asaasMutation.providerSubscriptionId(), subscription.getProviderSubscriptionId()));
        subscription.setStatus(normalizePaymentStatus(asaasMutation.status()));
        if (asaasMutation.currentPeriodEnd() != null) {
            subscription.setCurrentPeriodEnd(asaasMutation.currentPeriodEnd());
        }
        applyPendingProrationCreditState(subscription, adjustment, now);
        subscription.setUpdatedAt(now);
        subscriptions.save(subscription);

        syncOnboardingSubscriptionPlan(
                context.company().getId(),
                context.targetPlan().planName(),
                persistedAmountCents,
                persistedBillingRecurrence,
                now
        );
        return getBillingSnapshot(context.company().getId());
    }

    private PlanChangeContext resolvePlanChangeContext(
            UUID companyId,
            String targetPlanKey,
            String targetBillingInterval,
            boolean superAdminMode
    ) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> resolvedSubscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan);
        JpaIoAutoBillingSubscriptionEntity subscription = resolvedSubscription.orElseGet(
                () -> buildVirtualBillingSubscription(company, currentPlan)
        );

        if (!superAdminMode && resolvedSubscription.isEmpty()) {
            throw new BusinessException("BILLING_NOT_FOUND", "Nao existe uma assinatura vinculada a esta conta.");
        }

        if (!superAdminMode) {
            assertSubscriptionIsManageable(company, subscription);
        }

        SuperAdminPlanManagementService.PlanSnapshot targetPlan = resolveActivePlanByKey(targetPlanKey);
        String currentBillingInterval = resolveBillingIntervalForPlanChange(subscription, company.getBillingRecurrence(), currentPlan);
        String resolvedTargetBillingInterval = resolveTargetBillingInterval(targetBillingInterval, targetPlan, currentBillingInterval);

        Long currentAmountCents = resolveAmountForPlanChange(subscription, company.getSubscriptionAmountCents(), currentPlan, currentBillingInterval);
        Long targetAmountCents = targetPlan.priceForRecurrence(resolvedTargetBillingInterval);
        if (targetAmountCents == null) {
            throw new BusinessException("INVALID_BILLING_INTERVAL", "O ciclo selecionado nao esta disponivel para este plano.");
        }

        SuperAdminPlanManagementService.PlanCompatibility compatibility = superAdminMode
                ? planManagementService.evaluateTenantPlanCompatibilityForSuperAdmin(
                companyId,
                targetPlan,
                resolvedTargetBillingInterval,
                targetAmountCents
        )
                : planManagementService.evaluateTenantPlanCompatibility(companyId, targetPlan);
        if (!compatibility.eligible()) {
            throw new BusinessException(
                    "PLAN_LIMIT_EXCEEDED",
                    compatibility.blockingReasons().isEmpty()
                            ? "Sua empresa utiliza recursos acima do limite do plano selecionado."
                            : compatibility.blockingReasons().get(0)
            );
        }

        if (currentPlan.planKey().equalsIgnoreCase(targetPlan.planKey()) && currentBillingInterval.equalsIgnoreCase(resolvedTargetBillingInterval)) {
            throw new BusinessException("PLAN_CHANGE_REDUNDANT", "O plano e o ciclo selecionados ja estao ativos na sua assinatura.");
        }

        String providerSubscriptionId = normalizeText(subscription.getProviderSubscriptionId());
        if (!superAdminMode && providerSubscriptionId.isBlank()) {
            throw new BusinessException(
                    "MISSING_PROVIDER_SUBSCRIPTION",
                    "Nao encontramos uma assinatura vinculada para alteracao automatica. Entre em contato com o suporte."
            );
        }

        BillingChangeType changeType = determineBillingChangeType(
                currentPlan,
                targetPlan,
                currentBillingInterval,
                resolvedTargetBillingInterval,
                currentAmountCents,
                targetAmountCents
        );

        return new PlanChangeContext(
                company,
                subscription,
                currentPlan,
                targetPlan,
                currentBillingInterval,
                resolvedTargetBillingInterval,
                currentAmountCents,
                targetAmountCents,
                providerSubscriptionId,
                changeType
        );
    }

    private String resolvePreferredBillingIntervalForPlan(
            SuperAdminPlanManagementService.PlanSnapshot plan,
            String currentBillingInterval
    ) {
        if (plan.supportedBillingIntervals().contains(currentBillingInterval)) {
            return currentBillingInterval;
        }
        if (!plan.supportedBillingIntervals().isEmpty()) {
            return plan.supportedBillingIntervals().getFirst();
        }
        String fallback = normalizeBillingRecurrence(plan.billingRecurrence());
        return fallback.isBlank() ? "MONTHLY" : fallback;
    }

    private boolean canUseManagedAsaasPlanChange(PlanChangeContext context) {
        return !normalizeText(context.providerSubscriptionId()).isBlank()
                && !isSubscriptionInactiveForPlanChange(context.company(), context.subscription());
    }

    private PlanChangePreviewResponse buildSuperAdminLocalPlanChangePreview(PlanChangeContext context) {
        PlanChangeProrationPreview proration = new PlanChangeProrationPreview(
                null,
                null,
                0,
                0,
                0,
                null,
                null,
                0L,
                "NONE",
                null,
                null,
                false,
                "Alteracao aplicada localmente pelo superadmin, sem ajuste automatico de pro-rata."
        );

        String message = "Plano alterado localmente no tenant. Caso necessario, ajuste a cobranca no provedor posteriormente.";
        return new PlanChangePreviewResponse(
                new PlanChangePlanSummary(
                        context.currentPlan().planKey(),
                        context.currentPlan().planName(),
                        context.currentAmountCents(),
                        context.currentBillingInterval()
                ),
                new PlanChangePlanSummary(
                        context.targetPlan().planKey(),
                        context.targetPlan().planName(),
                        context.targetAmountCents(),
                        context.targetBillingInterval()
                ),
                context.changeType().name(),
                toAsaasSubscriptionCycle(context.targetBillingInterval()),
                false,
                true,
                message,
                proration
        );
    }

    private BillingSnapshot applySuperAdminLocalPlanChange(PlanChangeContext context) {
        Instant now = Instant.now();
        JpaCompanyEntity company = context.company();

        company.setPlanId(context.targetPlan().planId());
        company.setSubscriptionAmountCents(context.targetAmountCents());
        company.setBillingRecurrence(context.targetBillingInterval());
        if (company.getSubscriptionStatus() == null || company.getSubscriptionStatus().isBlank()) {
            company.setSubscriptionStatus("ACTIVE");
        }
        company.setUpdatedAt(now);
        companyRepo.save(company);

        JpaIoAutoBillingSubscriptionEntity persistedSubscription = subscriptions
                .findTopByCompanyIdOrderByUpdatedAtDesc(company.getId())
                .orElseGet(() -> {
                    JpaIoAutoBillingSubscriptionEntity created = new JpaIoAutoBillingSubscriptionEntity();
                    created.setId(UUID.randomUUID());
                    created.setCompanyId(company.getId());
                    created.setProvider(BILLING_PROVIDER);
                    created.setCurrency("brl");
                    created.setCreatedAt(now);
                    return created;
                });

        persistedSubscription.setPlanKey(context.targetPlan().planKey());
        persistedSubscription.setPlanName(context.targetPlan().planName());
        persistedSubscription.setAmountCents(context.targetAmountCents());
        persistedSubscription.setBillingInterval(context.targetBillingInterval());
        persistedSubscription.setProviderPriceId(context.targetPlan().planKey());
        if (normalizeText(persistedSubscription.getStatus()).isBlank()) {
            persistedSubscription.setStatus("ACTIVE");
        }
        persistedSubscription.setUpdatedAt(now);
        subscriptions.save(persistedSubscription);

        syncOnboardingSubscriptionPlan(
                company.getId(),
                context.targetPlan().planName(),
                context.targetAmountCents(),
                context.targetBillingInterval(),
                now
        );
        return getBillingSnapshotForSuperAdmin(company.getId());
    }

    private SuperAdminPlanManagementService.PlanSnapshot resolveActivePlanByKey(String targetPlanKey) {
        String normalizedPlanKey = normalizeText(targetPlanKey);
        if (normalizedPlanKey.isBlank()) {
            throw new BusinessException("INVALID_PLAN", "O plano selecionado nao esta disponivel.");
        }

        return planManagementService.listActivePlanSnapshots().stream()
                .filter(plan -> normalizedPlanKey.equalsIgnoreCase(plan.planKey()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("INVALID_PLAN", "O plano selecionado nao esta disponivel."));
    }

    private Optional<JpaIoAutoBillingSubscriptionEntity> resolveBillingSubscriptionMirror(
            UUID companyId,
            JpaCompanyEntity company,
            SuperAdminPlanManagementService.PlanSnapshot currentPlan
    ) {
        Optional<JpaIoAutoBillingSubscriptionEntity> localSubscription = subscriptions.findTopByCompanyIdOrderByUpdatedAtDesc(companyId);
        if (localSubscription.isPresent()) {
            return localSubscription;
        }

        return onboardingSubscriptions.findByCompanyId(companyId)
                .map(onboardingSubscription -> buildBillingSubscriptionMirror(company, currentPlan, onboardingSubscription));
    }

    private JpaIoAutoBillingSubscriptionEntity buildBillingSubscriptionMirror(
            JpaCompanyEntity company,
            SuperAdminPlanManagementService.PlanSnapshot currentPlan,
            JpaOnboardingSubscriptionEntity onboardingSubscription
    ) {
        Instant now = Instant.now();
        String billingInterval = normalizeBillingRecurrence(onboardingSubscription.getRecorrencia());
        if (billingInterval.isBlank()) {
            billingInterval = normalizeBillingRecurrence(company.getBillingRecurrence());
        }
        if (billingInterval.isBlank()) {
            billingInterval = normalizeBillingRecurrence(currentPlan.billingRecurrence());
        }
        if (billingInterval.isBlank() && !currentPlan.supportedBillingIntervals().isEmpty()) {
            billingInterval = normalizeBillingRecurrence(currentPlan.supportedBillingIntervals().getFirst());
        }
        if (billingInterval.isBlank()) {
            billingInterval = "MONTHLY";
        }

        Long amountCents = onboardingSubscription.getValor() != null
                ? toCents(onboardingSubscription.getValor())
                : company.getSubscriptionAmountCents() != null
                ? company.getSubscriptionAmountCents()
                : currentPlan.priceForRecurrence(billingInterval);

        JpaIoAutoBillingSubscriptionEntity mirror = new JpaIoAutoBillingSubscriptionEntity();
        mirror.setId(UUID.randomUUID());
        mirror.setCompanyId(company.getId());
        mirror.setProvider(BILLING_PROVIDER);
        mirror.setProviderCustomerId("");
        mirror.setProviderSubscriptionId(normalizeText(onboardingSubscription.getAsaasSubscriptionId()));
        mirror.setProviderPriceId(currentPlan.planKey());
        mirror.setPlanKey(currentPlan.planKey());
        mirror.setPlanName(currentPlan.planName());
        mirror.setStatus(normalizePaymentStatus(normalizeText(onboardingSubscription.getStatus(), company.getSubscriptionStatus())));
        mirror.setAmountCents(amountCents);
        mirror.setCurrency("brl");
        mirror.setBillingInterval(billingInterval);
        mirror.setCurrentPeriodEnd(company.getContractEndDate() == null ? null : toPeriodBoundary(company.getContractEndDate()));
        mirror.setCancelAtPeriodEnd(false);
        mirror.setCheckoutSessionId("");
        mirror.setCreatedAt(onboardingSubscription.getCreatedAt() == null ? now : onboardingSubscription.getCreatedAt());
        mirror.setUpdatedAt(onboardingSubscription.getUpdatedAt() == null ? now : onboardingSubscription.getUpdatedAt());

        log.info(
                "Billing subscription mirror reconstructed from onboarding companyId={} asaasSubscriptionId={}",
                company.getId(),
                normalizeText(onboardingSubscription.getAsaasSubscriptionId())
        );
        return mirror;
    }

    private JpaIoAutoBillingSubscriptionEntity buildVirtualBillingSubscription(
            JpaCompanyEntity company,
            SuperAdminPlanManagementService.PlanSnapshot currentPlan
    ) {
        Instant now = Instant.now();
        String billingInterval = normalizeBillingRecurrence(company.getBillingRecurrence());
        if (billingInterval.isBlank()) {
            billingInterval = normalizeBillingRecurrence(currentPlan.billingRecurrence());
        }
        if (billingInterval.isBlank()) {
            billingInterval = "MONTHLY";
        }

        Long amountCents = company.getSubscriptionAmountCents() != null
                ? company.getSubscriptionAmountCents()
                : currentPlan.priceForRecurrence(billingInterval);

        JpaIoAutoBillingSubscriptionEntity virtual = new JpaIoAutoBillingSubscriptionEntity();
        virtual.setId(UUID.randomUUID());
        virtual.setCompanyId(company.getId());
        virtual.setProvider(BILLING_PROVIDER);
        virtual.setProviderCustomerId("");
        virtual.setProviderSubscriptionId("");
        virtual.setProviderPriceId(currentPlan.planKey());
        virtual.setPlanKey(currentPlan.planKey());
        virtual.setPlanName(currentPlan.planName());
        virtual.setStatus(normalizePaymentStatus(normalizeText(company.getSubscriptionStatus(), "ACTIVE")));
        virtual.setAmountCents(amountCents);
        virtual.setCurrency("brl");
        virtual.setBillingInterval(billingInterval);
        virtual.setCurrentPeriodEnd(null);
        virtual.setCancelAtPeriodEnd(false);
        virtual.setCheckoutSessionId("");
        virtual.setCreatedAt(now);
        virtual.setUpdatedAt(now);
        return virtual;
    }

    private void assertSubscriptionIsManageable(JpaCompanyEntity company, JpaIoAutoBillingSubscriptionEntity subscription) {
        if (isSubscriptionInactiveForPlanChange(company, subscription)) {
            throw new BusinessException("BILLING_SUBSCRIPTION_INACTIVE", "A conta nao possui uma assinatura ativa para alteracao.");
        }
    }

    private boolean isSubscriptionInactiveForPlanChange(JpaCompanyEntity company, JpaIoAutoBillingSubscriptionEntity subscription) {
        String subscriptionStatus = normalizeText(subscription.getStatus()).toUpperCase(Locale.ROOT);
        String companySubscriptionStatus = normalizeText(company.getSubscriptionStatus()).toUpperCase(Locale.ROOT);
        return "CANCELED".equals(subscriptionStatus)
                || "CANCELLED".equals(subscriptionStatus)
                || "CANCELED".equals(companySubscriptionStatus)
                || "CANCELLED".equals(companySubscriptionStatus)
                || "PENDING_CONFIGURATION".equals(subscriptionStatus);
    }

    private String resolveBillingIntervalForPlanChange(
            JpaIoAutoBillingSubscriptionEntity subscription,
            String companyBillingRecurrence,
            SuperAdminPlanManagementService.PlanSnapshot currentPlan
    ) {
        String resolved = normalizeBillingRecurrence(subscription.getBillingInterval());
        if (resolved.isBlank()) {
            resolved = normalizeBillingRecurrence(companyBillingRecurrence);
        }
        if (resolved.isBlank()) {
            resolved = normalizeBillingRecurrence(currentPlan.billingRecurrence());
        }
        if (resolved.isBlank() && !currentPlan.supportedBillingIntervals().isEmpty()) {
            resolved = normalizeBillingRecurrence(currentPlan.supportedBillingIntervals().getFirst());
        }
        return resolved.isBlank() ? "MONTHLY" : resolved;
    }

    private String resolveTargetBillingInterval(
            String requestedBillingInterval,
            SuperAdminPlanManagementService.PlanSnapshot targetPlan,
            String currentBillingInterval
    ) {
        String resolved = normalizeBillingRecurrence(requestedBillingInterval);
        if (resolved.isBlank() && targetPlan.supportedBillingIntervals().contains(currentBillingInterval)) {
            resolved = currentBillingInterval;
        }
        if (resolved.isBlank() && !targetPlan.supportedBillingIntervals().isEmpty()) {
            resolved = normalizeBillingRecurrence(targetPlan.supportedBillingIntervals().getFirst());
        }
        if (resolved.isBlank()) {
            resolved = normalizeBillingRecurrence(targetPlan.billingRecurrence());
        }
        if (resolved.isBlank()) {
            throw new BusinessException("INVALID_BILLING_INTERVAL", "O ciclo selecionado nao esta disponivel para este plano.");
        }
        if (!targetPlan.supportedBillingIntervals().contains(resolved)) {
            throw new BusinessException("INVALID_BILLING_INTERVAL", "O ciclo selecionado nao esta disponivel para este plano.");
        }
        return resolved;
    }

    private Long resolveAmountForPlanChange(
            JpaIoAutoBillingSubscriptionEntity subscription,
            Long companyAmountCents,
            SuperAdminPlanManagementService.PlanSnapshot plan,
            String billingInterval
    ) {
        if (subscription.getAmountCents() != null) {
            return subscription.getAmountCents();
        }
        if (companyAmountCents != null) {
            return companyAmountCents;
        }
        return plan.priceForRecurrence(billingInterval);
    }

    private BillingChangeType determineBillingChangeType(
            SuperAdminPlanManagementService.PlanSnapshot currentPlan,
            SuperAdminPlanManagementService.PlanSnapshot targetPlan,
            String currentBillingInterval,
            String targetBillingInterval,
            Long currentAmountCents,
            Long targetAmountCents
    ) {
        if (currentPlan.planKey().equalsIgnoreCase(targetPlan.planKey()) && !currentBillingInterval.equalsIgnoreCase(targetBillingInterval)) {
            return BillingChangeType.CYCLE_CHANGE;
        }
        long safeCurrentAmount = currentAmountCents == null ? 0L : currentAmountCents;
        long safeTargetAmount = targetAmountCents == null ? 0L : targetAmountCents;
        if (safeTargetAmount > safeCurrentAmount) return BillingChangeType.UPGRADE;
        if (safeTargetAmount < safeCurrentAmount) return BillingChangeType.DOWNGRADE;
        return BillingChangeType.PLAN_CHANGE;
    }

    private boolean shouldUpdatePendingPayments(
            PlanChangeContext context,
            PlanChangeProrationPreview proration,
            Boolean requestedUpdatePendingPayments
    ) {
        if (proration != null && !"NONE".equalsIgnoreCase(normalizeText(proration.adjustmentMode()))) {
            return false;
        }
        boolean recommended = context.changeType() == BillingChangeType.UPGRADE
                && (proration == null || "NONE".equals(proration.adjustmentMode()));
        return recommended && Boolean.TRUE.equals(requestedUpdatePendingPayments == null ? Boolean.TRUE : requestedUpdatePendingPayments);
    }

    private String buildPlanChangeMessage(PlanChangeContext context, PlanChangeProrationPreview proration) {
        String targetPlanLabel = context.targetPlan().planName() + " " + billingIntervalLabel(context.targetBillingInterval()).toLowerCase(Locale.ROOT);
        String planMessage = switch (context.changeType()) {
            case UPGRADE -> "Sua assinatura sera alterada para o plano " + targetPlanLabel + ".";
            case DOWNGRADE -> "Sua assinatura sera alterada para o plano " + targetPlanLabel + ".";
            case CYCLE_CHANGE -> "Seu ciclo de pagamento sera alterado para " + billingIntervalLabel(context.targetBillingInterval()).toLowerCase(Locale.ROOT) + ".";
            case PLAN_CHANGE -> "Sua assinatura sera alterada para o plano " + targetPlanLabel + ".";
        };
        if (proration == null || normalizeText(proration.message()).isBlank()) {
            return planMessage;
        }
        return planMessage + " " + proration.message();
    }

    private String buildPlanChangeSuccessMessage(PlanChangeContext context, PlanChangeAdjustmentResult adjustment) {
        String targetPlanLabel = context.targetPlan().planName() + " " + billingIntervalLabel(context.targetBillingInterval()).toLowerCase(Locale.ROOT);
        String baseMessage = "Plano alterado com sucesso para " + targetPlanLabel + ".";
        if (adjustment == null || normalizeText(adjustment.message()).isBlank()) {
            return baseMessage;
        }
        return baseMessage + " " + adjustment.message();
    }

    private PlanChangeProrationPreview buildPlanChangeProrationPreview(PlanChangeContext context) {
        LocalDate today = LocalDate.now(BILLING_ZONE);
        LocalDate periodEndExclusive = resolveCurrentPeriodEndDate(context);
        if (periodEndExclusive == null) {
            return new PlanChangeProrationPreview(
                    null,
                    null,
                    0,
                    0,
                    0,
                    null,
                    null,
                    0L,
                    "NONE",
                    null,
                    null,
                    false,
                    "Nao foi possivel identificar o ciclo atual para calcular o pro-rata automaticamente."
            );
        }

        LocalDate periodStartInclusive = subtractBillingInterval(periodEndExclusive, context.currentBillingInterval());
        if (hasSubscriptionStarted(context, today)) {
            BillingPeriodWindow alignedWindow = alignPeriodWindowWithToday(
                    context.currentBillingInterval(),
                    today,
                    periodStartInclusive,
                    periodEndExclusive
            );
            periodStartInclusive = alignedWindow.periodStartInclusive();
            periodEndExclusive = alignedWindow.periodEndExclusive();
        }
        long totalCycleDays = Math.max(1L, ChronoUnit.DAYS.between(periodStartInclusive, periodEndExclusive));

        if (today.isBefore(periodStartInclusive)) {
            return new PlanChangeProrationPreview(
                    periodStartInclusive.toString(),
                    periodEndExclusive.minusDays(1).toString(),
                    totalCycleDays,
                    totalCycleDays,
                    0,
                    context.currentAmountCents(),
                    context.targetAmountCents(),
                    safeDelta(context.currentAmountCents(), context.targetAmountCents()),
                    "UPCOMING_PAYMENT_UPDATE",
                    null,
                    null,
                    false,
                    "A cobranca do ciclo atual ainda nao entrou em uso. O sistema vai substituir a cobranca pendente pelo valor integral do novo plano."
            );
        }

        long remainingDays = Math.max(0L, ChronoUnit.DAYS.between(today, periodEndExclusive));
        long elapsedDays = Math.max(0L, totalCycleDays - remainingDays);
        if (remainingDays <= 0L) {
            return new PlanChangeProrationPreview(
                    periodStartInclusive.toString(),
                    periodEndExclusive.minusDays(1).toString(),
                    totalCycleDays,
                    0,
                    elapsedDays,
                    0L,
                    0L,
                    0L,
                    "NONE",
                    null,
                    null,
                    false,
                    "O ciclo atual ja encerrou. A troca sera aplicada normalmente sem ajuste proporcional pendente."
            );
        }

        long currentCycleDays = totalCycleDays;
        long targetCycleDays = resolveCycleLengthDays(periodStartInclusive, context.targetBillingInterval());
        long currentRemainingCents = proratedAmountCents(context.currentAmountCents(), remainingDays, currentCycleDays);
        long targetRemainingCents = proratedAmountCents(context.targetAmountCents(), remainingDays, targetCycleDays);
        long deltaCents = targetRemainingCents - currentRemainingCents;

        String adjustmentMode;
        Long immediateChargeCents = null;
        Long creditNextCycleCents = null;
        String message;
        if (deltaCents > 0L) {
            adjustmentMode = "IMMEDIATE_CHARGE";
            immediateChargeCents = deltaCents;
            message = "Sera gerada uma cobranca proporcional de " + formatMoneyText(deltaCents) + " referente aos " + remainingDays + " dias restantes do ciclo atual.";
        } else if (deltaCents < 0L) {
            adjustmentMode = "NEXT_CYCLE_CREDIT";
            creditNextCycleCents = Math.abs(deltaCents);
            message = "O sistema vai gerar um credito proporcional de " + formatMoneyText(Math.abs(deltaCents)) + " para abater das proximas cobrancas da assinatura.";
        } else {
            adjustmentMode = "NONE";
            message = "A troca nao gera diferenca proporcional no ciclo atual.";
        }

        return new PlanChangeProrationPreview(
                periodStartInclusive.toString(),
                periodEndExclusive.minusDays(1).toString(),
                totalCycleDays,
                remainingDays,
                elapsedDays,
                currentRemainingCents,
                targetRemainingCents,
                deltaCents,
                adjustmentMode,
                immediateChargeCents,
                creditNextCycleCents,
                true,
                message
        );
    }

    private BillingPeriodWindow alignPeriodWindowWithToday(
            String billingInterval,
            LocalDate today,
            LocalDate initialPeriodStartInclusive,
            LocalDate initialPeriodEndExclusive
    ) {
        LocalDate periodStartInclusive = initialPeriodStartInclusive;
        LocalDate periodEndExclusive = initialPeriodEndExclusive;
        String asaasCycle = toAsaasSubscriptionCycle(billingInterval);

        int guard = 0;
        while (today.isBefore(periodStartInclusive) && guard < 36) {
            periodEndExclusive = periodStartInclusive;
            periodStartInclusive = subtractBillingInterval(periodEndExclusive, billingInterval);
            guard++;
        }

        guard = 0;
        while (!today.isBefore(periodEndExclusive) && guard < 36) {
            periodStartInclusive = periodEndExclusive;
            periodEndExclusive = advanceCycle(periodStartInclusive, asaasCycle);
            guard++;
        }

        return new BillingPeriodWindow(periodStartInclusive, periodEndExclusive);
    }

    private boolean hasSubscriptionStarted(PlanChangeContext context, LocalDate today) {
        if (context == null || context.company() == null) {
            return false;
        }

        Instant subscriptionStartedAt = context.company().getSubscriptionStartedAt();
        if (subscriptionStartedAt != null) {
            LocalDate startedOn = subscriptionStartedAt.atZone(BILLING_ZONE).toLocalDate();
            return !today.isBefore(startedOn);
        }
        return false;
    }

    private long safeDelta(Long currentAmountCents, Long targetAmountCents) {
        long current = currentAmountCents == null ? 0L : currentAmountCents;
        long target = targetAmountCents == null ? 0L : targetAmountCents;
        return target - current;
    }

    private LocalDate resolveCurrentPeriodEndDate(PlanChangeContext context) {
        Instant currentPeriodEnd = context.subscription().getCurrentPeriodEnd();
        if (currentPeriodEnd != null) {
            return currentPeriodEnd.atZone(BILLING_ZONE).toLocalDate();
        }
        if (context.company().getContractEndDate() != null) {
            return context.company().getContractEndDate();
        }
        return null;
    }

    private LocalDate subtractBillingInterval(LocalDate endExclusive, String billingInterval) {
        String normalized = normalizeBillingRecurrence(billingInterval);
        return switch (normalized) {
            case "WEEKLY" -> endExclusive.minusWeeks(1);
            case "BIWEEKLY" -> endExclusive.minusWeeks(2);
            case "QUARTERLY" -> endExclusive.minusMonths(3);
            case "SEMIANNUALLY" -> endExclusive.minusMonths(6);
            case "ANNUAL", "YEARLY" -> endExclusive.minusYears(1);
            default -> endExclusive.minusMonths(1);
        };
    }

    private long resolveCycleLengthDays(LocalDate cycleAnchor, String billingInterval) {
        LocalDate cycleEndExclusive = advanceCycle(cycleAnchor, toAsaasSubscriptionCycle(billingInterval));
        return Math.max(1L, ChronoUnit.DAYS.between(cycleAnchor, cycleEndExclusive));
    }

    private long proratedAmountCents(Long fullAmountCents, long remainingDays, long totalCycleDays) {
        long safeAmount = fullAmountCents == null ? 0L : Math.max(fullAmountCents, 0L);
        if (safeAmount == 0L || remainingDays <= 0L || totalCycleDays <= 0L) {
            return 0L;
        }
        BigDecimal prorated = BigDecimal.valueOf(safeAmount)
                .multiply(BigDecimal.valueOf(remainingDays))
                .divide(BigDecimal.valueOf(totalCycleDays), 0, RoundingMode.HALF_UP);
        return prorated.longValue();
    }

    private String formatMoneyText(long amountCents) {
        return "R$ " + BigDecimal.valueOf(amountCents, 2).setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private BillingPlanChangeNotice readPlanChangeNotice(JpaCompanyEntity company) {
        if (company == null) {
            return null;
        }
        StoredPlanChangeNotice stored = parseStoredPlanChangeNotice(company.getPendingPlanChangeNoticeJson(), company.getId());
        if (stored == null) {
            return null;
        }

        boolean paymentSettled = isPlanChangeNoticePaymentSettled(stored);
        boolean active = !stored.requiresAction() || !paymentSettled;
        return new BillingPlanChangeNotice(
                active,
                normalizeText(stored.title()),
                normalizeText(stored.message()),
                normalizeText(stored.currentPlanName()),
                normalizeText(stored.targetPlanName()),
                normalizeText(stored.targetBillingInterval()),
                normalizeText(stored.changeType()),
                stored.unlockedFeatures() == null ? List.of() : List.copyOf(stored.unlockedFeatures()),
                normalizeText(stored.prorationAdjustmentMode()),
                stored.immediateChargeCents(),
                stored.creditNextCycleCents(),
                stored.remainingCreditCents(),
                normalizeText(stored.invoiceUrl()),
                normalizeText(stored.paymentId()),
                stored.requiresAction(),
                stored.createdAt()
        );
    }

    private StoredPlanChangeNotice parseStoredPlanChangeNotice(String rawNoticeJson, UUID companyId) {
        String raw = normalizeText(rawNoticeJson);
        if (raw.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(raw, StoredPlanChangeNotice.class);
        } catch (Exception exception) {
            log.warn(
                    "Failed to parse pending plan change notice companyId={} reason={}",
                    companyId,
                    normalizeText(exception.getMessage(), exception.getClass().getSimpleName())
            );
            return null;
        }
    }

    private boolean isPlanChangeNoticePaymentSettled(StoredPlanChangeNotice notice) {
        if (notice == null || !notice.requiresAction()) {
            return true;
        }
        String paymentId = normalizeText(notice.paymentId());
        if (paymentId.isBlank() || asaasApiKey.isBlank()) {
            return false;
        }
        try {
            AsaasPayment payment = toAsaasPayment(callAsaas("GET", "/payments/" + urlEncode(paymentId), null));
            return isPaidPaymentStatus(payment.status());
        } catch (Exception exception) {
            log.warn(
                    "Unable to verify plan change notice payment status paymentId={} reason={}",
                    paymentId,
                    normalizeText(exception.getMessage(), exception.getClass().getSimpleName())
            );
            return false;
        }
    }

    private StoredPlanChangeNotice buildStoredPlanChangeNotice(
            PlanChangePreviewResponse preview,
            PlanChangeConfirmResponse confirm,
            Instant createdAt
    ) {
        PlanChangeAdjustmentResult adjustment = confirm == null ? null : confirm.adjustment();
        String title = "Seu plano foi alterado pela administracao da conta";
        String baseMessage = confirm != null && !normalizeText(confirm.message()).isBlank()
                ? confirm.message()
                : preview == null
                ? "Sua assinatura foi atualizada."
                : preview.message();
        String message = baseMessage + " Confira abaixo os recursos liberados e revise as faturas da assinatura no seu perfil.";
        boolean requiresAction = adjustment != null
                && adjustment.immediateChargeCents() != null
                && adjustment.immediateChargeCents() > 0L;
        List<String> unlockedFeatures = resolveUnlockedFeatures(preview);
        return new StoredPlanChangeNotice(
                title,
                message,
                preview == null || preview.currentPlan() == null ? "" : normalizeText(preview.currentPlan().name()),
                preview == null || preview.targetPlan() == null ? "" : normalizeText(preview.targetPlan().name()),
                preview == null || preview.targetPlan() == null ? "" : normalizeText(preview.targetPlan().billingInterval()),
                preview == null ? "" : normalizeText(preview.changeType()),
                unlockedFeatures,
                preview == null || preview.proration() == null ? "" : normalizeText(preview.proration().adjustmentMode()),
                adjustment == null ? null : adjustment.immediateChargeCents(),
                adjustment == null ? null : adjustment.appliedCreditCents(),
                adjustment == null ? null : adjustment.remainingCreditCents(),
                adjustment == null ? "" : normalizeText(adjustment.invoiceUrl()),
                adjustment == null ? "" : normalizeText(adjustment.paymentId()),
                requiresAction,
                createdAt
        );
    }

    private List<String> resolveUnlockedFeatures(PlanChangePreviewResponse preview) {
        if (preview == null || preview.currentPlan() == null || preview.targetPlan() == null) {
            return List.of();
        }

        Optional<SuperAdminPlanManagementService.PlanSnapshot> currentPlan = resolvePlanSnapshotByKey(preview.currentPlan().key());
        Optional<SuperAdminPlanManagementService.PlanSnapshot> targetPlan = resolvePlanSnapshotByKey(preview.targetPlan().key());
        if (currentPlan.isEmpty() || targetPlan.isEmpty()) {
            return List.of();
        }

        List<String> currentFeatures = buildEnabledModules(currentPlan.get().features());
        List<String> targetFeatures = buildEnabledModules(targetPlan.get().features());
        return targetFeatures.stream()
                .filter(feature -> !currentFeatures.contains(feature))
                .toList();
    }

    private Optional<SuperAdminPlanManagementService.PlanSnapshot> resolvePlanSnapshotByKey(String planKey) {
        String normalized = normalizeText(planKey);
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        return planManagementService.listActivePlanSnapshots().stream()
                .filter(plan -> normalized.equalsIgnoreCase(plan.planKey()))
                .findFirst();
    }

    @Transactional(readOnly = true)
    public BillingAccessStatusSnapshot getBillingAccessStatus(UUID companyId) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan);
        Optional<AsaasPayment> latestPayment = findLatestPaymentForCompany(subscription.orElse(null));
        Optional<AsaasPayment> regularizationPayment = findRegularizationPayment(subscription.orElse(null), latestPayment.orElse(null));

        return toAccessStatus(company, subscription.orElse(null), latestPayment.orElse(null), regularizationPayment.orElse(null));
    }

    @Transactional
    public BillingAccessStatusSnapshot verifyAndSyncBillingAccessStatus(UUID companyId) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan);
        Optional<AsaasPayment> latestPayment = findLatestPaymentForCompany(subscription.orElse(null));

        latestPayment.ifPresent(payment -> syncSubscription(companyId, payment, payment.checkoutSession()));

        JpaCompanyEntity refreshedCompany = companyRepo.findById(companyId).orElse(company);
        SuperAdminPlanManagementService.PlanSnapshot refreshedPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> refreshedSubscription = resolveBillingSubscriptionMirror(companyId, refreshedCompany, refreshedPlan);
        Optional<AsaasPayment> regularizationPayment = findRegularizationPayment(refreshedSubscription.orElse(null), latestPayment.orElse(null));

        return toAccessStatus(
                refreshedCompany,
                refreshedSubscription.orElse(null),
                latestPayment.orElse(null),
                regularizationPayment.orElse(null)
        );
    }

    @Transactional(readOnly = true)
    public BillingRegularizationOptions getRegularizationOptions(UUID companyId) {
        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan);
        Optional<AsaasPayment> latestPayment = findLatestPaymentForCompany(subscription.orElse(null));
        Optional<AsaasPayment> regularizationPayment = findRegularizationPayment(subscription.orElse(null), latestPayment.orElse(null));

        if (regularizationPayment.isEmpty()) {
            return new BillingRegularizationOptions(
                    false,
                    false,
                    false,
                    "Nao existem cobrancas pendentes para regularizacao no momento.",
                    null,
                    null,
                    null,
                    null,
                    null,
                    false,
                    false,
                    false
            );
        }

        AsaasPayment payment = regularizationPayment.get();
        PixQrCodeSnapshot pixSnapshot = fetchPixQrCodeSnapshot(payment);
        String billingType = normalizeText(payment.billingType()).toUpperCase(Locale.ROOT);

        boolean pix = "PIX".equals(billingType);
        boolean creditCard = "CREDIT_CARD".equals(billingType);

        String message = pix
                ? "Pagamento via Pix pendente. Exiba o QR Code e o copia e cola para o cliente."
                : creditCard
                ? "Pagamento via cartao pendente. O cliente pode pagar com o cartao salvo no link ou atualizar os dados."
                : "Pagamento pendente. Exiba o link da cobranca para regularizacao.";

        String cardLastDigits = extractCreditCardLastDigits(payment);
        String cardSummary = cardLastDigits == null ? null : "Cartao final " + cardLastDigits;

        return new BillingRegularizationOptions(
                true,
                pix,
                creditCard,
                message,
                normalizeText(payment.invoiceUrl()),
                pixSnapshot.copyPasteCode(),
                pixSnapshot.encodedImage(),
                pixSnapshot.expirationDate(),
                cardSummary,
                creditCard,
                creditCard,
                true
        );
    }

    public PortalLaunch createPortalSession(UUID companyId) {
        requireAsaasCheckoutConfiguration();

        JpaCompanyEntity company = companyRepo.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        JpaIoAutoBillingSubscriptionEntity subscription = resolveBillingSubscriptionMirror(companyId, company, currentPlan)
                .orElseThrow(() -> new BusinessException("BILLING_NOT_FOUND", "Nao existe uma assinatura vinculada a esta conta."));

        Optional<AsaasPayment> latestPayment = findLatestPaymentForCompany(subscription);
        Optional<AsaasPayment> payment = findRegularizationPayment(subscription, latestPayment.orElse(null));
        if (payment.isEmpty()) {
            payment = latestPayment;
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
            throw new BusinessException("BILLING_NOT_CONFIGURED", "Configure ASAAS_API_KEY ou ASAAS_ACCESS_TOKEN antes de usar o checkout.");
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

    private Optional<AsaasPayment> findLatestPaymentForCompany(JpaIoAutoBillingSubscriptionEntity subscription) {
        if (subscription == null) {
            return Optional.empty();
        }
        if (asaasApiKey.isBlank()) {
            return Optional.empty();
        }

        if (!normalizeText(subscription.getProviderSubscriptionId()).isBlank()) {
            Optional<AsaasPayment> bySubscription = selectMostRelevantPayment(
                    listPayments(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", "20"))
            );
            if (bySubscription.isPresent()) {
                return bySubscription;
            }
        }

        if (!normalizeText(subscription.getProviderCustomerId()).isBlank()) {
            return selectMostRelevantPayment(
                    listPayments(Map.of("customer", subscription.getProviderCustomerId(), "limit", "20"))
            );
        }

        return Optional.empty();
    }

    private Optional<AsaasPayment> findRegularizationPayment(
            JpaIoAutoBillingSubscriptionEntity subscription,
            AsaasPayment latestPayment
    ) {
        if (subscription == null) {
            return Optional.empty();
        }
        if (asaasApiKey.isBlank()) {
            return Optional.empty();
        }

        List<AsaasPayment> candidates = new ArrayList<>();
        if (!normalizeText(subscription.getProviderSubscriptionId()).isBlank()) {
            candidates.addAll(listPayments(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", "30")));
        } else if (!normalizeText(subscription.getProviderCustomerId()).isBlank()) {
            candidates.addAll(listPayments(Map.of("customer", subscription.getProviderCustomerId(), "limit", "30")));
        }

        if (latestPayment != null) {
            candidates.add(latestPayment);
        }

        return candidates.stream()
                .filter(item -> !normalizeText(item.invoiceUrl()).isBlank())
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> regularizationPriority(item.status()))
                        .thenComparing(item -> item.dueDate() == null ? LocalDate.MIN : item.dueDate())
                        .thenComparing(item -> item.createdAt() == null ? Instant.EPOCH : item.createdAt())
                        .reversed())
                .findFirst()
                .filter(item -> regularizationPriority(item.status()) > 0 || isPastDue(item));
    }

    private int regularizationPriority(String status) {
        String normalized = normalizeText(status).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "OVERDUE" -> 5;
            case "PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST", "BANK_PROCESSING" -> 4;
            case "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL" -> 3;
            case "REFUNDED", "FAILED", "CANCELED", "CANCELLED", "DELETED" -> 2;
            default -> 0;
        };
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

    private List<AsaasPayment> listPaymentsForSubscription(JpaIoAutoBillingSubscriptionEntity subscription, String limit) {
        if (subscription == null || asaasApiKey.isBlank()) {
            return List.of();
        }

        if (!normalizeText(subscription.getProviderSubscriptionId()).isBlank()) {
            return listPayments(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", limit));
        }

        if (!normalizeText(subscription.getProviderCustomerId()).isBlank()) {
            return listPayments(Map.of("customer", subscription.getProviderCustomerId(), "limit", limit));
        }

        return List.of();
    }

    private BillingInvoiceSummary resolveNextInvoiceSummary(
            JpaIoAutoBillingSubscriptionEntity subscription,
            String currentPlanName,
            String currency,
            Long expectedAmountCents
    ) {
        boolean hasPendingProrationCredit = subscription != null
                && subscription.getPendingProrationCreditCents() != null
                && subscription.getPendingProrationCreditCents() > 0L;

        return findNextPendingSubscriptionPayment(subscription, LocalDate.now(BILLING_ZONE))
                .map(payment -> hasPendingProrationCredit
                        ? payment
                        : repairUpcomingPendingPaymentIfStale(payment, currentPlanName, expectedAmountCents))
                .map(payment -> toBillingInvoiceSummary(payment, currentPlanName, currency))
                .orElse(null);
    }

    private AsaasPayment repairUpcomingPendingPaymentIfStale(
            AsaasPayment payment,
            String currentPlanName,
            Long expectedAmountCents
    ) {
        if (payment == null) {
            return null;
        }

        String normalizedPlanName = normalizeText(currentPlanName);
        String normalizedDescription = normalizeText(payment.description());
        boolean descriptionMatchesCurrentPlan = !normalizedPlanName.isBlank() && normalizedDescription.contains(normalizedPlanName);
        if (descriptionMatchesCurrentPlan) {
            return payment;
        }

        Long targetAmountCents = expectedAmountCents != null ? expectedAmountCents : toCents(payment.value());
        if (targetAmountCents == null) {
            return payment;
        }

        try {
            return updateAsaasPaymentValue(
                    payment,
                    targetAmountCents,
                    "Assinatura " + currentPlanName
            );
        } catch (BusinessException exception) {
            log.warn(
                    "Failed to repair upcoming pending payment paymentId={} currentPlan={} reason={}",
                    normalizeText(payment.id()),
                    currentPlanName,
                    exception.getMessage()
            );
            return payment;
        }
    }

    private List<BillingInvoiceSummary> listPaidInvoiceSummaries(
            JpaIoAutoBillingSubscriptionEntity subscription,
            String fallbackPlanName,
            String currency
    ) {
        return listPaymentsForSubscription(subscription, "50").stream()
                .filter(item -> !normalizeText(item.id()).isBlank())
                .filter(item -> isPaidPaymentStatus(item.status()))
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> item.confirmedAt() == null ? Instant.EPOCH : item.confirmedAt())
                        .thenComparing(item -> item.dueDate() == null ? LocalDate.MIN : item.dueDate())
                        .thenComparing(item -> item.createdAt() == null ? Instant.EPOCH : item.createdAt())
                        .reversed())
                .map(item -> toBillingInvoiceSummary(item, fallbackPlanName, currency))
                .limit(6)
                .toList();
    }

    private BillingInvoiceSummary toBillingInvoiceSummary(AsaasPayment payment, String fallbackPlanName, String currency) {
        Long amountCents = toCents(payment == null ? null : payment.value());
        return new BillingInvoiceSummary(
                normalizeText(payment == null ? null : payment.id()),
                normalizeText(payment == null ? null : payment.description(), fallbackPlanName),
                amountCents,
                normalizeText(currency, "brl"),
                payment == null ? null : payment.dueDate(),
                payment == null ? null : payment.confirmedAt(),
                normalizeText(payment == null ? null : payment.invoiceUrl()),
                normalizeText(payment == null ? null : payment.status())
        );
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
        AsaasPayment effectivePayment = applyPendingProrationCreditIfNeeded(payment);
        String normalizedCheckoutId = normalizeText(checkoutId, effectivePayment.checkoutSession());
        Optional<JpaIoAutoSignupIntentEntity> intentByCheckout = normalizedCheckoutId.isBlank()
                ? Optional.empty()
                : signupIntents.findByCheckoutSessionId(normalizedCheckoutId);

        if (intentByCheckout.isPresent()) {
            JpaIoAutoSignupIntentEntity intent = intentByCheckout.get();
            syncIntentReferences(intent, effectivePayment, normalizedCheckoutId);
            if (intent.getCompanyId() != null) {
                syncSubscription(intent.getCompanyId(), effectivePayment, normalizedCheckoutId);
            }
            if (isPaidPaymentStatus(effectivePayment.status())) {
                activateConfirmedIntent(intent, effectivePayment, normalizedCheckoutId);
            }
            return;
        }

        String externalReference = normalizeText(effectivePayment.externalReference());
        if (!externalReference.isBlank()) {
            try {
                UUID intentId = UUID.fromString(externalReference);
                signupIntents.findById(intentId).ifPresent(intent -> {
                    syncIntentReferences(intent, effectivePayment, normalizedCheckoutId);
                    if (intent.getCompanyId() != null) {
                        syncSubscription(intent.getCompanyId(), effectivePayment, normalizedCheckoutId);
                    }
                    if (isPaidPaymentStatus(effectivePayment.status())) {
                        activateConfirmedIntent(intent, effectivePayment, normalizedCheckoutId);
                    }
                });
                return;
            } catch (IllegalArgumentException ignored) {
                // Ignora referencias que nao sao UUID.
            }
        }

        if (!normalizeText(effectivePayment.subscription()).isBlank()) {
            subscriptions.findByProviderAndProviderSubscriptionId(BILLING_PROVIDER, effectivePayment.subscription())
                    .ifPresent(existing -> syncSubscription(existing.getCompanyId(), effectivePayment, normalizedCheckoutId));
        }
    }

    private AsaasPayment applyPendingProrationCreditIfNeeded(AsaasPayment payment) {
        if (!isPendingPayment(payment) || normalizeText(payment.subscription()).isBlank()) {
            return payment;
        }

        Optional<JpaIoAutoBillingSubscriptionEntity> subscription = subscriptions.findByProviderAndProviderSubscriptionId(
                BILLING_PROVIDER,
                payment.subscription()
        );
        if (subscription.isEmpty()) {
            return payment;
        }

        JpaIoAutoBillingSubscriptionEntity entity = subscription.get();
        long pendingCreditCents = entity.getPendingProrationCreditCents() == null
                ? 0L
                : Math.max(entity.getPendingProrationCreditCents(), 0L);
        if (pendingCreditCents <= 0L) {
            return payment;
        }

        Long paymentValueCents = toCents(payment.value());
        long resolvedPaymentValueCents = paymentValueCents == null ? 0L : paymentValueCents;
        long maxApplicableCredit = Math.max(0L, resolvedPaymentValueCents - MIN_ASAAS_PAYMENT_CENTS);
        long creditToApply = Math.min(pendingCreditCents, maxApplicableCredit);
        if (creditToApply <= 0L) {
            return payment;
        }

        try {
            AsaasPayment updatedPayment = updateAsaasPaymentValue(
                    payment,
                    resolvedPaymentValueCents - creditToApply,
                    "Assinatura " + normalizeText(entity.getPlanName(), "IOAuto")
            );
            long remainingCreditCents = pendingCreditCents - creditToApply;
            entity.setPendingProrationCreditCents(remainingCreditCents > 0L ? remainingCreditCents : null);
            entity.setPendingProrationCreditNote(remainingCreditCents > 0L
                    ? "Credito proporcional restante para cobrancas futuras."
                    : null);
            entity.setPendingProrationCreditUpdatedAt(remainingCreditCents > 0L ? Instant.now() : null);
            entity.setUpdatedAt(Instant.now());
            subscriptions.save(entity);

            log.info(
                    "Applied pending proration credit on webhook companyId={} subscriptionId={} paymentId={} appliedCents={} remainingCents={}",
                    entity.getCompanyId(),
                    entity.getProviderSubscriptionId(),
                    updatedPayment.id(),
                    creditToApply,
                    remainingCreditCents
            );
            return updatedPayment;
        } catch (BusinessException exception) {
            log.warn(
                    "Failed to apply pending proration credit on webhook subscriptionId={} paymentId={} reason={}",
                    entity.getProviderSubscriptionId(),
                    normalizeText(payment.id()),
                    normalizeText(exception.getMessage(), exception.code())
            );
            return payment;
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

        JpaCompanyEntity company = companyRepo.findById(companyId).orElse(null);
        SuperAdminPlanManagementService.PlanSnapshot currentPlan = planManagementService.resolvePlanForCompany(companyId);
        String resolvedBillingInterval = normalizeBillingRecurrence(
                company != null ? company.getBillingRecurrence() : entity.getBillingInterval()
        );
        if (resolvedBillingInterval.isBlank()) {
            resolvedBillingInterval = normalizeBillingRecurrence(currentPlan.billingRecurrence());
        }
        if (resolvedBillingInterval.isBlank()) {
            resolvedBillingInterval = normalizeBillingRecurrence(toBillingInterval(planCycle));
        }
        if (resolvedBillingInterval.isBlank()) {
            resolvedBillingInterval = "MONTHLY";
        }
        Long resolvedAmountCents = company != null ? company.getSubscriptionAmountCents() : null;
        if (resolvedAmountCents == null) {
            resolvedAmountCents = entity.getAmountCents();
        }
        if (resolvedAmountCents == null) {
            resolvedAmountCents = currentPlan.priceForRecurrence(resolvedBillingInterval);
        }
        if (resolvedAmountCents == null) {
            resolvedAmountCents = toCents(payment.value());
        }

        entity.setCompanyId(companyId);
        entity.setProvider(BILLING_PROVIDER);
        entity.setProviderCustomerId(normalizeText(payment.customer()));
        entity.setProviderSubscriptionId(providerSubscriptionId);
        entity.setProviderPriceId(currentPlan.planKey());
        entity.setPlanKey(currentPlan.planKey());
        entity.setPlanName(currentPlan.planName());
        entity.setStatus(normalizePaymentStatus(payment.status()));
        entity.setAmountCents(resolvedAmountCents);
        entity.setCurrency("brl");
        entity.setBillingInterval(resolvedBillingInterval);
        entity.setCurrentPeriodEnd(resolveCurrentPeriodEnd(payment, resolvedBillingInterval));
        entity.setCancelAtPeriodEnd(false);
        entity.setCheckoutSessionId(normalizeText(checkoutId, payment.checkoutSession()));
        entity.setUpdatedAt(Instant.now());
        subscriptions.save(entity);

        applyCompanyAccessPolicy(companyId, payment, entity);
    }

    private void applyCompanyAccessPolicy(
            UUID companyId,
            AsaasPayment payment,
            JpaIoAutoBillingSubscriptionEntity subscription
    ) {
        companyRepo.findById(companyId).ifPresent(company -> {
            Instant now = Instant.now();
            boolean blocked = shouldBlockAccess(payment);
            String resolvedBillingRecurrence = normalizeBillingRecurrence(subscription.getBillingInterval());
            if (resolvedBillingRecurrence.isBlank()) {
                resolvedBillingRecurrence = normalizeBillingRecurrence(company.getBillingRecurrence());
            }
            if (resolvedBillingRecurrence.isBlank()) {
                resolvedBillingRecurrence = "MONTHLY";
            }

            company.setContractEndDate(toContractEndDate(payment, now, resolvedBillingRecurrence));
            company.setSubscriptionStatus(toCompanySubscriptionStatus(payment.status(), blocked));
            if (subscription.getAmountCents() != null) {
                company.setSubscriptionAmountCents(subscription.getAmountCents());
            }
            company.setBillingRecurrence(resolvedBillingRecurrence);

            if (company.getSubscriptionStartedAt() == null && isPaidPaymentStatus(payment.status())) {
                company.setSubscriptionStartedAt(now);
            }

            if (isCanceledLikePaymentStatus(payment.status())) {
                company.setSubscriptionCanceledAt(now);
            } else if (isPaidPaymentStatus(payment.status())) {
                company.setSubscriptionCanceledAt(null);
            }

            if (blocked) {
                company.setStatus("INACTIVE");
                if (company.getBlockedAt() == null) {
                    company.setBlockedAt(now);
                }
            } else {
                company.setStatus("ACTIVE");
                company.setBlockedAt(null);
            }

            company.setUpdatedAt(now);
            companyRepo.save(company);
        });
    }

    private boolean shouldBlockAccess(AsaasPayment payment) {
        if (payment == null) {
            return false;
        }

        String status = normalizeText(payment.status()).toUpperCase(Locale.ROOT);
        if (isPaidPaymentStatus(status)) {
            return false;
        }

        if (isHardBlockPaymentStatus(status)) {
            return true;
        }

        return isPastDue(payment);
    }

    private boolean isHardBlockPaymentStatus(String status) {
        return switch (normalizeText(status).toUpperCase(Locale.ROOT)) {
            case "OVERDUE",
                    "REFUNDED",
                    "RECEIVED_IN_CASH_UNDONE",
                    "CHARGEBACK_REQUESTED",
                    "CHARGEBACK_DISPUTE",
                    "AWAITING_CHARGEBACK_REVERSAL",
                    "DELETED",
                    "CANCELED",
                    "CANCELLED",
                    "FAILED" -> true;
            default -> false;
        };
    }

    private boolean isCanceledLikePaymentStatus(String status) {
        String normalized = normalizeText(status).toUpperCase(Locale.ROOT);
        return "REFUNDED".equals(normalized)
                || "DELETED".equals(normalized)
                || "CANCELED".equals(normalized)
                || "CANCELLED".equals(normalized);
    }

    private boolean isPastDue(AsaasPayment payment) {
        if (payment == null || payment.dueDate() == null) {
            return false;
        }
        return payment.dueDate().isBefore(LocalDate.now(BILLING_ZONE));
    }

    private String toCompanySubscriptionStatus(String paymentStatus, boolean blocked) {
        if (blocked) {
            return "BLOCKED";
        }

        String normalized = normalizeText(paymentStatus).toUpperCase(Locale.ROOT);
        if (isPaidPaymentStatus(normalized)) {
            return "ACTIVE";
        }

        return switch (normalized) {
            case "PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST", "BANK_PROCESSING" -> "PENDING";
            default -> normalized.isBlank() ? "PENDING" : normalized;
        };
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

    private LocalDate toContractEndDate(AsaasPayment payment, Instant fallbackNow, String billingRecurrence) {
        Instant contractEnd = resolveCurrentPeriodEnd(payment, billingRecurrence);
        if (contractEnd == null) {
            contractEnd = fallbackNow.plusSeconds(30L * 24 * 60 * 60);
        }
        return contractEnd.atZone(BILLING_ZONE).toLocalDate();
    }

    private Instant resolveCurrentPeriodEnd(AsaasPayment payment, String billingRecurrence) {
        if (payment == null || payment.dueDate() == null) {
            return null;
        }

        LocalDate baseDate = payment.dueDate();
        if (isPaidPaymentStatus(payment.status())) {
            baseDate = advanceCycle(baseDate, toAsaasSubscriptionCycle(billingRecurrence));
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
            case "ANNUAL", "YEARLY" -> source.plusYears(1);
            default -> source.plusMonths(1);
        };
    }

    private String toBillingInterval(String cycle) {
        String normalized = normalizeText(cycle).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WEEK", "WEEKLY" -> "WEEKLY";
            case "BIWEEKLY" -> "BIWEEKLY";
            case "QUARTERLY" -> "QUARTERLY";
            case "SEMIANNUALLY", "SEMIANNUAL" -> "SEMIANNUALLY";
            case "YEAR", "YEARLY", "ANNUAL" -> "YEARLY";
            default -> "MONTHLY";
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
            String requestUrl = asaasApiBaseUrl + pathWithQuery;
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(requestUrl))
                    .header("accept", "application/json")
                    .header("access_token", asaasApiKey);

            if (body != null) {
                builder.header("content-type", "application/json");
            }

            HttpRequest request = switch (method) {
                case "POST" -> builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : OBJECT_MAPPER.writeValueAsString(body))).build();
                case "GET" -> builder.GET().build();
                case "PUT" -> builder.PUT(HttpRequest.BodyPublishers.ofString(body == null ? "" : OBJECT_MAPPER.writeValueAsString(body))).build();
                default -> throw new IllegalArgumentException("Metodo HTTP nao suportado: " + method);
            };

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            String rawBody = normalizeText(response.body());
            JsonNode payload;
            try {
                payload = readJson(rawBody);
            } catch (BusinessException exception) {
                log.warn(
                        "Asaas returned non-json response method={} url={} status={} bodySnippet={}",
                        method,
                        requestUrl,
                        response.statusCode(),
                        abbreviateForLogs(rawBody)
                );
                throw new BusinessException(
                        "ASAAS_INVALID_RESPONSE",
                        "O retorno do Asaas nao pode ser interpretado. HTTP " + response.statusCode() + ". Resposta: " + abbreviateForLogs(rawBody)
                );
            }
            if (response.statusCode() >= 400) {
                String errorMessage = extractAsaasError(payload, "Nao foi possivel concluir a comunicacao com o Asaas.");
                log.warn(
                        "Asaas API returned error method={} url={} status={} message={} bodySnippet={}",
                        method,
                        requestUrl,
                        response.statusCode(),
                        errorMessage,
                        abbreviateForLogs(rawBody)
                );
                throw new BusinessException("ASAAS_API_ERROR", errorMessage);
            }
            return payload;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn(
                    "Asaas communication failed method={} path={} reasonClass={} reasonMessage={}",
                    method,
                    pathWithQuery,
                    exception.getClass().getSimpleName(),
                    normalizeText(exception.getMessage(), "(sem mensagem)")
            );
            throw new BusinessException("ASAAS_API_ERROR", describeAsaasCommunicationFailure(exception));
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

    private String describeAsaasCommunicationFailure(Exception exception) {
        String detail = normalizeText(exception.getMessage());
        if (detail.isBlank()) {
            detail = exception.getClass().getSimpleName();
        }
        return "Falha de comunicacao com o Asaas: " + detail;
    }

    private String abbreviateForLogs(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return "(vazio)";
        }
        return normalized.length() <= 220 ? normalized : normalized.substring(0, 220) + "...";
    }

    private AsaasPayment toAsaasPayment(JsonNode node) {
        JsonNode creditCardNode = node.path("creditCard");
        String creditCardNumber = text(creditCardNode, "creditCardNumber");
        String creditCardBrand = text(creditCardNode, "creditCardBrand");

        return new AsaasPayment(
                text(node, "id"),
                text(node, "customer"),
                text(node, "subscription"),
                firstNonBlank(text(node, "invoiceUrl"), text(node, "bankSlipUrl")),
                text(node, "status"),
                text(node, "billingType"),
                text(node, "description"),
                text(node, "externalReference"),
                firstNonBlank(text(node, "checkoutSession"), text(node, "checkout")),
                decimal(node, "value"),
                parseLocalDate(firstNonBlank(text(node, "dueDate"), text(node, "dateCreated"))),
                parseInstant(firstNonBlank(text(node, "confirmedDate"), text(node, "clientPaymentDate"), text(node, "paymentDate"))),
                parseInstant(text(node, "dateCreated")),
                creditCardNumber,
                creditCardBrand
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

    private BillingAccessStatusSnapshot toAccessStatus(
            JpaCompanyEntity company,
            JpaIoAutoBillingSubscriptionEntity subscription,
            AsaasPayment latestPayment,
            AsaasPayment regularizationPayment
    ) {
        boolean blockedByCompanyState = !"ACTIVE".equalsIgnoreCase(normalizeText(company.getStatus(), "ACTIVE"));
        boolean blockedByPayment = shouldBlockAccess(latestPayment);
        boolean accessBlocked = blockedByCompanyState || blockedByPayment;

        String paymentStatus = latestPayment == null ? "" : normalizeText(latestPayment.status()).toUpperCase(Locale.ROOT);
        String subscriptionStatus = normalizeText(company.getSubscriptionStatus());
        if (subscriptionStatus.isBlank() && subscription != null) {
            subscriptionStatus = normalizeText(subscription.getStatus()).toUpperCase(Locale.ROOT);
        }
        if (subscriptionStatus.isBlank()) {
            subscriptionStatus = accessBlocked ? "BLOCKED" : "ACTIVE";
        }

        String blockReason = accessBlocked
                ? resolveBlockReason(latestPayment, company.getBlockedAt() != null ? company.getBlockedAt() : Instant.now())
                : "";

        String invoiceUrl = regularizationPayment != null ? normalizeText(regularizationPayment.invoiceUrl()) : "";
        String billingType = regularizationPayment != null
                ? normalizeText(regularizationPayment.billingType()).toUpperCase(Locale.ROOT)
                : "";

        return new BillingAccessStatusSnapshot(
                accessBlocked,
                normalizeText(company.getStatus(), "ACTIVE"),
                subscriptionStatus,
                blockReason,
                paymentStatus,
                billingType,
                invoiceUrl,
                company.getBlockedAt(),
                subscription != null ? subscription.getCurrentPeriodEnd() : null,
                subscription != null ? normalizeText(subscription.getProvider(), BILLING_PROVIDER) : BILLING_PROVIDER,
                subscription != null ? normalizeText(subscription.getProviderCustomerId()) : "",
                subscription != null ? normalizeText(subscription.getProviderSubscriptionId()) : ""
        );
    }

    private String resolveBlockReason(AsaasPayment payment, Instant blockedAt) {
        if (payment == null) {
            return "Assinatura pendente de regularizacao.";
        }

        String status = normalizeText(payment.status()).toUpperCase(Locale.ROOT);
        return switch (status) {
            case "OVERDUE" -> "Pagamento vencido. Regularize para liberar o acesso.";
            case "PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST", "BANK_PROCESSING" -> isPastDue(payment)
                    ? "Pagamento em aberto apos o vencimento. Regularize para liberar o acesso."
                    : "Pagamento pendente de confirmacao.";
            case "REFUNDED" -> "Pagamento estornado. E necessario regularizar a assinatura.";
            case "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL" -> "Pagamento em contestacao (chargeback). Regularize para liberar o acesso.";
            case "FAILED", "CANCELED", "CANCELLED", "DELETED" -> "Pagamento nao concluido. Regularize para liberar o acesso.";
            default -> "Assinatura bloqueada desde " + blockedAt.atZone(BILLING_ZONE).toLocalDate() + ".";
        };
    }

    private PixQrCodeSnapshot fetchPixQrCodeSnapshot(AsaasPayment payment) {
        if (payment == null || normalizeText(payment.id()).isBlank()) {
            return new PixQrCodeSnapshot(null, null, null);
        }
        if (asaasApiKey.isBlank()) {
            return new PixQrCodeSnapshot(null, null, null);
        }

        if (!"PIX".equalsIgnoreCase(normalizeText(payment.billingType()))) {
            return new PixQrCodeSnapshot(null, null, null);
        }

        try {
            JsonNode response = callAsaas("GET", "/payments/" + urlEncode(payment.id()) + "/pixQrCode", null);
            String encodedImage = normalizeText(text(response, "encodedImage"));
            String payload = normalizeText(text(response, "payload"));
            Instant expirationDate = parseInstant(text(response, "expirationDate"));
            return new PixQrCodeSnapshot(
                    encodedImage.isBlank() ? null : encodedImage,
                    payload.isBlank() ? null : payload,
                    expirationDate
            );
        } catch (Exception ignored) {
            return new PixQrCodeSnapshot(null, null, null);
        }
    }

    private String extractCreditCardLastDigits(AsaasPayment payment) {
        String raw = normalizeText(payment == null ? null : payment.creditCardNumber());
        if (raw.isBlank()) {
            return null;
        }

        String digits = raw.replaceAll("\\D", "");
        if (digits.length() < 4) {
            return null;
        }
        return digits.substring(digits.length() - 4);
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
            case "ANNUAL", "YEARLY" -> "anual";
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

    private String normalizeBillingRecurrence(String value) {
        String normalized = normalizeText(value).toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) return "";
        if ("MONTH".equals(normalized) || "MENSAL".equals(normalized)) return "MONTHLY";
        if ("QUARTERLY".equals(normalized) || "TRIMESTRAL".equals(normalized)) return "QUARTERLY";
        if ("SEMIANNUALLY".equals(normalized) || "SEMIANNUAL".equals(normalized) || "SEMESTRAL".equals(normalized)) return "SEMIANNUALLY";
        if ("YEAR".equals(normalized) || "YEARLY".equals(normalized) || "ANNUAL".equals(normalized) || "ANUAL".equals(normalized)) return "ANNUAL";
        return normalized;
    }

    private String billingIntervalLabel(String value) {
        String normalized = normalizeBillingRecurrence(value);
        return switch (normalized) {
            case "QUARTERLY" -> "Trimestral";
            case "SEMIANNUALLY" -> "Semestral";
            case "ANNUAL" -> "Anual";
            default -> "Mensal";
        };
    }

    private AsaasSubscriptionMutation syncPlanChangeWithAsaas(
            PlanChangeContext context,
            boolean updatePendingPayments
    ) {
        JpaIoAutoBillingSubscriptionEntity subscription = context.subscription();

        String provider = normalizeText(subscription.getProvider(), BILLING_PROVIDER).toUpperCase(Locale.ROOT);
        if (!BILLING_PROVIDER.equals(provider)) {
            throw new BusinessException("BILLING_PROVIDER_UNSUPPORTED", "A assinatura atual nao utiliza um provedor suportado para troca automatica.");
        }

        requireAsaasApiConfiguration();

        String providerSubscriptionId = context.providerSubscriptionId();

        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("value", centsToCurrency(context.targetAmountCents()));
        body.put("cycle", toAsaasSubscriptionCycle(context.targetBillingInterval()));
        body.put("description", context.targetPlan().planName());
        body.put("externalReference", context.company().getId().toString());
        body.put("updatePendingPayments", updatePendingPayments);

        JsonNode response;
        try {
            response = callAsaas("PUT", "/subscriptions/" + urlEncode(providerSubscriptionId), body);
        } catch (BusinessException exception) {
            if ("ASAAS_API_ERROR".equals(exception.code()) || "ASAAS_INVALID_RESPONSE".equals(exception.code())) {
                log.warn(
                        "Asaas subscription update failed companyId={} subscriptionId={} targetPlan={} targetInterval={} reason={}",
                        context.company().getId(),
                        providerSubscriptionId,
                        context.targetPlan().planKey(),
                        context.targetBillingInterval(),
                        exception.getMessage()
                );
                throw new BusinessException(
                        "ASAAS_SUBSCRIPTION_UPDATE_FAILED",
                        buildAsaasPlanChangeErrorMessage(exception.getMessage())
                );
            }
            throw exception;
        }
        String resolvedBillingRecurrence = normalizeBillingRecurrence(toBillingInterval(text(response, "cycle")));
        if (resolvedBillingRecurrence.isBlank()) {
            resolvedBillingRecurrence = normalizeBillingRecurrence(context.targetBillingInterval());
        }

        Long resolvedAmountCents = readAmountCents(response.path("value"));
        if (resolvedAmountCents == null) {
            resolvedAmountCents = context.targetAmountCents();
        }

        Instant currentPeriodEnd = resolveUpdatedCurrentPeriodEnd(response, context.subscription().getCurrentPeriodEnd());

        return new AsaasSubscriptionMutation(
                normalizeText(text(response, "id"), providerSubscriptionId),
                normalizeText(text(response, "customer"), subscription.getProviderCustomerId()),
                normalizeText(text(response, "status"), normalizeText(subscription.getStatus()).toUpperCase(Locale.ROOT)),
                resolvedAmountCents,
                resolvedBillingRecurrence,
                currentPeriodEnd
        );
    }

    private PlanChangeAdjustmentResult applyPlanChangeProration(
            PlanChangeContext context,
            PlanChangeProrationPreview proration,
            AsaasSubscriptionMutation asaasMutation
    ) {
        if (proration == null) {
            return new PlanChangeAdjustmentResult("NONE", null, null, 0L, null, null, "");
        }

        return switch (normalizeText(proration.adjustmentMode()).toUpperCase(Locale.ROOT)) {
            case "IMMEDIATE_CHARGE" -> createImmediateProrationCharge(context, proration, asaasMutation);
            case "NEXT_CYCLE_CREDIT" -> applyScheduledProrationCredit(context, proration);
            case "UPCOMING_PAYMENT_UPDATE" -> replaceUpcomingPendingPayment(context);
            default -> new PlanChangeAdjustmentResult("NONE", null, null, 0L, null, null, "Nenhum ajuste proporcional adicional foi necessario.");
        };
    }

    private PlanChangeAdjustmentResult createImmediateProrationCharge(
            PlanChangeContext context,
            PlanChangeProrationPreview proration,
            AsaasSubscriptionMutation asaasMutation
    ) {
        long chargeCents = proration.immediateChargeCents() == null ? 0L : Math.max(proration.immediateChargeCents(), 0L);
        if (chargeCents <= 0L) {
            return new PlanChangeAdjustmentResult("NONE", null, null, 0L, null, null, "Nenhum ajuste proporcional adicional foi necessario.");
        }

        String providerCustomerId = normalizeText(asaasMutation.providerCustomerId(), context.subscription().getProviderCustomerId());
        if (providerCustomerId.isBlank()) {
            throw new BusinessException("MISSING_PROVIDER_CUSTOMER", "Nao encontramos o cliente vinculado no Asaas para gerar o ajuste proporcional.");
        }

        String billingType = resolveAdjustmentBillingType(context.subscription());
        LocalDate dueDate = LocalDate.now(BILLING_ZONE);
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("customer", providerCustomerId);
        body.put("billingType", billingType);
        body.put("value", centsToCurrency(chargeCents));
        body.put("dueDate", dueDate.toString());
        body.put("description", buildProrationDescription(context));
        body.put("externalReference", buildProrationExternalReference(context.company().getId(), "charge"));

        try {
            AsaasPayment payment = toAsaasPayment(callAsaas("POST", "/payments", body));
            alignNextRecurringPendingPayment(context);
            return new PlanChangeAdjustmentResult(
                    "IMMEDIATE_CHARGE",
                    chargeCents,
                    null,
                    0L,
                    normalizeText(payment.id()),
                    normalizeText(payment.invoiceUrl()),
                    "Geramos uma cobranca proporcional de " + formatMoneyText(chargeCents) + " referente aos dias restantes do ciclo atual."
            );
        } catch (BusinessException exception) {
            throw wrapProrationAdjustmentFailure(exception);
        }
    }

    private PlanChangeAdjustmentResult applyScheduledProrationCredit(
            PlanChangeContext context,
            PlanChangeProrationPreview proration
    ) {
        long totalCreditCents = proration.creditNextCycleCents() == null ? 0L : Math.max(proration.creditNextCycleCents(), 0L);
        if (totalCreditCents <= 0L) {
            return new PlanChangeAdjustmentResult("NONE", null, null, 0L, null, null, "Nenhum ajuste proporcional adicional foi necessario.");
        }

        long appliedCreditCents = 0L;
        long remainingCreditCents = totalCreditCents;
        String paymentId = null;
        String invoiceUrl = null;

        Optional<AsaasPayment> nextPendingPayment = findNextPendingSubscriptionPayment(
                context.subscription(),
                resolveCurrentPeriodEndDate(context)
        );
        if (nextPendingPayment.isPresent()) {
            AsaasPayment payment = nextPendingPayment.get();
            long paymentValueCents = toCents(payment.value()) == null ? 0L : toCents(payment.value());
            long maxApplicableCredit = Math.max(0L, paymentValueCents - MIN_ASAAS_PAYMENT_CENTS);
            long creditToApplyNow = Math.min(remainingCreditCents, maxApplicableCredit);
            if (creditToApplyNow > 0L) {
                try {
                    AsaasPayment updatedPayment = updateAsaasPaymentValue(
                            payment,
                            paymentValueCents - creditToApplyNow,
                            buildRecurringPaymentDescription(context)
                    );
                    appliedCreditCents = creditToApplyNow;
                    remainingCreditCents -= creditToApplyNow;
                    paymentId = normalizeText(updatedPayment.id());
                    invoiceUrl = normalizeText(updatedPayment.invoiceUrl());
                } catch (BusinessException exception) {
                    throw wrapProrationAdjustmentFailure(exception);
                }
            }
        }

        String message;
        if (appliedCreditCents > 0L && remainingCreditCents > 0L) {
            message = "Aplicamos " + formatMoneyText(appliedCreditCents) + " de credito na proxima cobranca e o saldo de "
                    + formatMoneyText(remainingCreditCents) + " seguira para abatimento automatico nas cobrancas seguintes.";
        } else if (appliedCreditCents > 0L) {
            message = "Aplicamos " + formatMoneyText(appliedCreditCents) + " de credito automaticamente na proxima cobranca da assinatura.";
        } else {
            message = "Registramos um credito proporcional de " + formatMoneyText(remainingCreditCents)
                    + " para abatimento automatico nas proximas cobrancas da assinatura.";
        }

        return new PlanChangeAdjustmentResult(
                "NEXT_CYCLE_CREDIT",
                null,
                appliedCreditCents > 0L ? appliedCreditCents : null,
                remainingCreditCents,
                paymentId,
                invoiceUrl,
                message
        );
    }

    private PlanChangeAdjustmentResult replaceUpcomingPendingPayment(PlanChangeContext context) {
        Optional<AsaasPayment> pendingPayment = findCurrentPendingSubscriptionPayment(context.subscription());
        if (pendingPayment.isEmpty()) {
            return new PlanChangeAdjustmentResult(
                    "UPCOMING_PAYMENT_UPDATE",
                    null,
                    null,
                    0L,
                    null,
                    null,
                    "A assinatura foi atualizada e nao havia uma cobranca pendente do ciclo atual para substituir."
            );
        }

        try {
            AsaasPayment updatedPayment = updateAsaasPaymentValue(
                    pendingPayment.get(),
                    context.targetAmountCents(),
                    buildRecurringPaymentDescription(context)
            );
            return new PlanChangeAdjustmentResult(
                    "UPCOMING_PAYMENT_UPDATE",
                    null,
                    null,
                    0L,
                    normalizeText(updatedPayment.id()),
                    normalizeText(updatedPayment.invoiceUrl()),
                    "A cobranca pendente do ciclo atual foi substituida pelo valor integral do novo plano."
            );
        } catch (BusinessException exception) {
            throw wrapProrationAdjustmentFailure(exception);
        }
    }

    private Optional<AsaasPayment> alignNextRecurringPendingPayment(PlanChangeContext context) {
        LocalDate periodEndExclusive = resolveCurrentPeriodEndDate(context);
        Optional<AsaasPayment> nextPendingPayment = findNextPendingSubscriptionPayment(context.subscription(), periodEndExclusive);
        if (nextPendingPayment.isEmpty()) {
            return Optional.empty();
        }

        AsaasPayment payment = nextPendingPayment.get();
        Long paymentValueCents = toCents(payment.value());
        boolean sameAmount = Objects.equals(paymentValueCents, context.targetAmountCents());
        String currentDescription = normalizeText(payment.description());
        boolean sameDescription = currentDescription.isBlank()
                || currentDescription.equals(normalizeText(buildRecurringPaymentDescription(context)));
        if (sameAmount && sameDescription) {
            return Optional.of(payment);
        }

        try {
            return Optional.of(updateAsaasPaymentValue(
                    payment,
                    context.targetAmountCents(),
                    buildRecurringPaymentDescription(context)
            ));
        } catch (BusinessException exception) {
            throw wrapProrationAdjustmentFailure(exception);
        }
    }

    private Optional<AsaasPayment> findCurrentPendingSubscriptionPayment(JpaIoAutoBillingSubscriptionEntity subscription) {
        if (subscription == null || normalizeText(subscription.getProviderSubscriptionId()).isBlank() || asaasApiKey.isBlank()) {
            return Optional.empty();
        }

        return listPayments(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", "50")).stream()
                .filter(this::isPendingPayment)
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> item.dueDate() == null ? LocalDate.MAX : item.dueDate())
                        .thenComparing((AsaasPayment item) -> item.createdAt() == null ? Instant.EPOCH : item.createdAt(), Comparator.reverseOrder()))
                .findFirst();
    }

    private Optional<AsaasPayment> findNextPendingSubscriptionPayment(
            JpaIoAutoBillingSubscriptionEntity subscription,
            LocalDate minimumDueDate
    ) {
        if (subscription == null || normalizeText(subscription.getProviderSubscriptionId()).isBlank() || asaasApiKey.isBlank()) {
            return Optional.empty();
        }

        LocalDate dueDateFloor = minimumDueDate == null ? LocalDate.now(BILLING_ZONE) : minimumDueDate;
        return listPayments(Map.of("subscription", subscription.getProviderSubscriptionId(), "limit", "50")).stream()
                .filter(this::isPendingPayment)
                .filter(item -> item.dueDate() != null && !item.dueDate().isBefore(dueDateFloor))
                .sorted(Comparator
                        .comparing((AsaasPayment item) -> item.dueDate() == null ? LocalDate.MAX : item.dueDate())
                        .thenComparing((AsaasPayment item) -> item.createdAt() == null ? Instant.EPOCH : item.createdAt(), Comparator.reverseOrder()))
                .findFirst();
    }

    private boolean isPendingPayment(AsaasPayment payment) {
        if (payment == null) {
            return false;
        }
        String status = normalizeText(payment.status()).toUpperCase(Locale.ROOT);
        return "PENDING".equals(status)
                || "AWAITING_RISK_ANALYSIS".equals(status)
                || "AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST".equals(status)
                || "BANK_PROCESSING".equals(status);
    }

    private AsaasPayment updateAsaasPaymentValue(AsaasPayment payment, Long targetAmountCents, String description) {
        if (payment == null || normalizeText(payment.id()).isBlank()) {
            throw new BusinessException("INVALID_PAYMENT", "Nao foi possivel localizar a cobranca do Asaas para ajustar o pro-rata.");
        }
        if (payment.dueDate() == null) {
            throw new BusinessException("INVALID_PAYMENT", "A cobranca do Asaas nao possui vencimento valido para ajuste.");
        }

        long resolvedAmountCents = targetAmountCents == null ? 0L : Math.max(targetAmountCents, MIN_ASAAS_PAYMENT_CENTS);
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("billingType", normalizeText(payment.billingType(), "UNDEFINED"));
        body.put("value", centsToCurrency(resolvedAmountCents));
        body.put("dueDate", payment.dueDate().toString());
        if (!normalizeText(description).isBlank()) {
            body.put("description", description);
        }
        if (!normalizeText(payment.externalReference()).isBlank()) {
            body.put("externalReference", payment.externalReference());
        }

        return toAsaasPayment(callAsaas("PUT", "/payments/" + urlEncode(payment.id()), body));
    }

    private String resolveAdjustmentBillingType(JpaIoAutoBillingSubscriptionEntity subscription) {
        try {
            Optional<AsaasPayment> latestPayment = findLatestPaymentForCompany(subscription);
            if (latestPayment.isPresent()) {
                String billingType = normalizeText(latestPayment.get().billingType()).toUpperCase(Locale.ROOT);
                if (!billingType.isBlank()) {
                    return billingType;
                }
            }
        } catch (BusinessException exception) {
            log.warn(
                    "Falling back to configured billing type for proration adjustment subscriptionId={} reason={}",
                    subscription == null ? "" : normalizeText(subscription.getProviderSubscriptionId()),
                    normalizeText(exception.getMessage(), exception.code())
            );
        }

        return billingTypes.stream()
                .map(value -> normalizeText(value).toUpperCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .findFirst()
                .orElse("UNDEFINED");
    }

    private String buildProrationDescription(PlanChangeContext context) {
        return "Ajuste proporcional da troca para " + context.targetPlan().planName();
    }

    private String buildRecurringPaymentDescription(PlanChangeContext context) {
        return "Assinatura " + context.targetPlan().planName();
    }

    private String buildProrationExternalReference(UUID companyId, String suffix) {
        return companyId + ":plan-change:" + suffix + ":" + Instant.now().toEpochMilli();
    }

    private BusinessException wrapProrationAdjustmentFailure(BusinessException exception) {
        if ("ASAAS_API_ERROR".equals(exception.code()) || "ASAAS_INVALID_RESPONSE".equals(exception.code())) {
            return new BusinessException(
                    "ASAAS_PRORATION_ADJUSTMENT_FAILED",
                    "Nao foi possivel aplicar o ajuste proporcional da troca de plano no Asaas. Nenhuma alteracao local foi gravada. Detalhe do Asaas: "
                            + normalizeText(exception.getMessage(), "erro nao informado")
            );
        }
        return exception;
    }

    private void rollbackSubscriptionPlanChange(PlanChangeContext context) {
        try {
            ObjectNode body = OBJECT_MAPPER.createObjectNode();
            body.put("value", centsToCurrency(context.currentAmountCents()));
            body.put("cycle", toAsaasSubscriptionCycle(context.currentBillingInterval()));
            body.put("description", context.currentPlan().planName());
            body.put("externalReference", context.company().getId().toString());
            body.put("updatePendingPayments", false);
            callAsaas("PUT", "/subscriptions/" + urlEncode(context.providerSubscriptionId()), body);
            log.warn(
                    "Rolled back Asaas subscription change after proration failure companyId={} subscriptionId={}",
                    context.company().getId(),
                    context.providerSubscriptionId()
            );
        } catch (Exception exception) {
            log.error(
                    "Failed to rollback Asaas subscription change companyId={} subscriptionId={} reason={}",
                    context.company().getId(),
                    context.providerSubscriptionId(),
                    normalizeText(exception.getMessage(), exception.getClass().getSimpleName())
            );
        }
    }

    private void applyPendingProrationCreditState(
            JpaIoAutoBillingSubscriptionEntity subscription,
            PlanChangeAdjustmentResult adjustment,
            Instant now
    ) {
        long remainingCredit = adjustment == null || adjustment.remainingCreditCents() == null
                ? 0L
                : Math.max(adjustment.remainingCreditCents(), 0L);
        if (remainingCredit > 0L) {
            subscription.setPendingProrationCreditCents(remainingCredit);
            subscription.setPendingProrationCreditNote(normalizeText(adjustment.message()));
            subscription.setPendingProrationCreditUpdatedAt(now);
            return;
        }

        subscription.setPendingProrationCreditCents(null);
        subscription.setPendingProrationCreditNote(null);
        subscription.setPendingProrationCreditUpdatedAt(null);
    }

    private void syncOnboardingSubscriptionPlan(
            UUID companyId,
            String planName,
            Long amountCents,
            String billingRecurrence,
            Instant now
    ) {
        onboardingSubscriptions.findByCompanyId(companyId).ifPresent(subscription -> {
            subscription.setDescription(normalizeText(planName, subscription.getDescription()));
            subscription.setValor(centsToCurrency(amountCents));
            subscription.setRecorrencia(toPortugueseRecurrence(billingRecurrence));
            subscription.setUpdatedAt(now);
            onboardingSubscriptions.save(subscription);
        });
    }

    private void requireAsaasApiConfiguration() {
        if (asaasApiKey.isBlank()) {
            throw new BusinessException("BILLING_NOT_CONFIGURED", "Configure ASAAS_API_KEY ou ASAAS_ACCESS_TOKEN antes de atualizar a assinatura.");
        }
    }

    private String buildAsaasPlanChangeErrorMessage(String detail) {
        String normalizedDetail = normalizeText(detail);
        if (normalizedDetail.isBlank() || "Nao foi possivel concluir a comunicacao com o Asaas.".equals(normalizedDetail)) {
            return "Nao foi possivel alterar sua assinatura no momento. Nenhuma cobranca foi alterada.";
        }
        return "Nao foi possivel alterar sua assinatura no momento. Nenhuma cobranca foi alterada. Detalhe do Asaas: " + normalizedDetail;
    }

    private String normalizeAsaasApiBaseUrl(String rawBaseUrl) {
        String normalized = trimTrailingSlash(normalizeText(rawBaseUrl, "https://api.asaas.com/v3"));
        if (normalized.endsWith("/v3")) {
            return normalized;
        }
        return normalized + "/v3";
    }

    private String toAsaasSubscriptionCycle(String billingRecurrence) {
        String normalized = normalizeBillingRecurrence(billingRecurrence);
        if ("ANNUAL".equals(normalized)) return "YEARLY";
        return normalizeText(normalized, "MONTHLY");
    }

    private BigDecimal centsToCurrency(Long amountCents) {
        long safeAmount = amountCents == null ? 0L : Math.max(amountCents, 0L);
        return BigDecimal.valueOf(safeAmount, 2).setScale(2, RoundingMode.HALF_UP);
    }

    private Long readAmountCents(JsonNode valueNode) {
        if (valueNode == null || valueNode.isMissingNode() || valueNode.isNull()) {
            return null;
        }
        try {
            if (valueNode.isNumber()) {
                return toCents(valueNode.decimalValue());
            }
            String normalized = normalizeText(valueNode.asText());
            return normalized.isBlank() ? null : toCents(new BigDecimal(normalized));
        } catch (Exception exception) {
            return null;
        }
    }

    private LocalDate readLocalDate(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (Exception exception) {
            return null;
        }
    }

    private Instant resolveUpdatedCurrentPeriodEnd(JsonNode response, Instant fallbackCurrentPeriodEnd) {
        Instant fromNextDueDate = toPeriodBoundary(readLocalDate(text(response, "nextDueDate")));
        if (fromNextDueDate != null) {
            return fromNextDueDate;
        }
        return fallbackCurrentPeriodEnd;
    }

    private Instant toPeriodBoundary(LocalDate dueDate) {
        if (dueDate == null) {
            return null;
        }
        return dueDate.plusDays(1).atStartOfDay(BILLING_ZONE).toInstant();
    }

    private List<String> buildEnabledModules(SuperAdminPlanManagementService.PlanFeatures features) {
        List<String> modules = new ArrayList<>();
        if (features.catalogBioLink() || features.storefrontPage()) modules.add("Site proprio e catalogo publico");
        if (features.whatsappSharing()) modules.add("Compartilhamento no WhatsApp");
        if (features.webmotors()) modules.add("Integracao Webmotors");
        if (features.olx()) modules.add("Integracao OLX");
        if (features.icarros()) modules.add("Integracao iCarros");
        if (features.crmKanban()) modules.add("CRM Kanban");
        if (features.leadManagement()) modules.add("Gestao de leads");
        if (features.finance()) modules.add("Financeiro");
        if (features.reports()) modules.add("Relatorios");
        if (features.trackableLinks()) modules.add("Links rastreaveis");
        if (features.multiunits()) modules.add("Multiunidades");
        if (features.advancedMultiuser()) modules.add("Multiusuario avancado");
        if (features.executiveDashboard()) modules.add("Dashboard executivo");
        if (features.integrationsApi()) modules.add("API de integracoes");
        if (features.assistedOnboarding()) modules.add("Implantacao assistida");
        if (features.prioritySupport()) modules.add("Suporte prioritario");
        if (features.customizations()) modules.add("Personalizacoes");
        return modules;
    }
}

record AsaasSubscriptionMutation(
        String providerSubscriptionId,
        String providerCustomerId,
        String status,
        Long amountCents,
        String billingInterval,
        Instant currentPeriodEnd
) {
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

record PlanChangePreviewResponse(
        PlanChangePlanSummary currentPlan,
        PlanChangePlanSummary targetPlan,
        String changeType,
        String asaasCycle,
        boolean willUpdatePendingPayments,
        boolean requiresConfirmation,
        String message,
        PlanChangeProrationPreview proration
) {
}

record PlanChangePlanSummary(
        String key,
        String name,
        Long amountCents,
        String billingInterval
) {
}

record PlanChangeConfirmResponse(
        boolean success,
        String message,
        PlanChangeSubscriptionSnapshot subscription,
        PlanChangeAdjustmentResult adjustment
) {
}

record PlanChangeSubscriptionSnapshot(
        String planKey,
        String planName,
        Long amountCents,
        String billingInterval,
        String status
) {
}

record PlanChangeProrationPreview(
        String periodStartDate,
        String periodEndDate,
        long totalCycleDays,
        long remainingDays,
        long elapsedDays,
        Long currentPlanRemainingCents,
        Long targetPlanRemainingCents,
        Long deltaCents,
        String adjustmentMode,
        Long immediateChargeCents,
        Long creditNextCycleCents,
        boolean prorationActive,
        String message
) {
}

record PlanChangeAdjustmentResult(
        String mode,
        Long immediateChargeCents,
        Long appliedCreditCents,
        Long remainingCreditCents,
        String paymentId,
        String invoiceUrl,
        String message
) {
}

record BillingSnapshot(
        boolean hasSubscription,
        UUID planId,
        String planKey,
        String planName,
        String status,
        Long amountCents,
        String currency,
        String billingInterval,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        String provider,
        String providerCustomerId,
        String providerSubscriptionId,
        Long pendingProrationCreditCents,
        String pendingProrationCreditNote,
        Instant pendingProrationCreditUpdatedAt,
        BillingPlanChangeNotice planChangeNotice,
        Integer usersLimit,
        Integer vehiclesLimit,
        Integer activeAdsLimit,
        SuperAdminPlanManagementService.PlanFeatures features,
        List<String> enabledModules,
        SuperAdminPlanManagementService.TenantPlanUsage usage,
        List<BillingPlanOption> availablePlans,
        BillingInvoiceSummary nextInvoice,
        List<BillingInvoiceSummary> paidInvoices
) {
}

record BillingInvoiceSummary(
        String paymentId,
        String title,
        Long amountCents,
        String currency,
        LocalDate dueDate,
        Instant paidAt,
        String invoiceUrl,
        String status
) {
}

record BillingPlanChangeNotice(
        boolean active,
        String title,
        String message,
        String currentPlanName,
        String targetPlanName,
        String targetBillingInterval,
        String changeType,
        List<String> unlockedFeatures,
        String prorationAdjustmentMode,
        Long immediateChargeCents,
        Long creditNextCycleCents,
        Long remainingCreditCents,
        String invoiceUrl,
        String paymentId,
        boolean requiresAction,
        Instant createdAt
) {
}

record StoredPlanChangeNotice(
        String title,
        String message,
        String currentPlanName,
        String targetPlanName,
        String targetBillingInterval,
        String changeType,
        List<String> unlockedFeatures,
        String prorationAdjustmentMode,
        Long immediateChargeCents,
        Long creditNextCycleCents,
        Long remainingCreditCents,
        String invoiceUrl,
        String paymentId,
        boolean requiresAction,
        Instant createdAt
) {
}

record BillingPlanOption(
        UUID planId,
        String planKey,
        String planName,
        String billingRecurrence,
        Long priceCents,
        Long monthlyPriceCents,
        Long annualPriceCents,
        Map<String, Long> priceByInterval,
        List<String> supportedBillingIntervals,
        Integer usersLimit,
        Integer vehiclesLimit,
        Integer activeAdsLimit,
        SuperAdminPlanManagementService.PlanFeatures features,
        boolean current,
        boolean eligible,
        List<String> blockingReasons
) {
}

record BillingAccessStatusSnapshot(
        boolean accessBlocked,
        String companyStatus,
        String subscriptionStatus,
        String blockReason,
        String paymentStatus,
        String billingType,
        String regularizationUrl,
        Instant blockedAt,
        Instant currentPeriodEnd,
        String provider,
        String providerCustomerId,
        String providerSubscriptionId
) {
}

record BillingRegularizationOptions(
        boolean available,
        boolean pix,
        boolean creditCard,
        String message,
        String regularizationUrl,
        String pixCopyPasteCode,
        String pixEncodedImage,
        Instant pixExpirationDate,
        String cardSummary,
        boolean canConfirmSavedCard,
        boolean canUpdateCard,
        boolean canGenerateNewCharge
) {
}

record PortalLaunch(String portalUrl) {
}

record PixQrCodeSnapshot(
        String encodedImage,
        String copyPasteCode,
        Instant expirationDate
) {
}

enum BillingChangeType {
    UPGRADE,
    DOWNGRADE,
    CYCLE_CHANGE,
    PLAN_CHANGE
}

record PlanChangeContext(
        JpaCompanyEntity company,
        JpaIoAutoBillingSubscriptionEntity subscription,
        SuperAdminPlanManagementService.PlanSnapshot currentPlan,
        SuperAdminPlanManagementService.PlanSnapshot targetPlan,
        String currentBillingInterval,
        String targetBillingInterval,
        Long currentAmountCents,
        Long targetAmountCents,
        String providerSubscriptionId,
        BillingChangeType changeType
) {
}

record BillingPeriodWindow(
        LocalDate periodStartInclusive,
        LocalDate periodEndExclusive
) {
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
        String description,
        String externalReference,
        String checkoutSession,
        BigDecimal value,
        LocalDate dueDate,
        Instant confirmedAt,
        Instant createdAt,
        String creditCardNumber,
        String creditCardBrand
) {
}
