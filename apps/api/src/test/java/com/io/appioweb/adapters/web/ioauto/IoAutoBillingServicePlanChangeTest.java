package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoBillingSubscriptionRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoSignupIntentRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoBillingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.onboarding.JpaOnboardingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.onboarding.OnboardingSubscriptionRepositoryJpa;
import com.io.appioweb.application.onboarding.FirstUserOnboardingService;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.shared.errors.BusinessException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IoAutoBillingServicePlanChangeTest {

    private static final ZoneId BILLING_ZONE = ZoneId.of("America/Sao_Paulo");

    @Test
    void previewUpgradeMonthlyShowsImmediateProrationCharge() {
        TestContext ctx = newTestContext();

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");

        assertThat(response.currentPlan().key()).isEqualTo("basic");
        assertThat(response.targetPlan().key()).isEqualTo("pro");
        assertThat(response.targetPlan().amountCents()).isEqualTo(14990L);
        assertThat(response.changeType()).isEqualTo("UPGRADE");
        assertThat(response.asaasCycle()).isEqualTo("MONTHLY");
        assertThat(response.willUpdatePendingPayments()).isFalse();
        assertThat(response.proration().prorationActive()).isTrue();
        assertThat(response.proration().adjustmentMode()).isEqualTo("IMMEDIATE_CHARGE");
        assertThat(response.proration().immediateChargeCents()).isNotNull().isPositive();
    }

    @Test
    void previewMonthlyToAnnualUsesYearlyAsaasCycleAndShowsCreditProration() {
        TestContext ctx = newTestContext();

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "basic", "ANNUAL");

        assertThat(response.currentPlan().billingInterval()).isEqualTo("MONTHLY");
        assertThat(response.targetPlan().billingInterval()).isEqualTo("ANNUAL");
        assertThat(response.targetPlan().amountCents()).isEqualTo(99900L);
        assertThat(response.changeType()).isEqualTo("CYCLE_CHANGE");
        assertThat(response.asaasCycle()).isEqualTo("YEARLY");
        assertThat(response.proration().adjustmentMode()).isEqualTo("NEXT_CYCLE_CREDIT");
        assertThat(response.proration().creditNextCycleCents()).isNotNull().isPositive();
    }

    @Test
    void previewRealignsWindowWhenStoredCurrentPeriodEndIsOneCycleAhead() {
        TestContext ctx = newTestContext();
        LocalDate today = LocalDate.now(BILLING_ZONE);
        ctx.company.setSubscriptionStartedAt(today.minusDays(40).atStartOfDay(BILLING_ZONE).toInstant());
        ctx.subscription.setCurrentPeriodEnd(today.plusMonths(2).plusDays(5).atStartOfDay(BILLING_ZONE).toInstant());

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");

        LocalDate periodStart = LocalDate.parse(response.proration().periodStartDate());
        LocalDate periodEndInclusive = LocalDate.parse(response.proration().periodEndDate());
        assertThat(response.proration().adjustmentMode()).isNotEqualTo("UPCOMING_PAYMENT_UPDATE");
        assertThat(periodStart).isBeforeOrEqualTo(today);
        assertThat(periodEndInclusive).isAfterOrEqualTo(today);
        assertThat(response.proration().remainingDays()).isLessThan(response.proration().totalCycleDays());
        assertThat(response.proration().currentPlanRemainingCents()).isNotNull().isLessThan(ctx.subscription.getAmountCents());
        assertThat(response.proration().targetPlanRemainingCents()).isNotNull().isLessThan(response.targetPlan().amountCents());
    }

    @Test
    void confirmPlanChangeSuccessCreatesImmediateProrationChargeAndUpdatesLocalSnapshot() throws Exception {
        AtomicReference<String> subscriptionBody = new AtomicReference<>("");
        AtomicReference<String> paymentBody = new AtomicReference<>("");
        LocalDate today = LocalDate.now(BILLING_ZONE);
        HttpServer server = startServer(exchange -> {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if ("/v3/subscriptions/sub_123".equals(path) && "PUT".equals(method)) {
                subscriptionBody.set(readBody(exchange));
                writeJson(exchange, 200, """
                        {
                          "id": "sub_123",
                          "customer": "cus_123",
                          "status": "ACTIVE",
                          "value": 149.90,
                          "cycle": "MONTHLY",
                          "nextDueDate": "%s"
                        }
                        """.formatted(today.plusDays(18)));
                return;
            }
            if ("/v3/payments".equals(path) && "POST".equals(method)) {
                paymentBody.set(readBody(exchange));
                writeJson(exchange, 200, """
                        {
                          "id": "pay_adjustment",
                          "customer": "cus_123",
                          "status": "PENDING",
                          "billingType": "CREDIT_CARD",
                          "invoiceUrl": "https://asaas.test/invoice/pay_adjustment",
                          "value": 27.42,
                          "dueDate": "%s"
                        }
                        """.formatted(today));
                return;
            }
            if ("/v3/payments".equals(path) && "GET".equals(method)) {
                writeJson(exchange, 200, """
                        { "data": [] }
                        """);
                return;
            }
            writeJson(exchange, 404, """
                    { "errors": [ { "description": "not-found" } ] }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);
            PlanChangePreviewResponse preview = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");

            PlanChangeConfirmResponse response = ctx.service.confirmPlanChange(ctx.companyId, "pro", "MONTHLY", true);
            BillingSnapshot snapshot = ctx.service.getBillingSnapshot(ctx.companyId);

            assertThat(response.success()).isTrue();
            assertThat(response.subscription().planKey()).isEqualTo("pro");
            assertThat(response.adjustment()).isNotNull();
            assertThat(response.adjustment().mode()).isEqualTo("IMMEDIATE_CHARGE");
            assertThat(response.adjustment().immediateChargeCents()).isEqualTo(preview.proration().immediateChargeCents());
            assertThat(response.adjustment().invoiceUrl()).isEqualTo("https://asaas.test/invoice/pay_adjustment");
            assertThat(ctx.company.getPlanId()).isEqualTo(ctx.targetPlan.planId());
            assertThat(ctx.company.getSubscriptionAmountCents()).isEqualTo(14990L);
            assertThat(ctx.subscription.getPlanKey()).isEqualTo("pro");
            assertThat(ctx.subscription.getBillingInterval()).isEqualTo("MONTHLY");
            assertThat(ctx.subscription.getPendingProrationCreditCents()).isNull();
            assertThat(snapshot.planKey()).isEqualTo("pro");
            assertThat(snapshot.amountCents()).isEqualTo(14990L);
            assertThat(subscriptionBody.get()).contains("\"updatePendingPayments\":false");
            assertThat(subscriptionBody.get()).contains("\"cycle\":\"MONTHLY\"");
            assertThat(subscriptionBody.get()).contains("\"value\":149.90");
            assertThat(paymentBody.get()).contains("\"customer\":\"cus_123\"");
            assertThat(paymentBody.get()).contains("\"billingType\":\"CREDIT_CARD\"");
            assertThat(paymentBody.get()).contains("\"value\":%s".formatted(toDecimal(preview.proration().immediateChargeCents())));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void confirmPlanChangeFailureFromAsaasDoesNotPersistLocalChanges() throws Exception {
        HttpServer server = startServer(exchange -> {
            if ("/v3/subscriptions/sub_123".equals(exchange.getRequestURI().getPath())) {
                writeJson(exchange, 500, """
                        { "errors": [ { "description": "gateway-failed" } ] }
                        """);
                return;
            }
            writeJson(exchange, 404, """
                    { "errors": [ { "description": "not-found" } ] }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);

            assertThatThrownBy(() -> ctx.service.confirmPlanChange(ctx.companyId, "pro", "MONTHLY", true))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(error -> {
                        BusinessException businessException = (BusinessException) error;
                        assertThat(businessException.code()).isEqualTo("ASAAS_SUBSCRIPTION_UPDATE_FAILED");
                        assertThat(businessException.getMessage()).contains("gateway-failed");
                    });

            assertThat(ctx.company.getPlanId()).isEqualTo(ctx.currentPlan.planId());
            assertThat(ctx.subscription.getPlanKey()).isEqualTo("basic");
            verify(ctx.companyRepo, never()).save(any(JpaCompanyEntity.class));
            verify(ctx.subscriptionRepo, never()).save(any(JpaIoAutoBillingSubscriptionEntity.class));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void confirmDowngradeCarriesRemainingCreditForwardWhenCreditExceedsNextPendingPayment() throws Exception {
        LocalDate today = LocalDate.now(BILLING_ZONE);
        AtomicReference<String> updatedPendingPaymentBody = new AtomicReference<>("");
        HttpServer server = startServer(exchange -> {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if ("/v3/subscriptions/sub_123".equals(path) && "PUT".equals(method)) {
                writeJson(exchange, 200, """
                        {
                          "id": "sub_123",
                          "customer": "cus_123",
                          "status": "ACTIVE",
                          "value": 99.90,
                          "cycle": "MONTHLY",
                          "nextDueDate": "%s"
                        }
                        """.formatted(today.plusDays(18)));
                return;
            }
            if ("/v3/payments".equals(path) && "GET".equals(method)) {
                writeJson(exchange, 200, """
                        {
                          "data": [
                            {
                              "id": "pay_next",
                              "customer": "cus_123",
                              "subscription": "sub_123",
                              "status": "PENDING",
                              "billingType": "BOLETO",
                              "value": 99.90,
                              "dueDate": "%s",
                              "invoiceUrl": "https://asaas.test/invoice/pay_next"
                            }
                          ]
                        }
                        """.formatted(today.plusMonths(9)));
                return;
            }
            if ("/v3/payments/pay_next".equals(path) && "PUT".equals(method)) {
                updatedPendingPaymentBody.set(readBody(exchange));
                writeJson(exchange, 200, """
                        {
                          "id": "pay_next",
                          "customer": "cus_123",
                          "subscription": "sub_123",
                          "status": "PENDING",
                          "billingType": "BOLETO",
                          "value": 0.01,
                          "dueDate": "%s",
                          "invoiceUrl": "https://asaas.test/invoice/pay_next"
                        }
                        """.formatted(today.plusMonths(9)));
                return;
            }
            writeJson(exchange, 404, """
                    { "errors": [ { "description": "not-found" } ] }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);
            ctx.company.setPlanId(ctx.targetPlan.planId());
            ctx.company.setBillingRecurrence("ANNUAL");
            ctx.company.setSubscriptionAmountCents(149900L);
            ctx.subscription.setPlanKey("pro");
            ctx.subscription.setPlanName("Plano Pro");
            ctx.subscription.setBillingInterval("ANNUAL");
            ctx.subscription.setAmountCents(149900L);
            ctx.subscription.setCurrentPeriodEnd(today.plusMonths(8).plusDays(1).atStartOfDay(BILLING_ZONE).toInstant());

            PlanChangePreviewResponse preview = ctx.service.previewPlanChange(ctx.companyId, "basic", "MONTHLY");
            PlanChangeConfirmResponse response = ctx.service.confirmPlanChange(ctx.companyId, "basic", "MONTHLY", false);

            assertThat(preview.proration().adjustmentMode()).isEqualTo("NEXT_CYCLE_CREDIT");
            assertThat(preview.proration().creditNextCycleCents()).isNotNull().isPositive();
            assertThat(response.success()).isTrue();
            assertThat(response.adjustment()).isNotNull();
            assertThat(response.adjustment().mode()).isEqualTo("NEXT_CYCLE_CREDIT");
            assertThat(response.adjustment().appliedCreditCents()).isEqualTo(9989L);
            assertThat(response.adjustment().remainingCreditCents()).isNotNull().isPositive();
            assertThat(ctx.company.getPlanId()).isEqualTo(ctx.currentPlan.planId());
            assertThat(ctx.subscription.getPlanKey()).isEqualTo("basic");
            assertThat(ctx.subscription.getPendingProrationCreditCents()).isEqualTo(response.adjustment().remainingCreditCents());
            assertThat(updatedPendingPaymentBody.get()).contains("\"value\":0.01");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void previewRejectsInvalidPlan() {
        TestContext ctx = newTestContext();

        assertThatThrownBy(() -> ctx.service.previewPlanChange(ctx.companyId, "missing", "MONTHLY"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("INVALID_PLAN"));
    }

    @Test
    void previewRejectsInvalidBillingInterval() {
        TestContext ctx = newTestContext();

        assertThatThrownBy(() -> ctx.service.previewPlanChange(ctx.companyId, "pro", "QUARTERLY"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("INVALID_BILLING_INTERVAL"));
    }

    @Test
    void assertPlanChangeAllowedRejectsNonAdminRoles() {
        TestContext ctx = newTestContext();

        assertThatThrownBy(() -> ctx.service.assertPlanChangeAllowed(java.util.Set.of("MANAGER")))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("BILLING_PLAN_CHANGE_FORBIDDEN"));
    }

    @Test
    void previewRejectsMissingProviderSubscription() {
        TestContext ctx = newTestContext();
        ctx.subscription.setProviderSubscriptionId("");

        assertThatThrownBy(() -> ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("MISSING_PROVIDER_SUBSCRIPTION"));
    }

    @Test
    void previewRejectsDowngradeWhenUsageExceedsPlan() {
        TestContext ctx = newTestContext();
        ctx.company.setPlanId(ctx.targetPlan.planId());
        ctx.company.setSubscriptionAmountCents(14990L);
        ctx.subscription.setPlanKey("pro");
        ctx.subscription.setPlanName("Plano Pro");
        ctx.subscription.setAmountCents(14990L);
        when(ctx.planManagementService.evaluateTenantPlanCompatibility(ctx.companyId, ctx.currentPlan))
                .thenReturn(new SuperAdminPlanManagementService.PlanCompatibility(
                        false,
                        List.of("Sua empresa utiliza recursos acima do limite do plano selecionado."),
                        ctx.usage
                ));

        assertThatThrownBy(() -> ctx.service.previewPlanChange(ctx.companyId, "basic", "MONTHLY"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("PLAN_LIMIT_EXCEEDED"));
    }

    @Test
    void previewUsesOnboardingMirrorWhenLocalBillingSubscriptionIsMissing() {
        TestContext ctx = newTestContext();
        JpaOnboardingSubscriptionEntity onboardingSubscription = new JpaOnboardingSubscriptionEntity();
        onboardingSubscription.setId(UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd"));
        onboardingSubscription.setCompanyId(ctx.companyId);
        onboardingSubscription.setAsaasSubscriptionId("sub_123");
        onboardingSubscription.setValor(new BigDecimal("99.90"));
        onboardingSubscription.setRecorrencia("mensal");
        onboardingSubscription.setStatus("ACTIVE");
        onboardingSubscription.setCreatedAt(Instant.parse("2026-05-01T03:00:00Z"));
        onboardingSubscription.setUpdatedAt(Instant.parse("2026-05-15T10:00:00Z"));

        when(ctx.subscriptionRepo.findTopByCompanyIdOrderByUpdatedAtDesc(ctx.companyId)).thenReturn(Optional.empty());
        when(ctx.onboardingRepo.findByCompanyId(ctx.companyId)).thenReturn(Optional.of(onboardingSubscription));

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");

        assertThat(response.currentPlan().key()).isEqualTo("basic");
        assertThat(response.targetPlan().key()).isEqualTo("pro");
        assertThat(response.targetPlan().amountCents()).isEqualTo(14990L);
    }

    @Test
    void registerSuperAdminPlanChangeNoticeStoresAdjustmentPaymentId() {
        TestContext ctx = newTestContext();
        PlanChangePreviewResponse preview = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");
        PlanChangeConfirmResponse confirm = new PlanChangeConfirmResponse(
                true,
                "ok",
                new PlanChangeSubscriptionSnapshot("pro", "Plano Pro", 14990L, "MONTHLY", "ACTIVE"),
                new PlanChangeAdjustmentResult(
                        "IMMEDIATE_CHARGE",
                        3200L,
                        null,
                        0L,
                        "pay_notice_123",
                        "https://asaas.test/invoice/pay_notice_123",
                        "Mensagem"
                )
        );

        ctx.service.registerSuperAdminPlanChangeNotice(ctx.companyId, preview, confirm);

        assertThat(ctx.company.getPendingPlanChangeNoticeJson()).contains("\"paymentId\":\"pay_notice_123\"");
    }

    @Test
    void dismissPlanChangeNoticeRejectsWhenImmediateChargeIsStillPending() throws Exception {
        HttpServer server = startServer(exchange -> {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if ("/v3/payments/pay_pending_notice".equals(path) && "GET".equals(method)) {
                writeJson(exchange, 200, """
                        {
                          "id": "pay_pending_notice",
                          "status": "PENDING",
                          "invoiceUrl": "https://asaas.test/invoice/pay_pending_notice",
                          "value": 31.90,
                          "billingType": "CREDIT_CARD",
                          "dueDate": "2026-05-30"
                        }
                        """);
                return;
            }
            writeJson(exchange, 404, """
                    { "errors": [ { "description": "not-found" } ] }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);
            ctx.company.setPendingPlanChangeNoticeJson("""
                    {
                      "title": "Aviso",
                      "message": "Mensagem",
                      "currentPlanName": "Plano Basico",
                      "targetPlanName": "Plano Pro",
                      "targetBillingInterval": "MONTHLY",
                      "changeType": "UPGRADE",
                      "unlockedFeatures": [],
                      "prorationAdjustmentMode": "IMMEDIATE_CHARGE",
                      "immediateChargeCents": 3190,
                      "creditNextCycleCents": null,
                      "remainingCreditCents": 0,
                      "invoiceUrl": "https://asaas.test/invoice/pay_pending_notice",
                      "paymentId": "pay_pending_notice",
                      "requiresAction": true,
                      "createdAt": "2026-05-22T12:00:00Z"
                    }
                    """);

            assertThatThrownBy(() -> ctx.service.dismissPlanChangeNotice(ctx.companyId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("PLAN_CHANGE_NOTICE_PAYMENT_PENDING"));

            assertThat(ctx.company.getPendingPlanChangeNoticeJson()).isNotBlank();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void dismissPlanChangeNoticeClearsNoticeWhenImmediateChargeIsPaid() throws Exception {
        HttpServer server = startServer(exchange -> {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if ("/v3/payments/pay_paid_notice".equals(path) && "GET".equals(method)) {
                writeJson(exchange, 200, """
                        {
                          "id": "pay_paid_notice",
                          "status": "RECEIVED",
                          "invoiceUrl": "https://asaas.test/invoice/pay_paid_notice",
                          "value": 31.90,
                          "billingType": "CREDIT_CARD",
                          "dueDate": "2026-05-30"
                        }
                        """);
                return;
            }
            writeJson(exchange, 404, """
                    { "errors": [ { "description": "not-found" } ] }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);
            ctx.company.setPendingPlanChangeNoticeJson("""
                    {
                      "title": "Aviso",
                      "message": "Mensagem",
                      "currentPlanName": "Plano Basico",
                      "targetPlanName": "Plano Pro",
                      "targetBillingInterval": "MONTHLY",
                      "changeType": "UPGRADE",
                      "unlockedFeatures": [],
                      "prorationAdjustmentMode": "IMMEDIATE_CHARGE",
                      "immediateChargeCents": 3190,
                      "creditNextCycleCents": null,
                      "remainingCreditCents": 0,
                      "invoiceUrl": "https://asaas.test/invoice/pay_paid_notice",
                      "paymentId": "pay_paid_notice",
                      "requiresAction": true,
                      "createdAt": "2026-05-22T12:00:00Z"
                    }
                    """);
            ctx.company.setPendingPlanChangeNoticeCreatedAt(Instant.parse("2026-05-22T12:00:00Z"));

            ctx.service.dismissPlanChangeNotice(ctx.companyId);

            assertThat(ctx.company.getPendingPlanChangeNoticeJson()).isNull();
            assertThat(ctx.company.getPendingPlanChangeNoticeCreatedAt()).isNull();
        } finally {
            server.stop(0);
        }
    }

    private static TestContext newTestContext() {
        return newTestContext(null);
    }

    private static TestContext newTestContext(HttpServer server) {
        IoAutoSignupIntentRepositoryJpa signupRepo = mock(IoAutoSignupIntentRepositoryJpa.class);
        IoAutoBillingSubscriptionRepositoryJpa subscriptionRepo = mock(IoAutoBillingSubscriptionRepositoryJpa.class);
        IoAutoIntegrationRepositoryJpa integrationRepo = mock(IoAutoIntegrationRepositoryJpa.class);
        OnboardingSubscriptionRepositoryJpa onboardingRepo = mock(OnboardingSubscriptionRepositoryJpa.class);
        CompanyRepositoryJpa companyRepo = mock(CompanyRepositoryJpa.class);
        UserRepositoryJpa userRepo = mock(UserRepositoryJpa.class);
        FirstUserOnboardingService onboardingService = mock(FirstUserOnboardingService.class);
        SuperAdminPlanManagementService planManagementService = mock(SuperAdminPlanManagementService.class);

        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID currentPlanId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        UUID targetPlanId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        LocalDate today = LocalDate.now(BILLING_ZONE);

        JpaCompanyEntity company = new JpaCompanyEntity();
        company.setId(companyId);
        company.setName("Loja Teste");
        company.setStatus("ACTIVE");
        company.setSubscriptionStatus("ACTIVE");
        company.setPlanId(currentPlanId);
        company.setBillingRecurrence("MONTHLY");
        company.setSubscriptionAmountCents(9990L);
        company.setUpdatedAt(Instant.now());

        JpaIoAutoBillingSubscriptionEntity subscription = new JpaIoAutoBillingSubscriptionEntity();
        subscription.setId(UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"));
        subscription.setCompanyId(companyId);
        subscription.setProvider("ASAAS");
        subscription.setProviderCustomerId("cus_123");
        subscription.setProviderSubscriptionId("sub_123");
        subscription.setPlanKey("basic");
        subscription.setPlanName("Plano Basico");
        subscription.setStatus("ACTIVE");
        subscription.setAmountCents(9990L);
        subscription.setCurrency("brl");
        subscription.setBillingInterval("MONTHLY");
        subscription.setCurrentPeriodEnd(today.plusDays(18).atStartOfDay(BILLING_ZONE).toInstant());
        subscription.setCreatedAt(Instant.now().minusSeconds(86400));
        subscription.setUpdatedAt(Instant.now());

        SuperAdminPlanManagementService.PlanFeatures features = new SuperAdminPlanManagementService.PlanFeatures(
                false, false, false, false, false, false, false, false, false,
                false, false, false, false, false, false, false, false, false
        );
        SuperAdminPlanManagementService.PlanSnapshot currentPlan = new SuperAdminPlanManagementService.PlanSnapshot(
                currentPlanId,
                "basic",
                "Plano Basico",
                "MONTHLY",
                9990L,
                9990L,
                99900L,
                5,
                30,
                30,
                features
        );
        SuperAdminPlanManagementService.PlanSnapshot targetPlan = new SuperAdminPlanManagementService.PlanSnapshot(
                targetPlanId,
                "pro",
                "Plano Pro",
                "MONTHLY",
                14990L,
                14990L,
                149900L,
                20,
                100,
                100,
                features
        );
        SuperAdminPlanManagementService.TenantPlanUsage usage = new SuperAdminPlanManagementService.TenantPlanUsage(
                2, 10, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false
        );

        when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
        when(companyRepo.save(any(JpaCompanyEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(subscriptionRepo.findTopByCompanyIdOrderByUpdatedAtDesc(companyId)).thenReturn(Optional.of(subscription));
        when(subscriptionRepo.findByProviderAndProviderSubscriptionId("ASAAS", "sub_123")).thenReturn(Optional.of(subscription));
        when(subscriptionRepo.save(any(JpaIoAutoBillingSubscriptionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(onboardingRepo.findByCompanyId(companyId)).thenReturn(Optional.empty());
        when(planManagementService.listActivePlanSnapshots()).thenReturn(List.of(currentPlan, targetPlan));
        when(planManagementService.getTenantPlanUsage(companyId)).thenReturn(usage);
        when(planManagementService.resolvePlanForCompany(companyId)).thenAnswer(invocation ->
                targetPlanId.equals(company.getPlanId()) ? targetPlan : currentPlan
        );
        when(planManagementService.evaluateTenantPlanCompatibility(companyId, currentPlan))
                .thenReturn(new SuperAdminPlanManagementService.PlanCompatibility(true, List.of(), usage));
        when(planManagementService.evaluateTenantPlanCompatibility(companyId, targetPlan))
                .thenReturn(new SuperAdminPlanManagementService.PlanCompatibility(true, List.of(), usage));
        when(planManagementService.evaluateTenantPlanCompatibility(usage, currentPlan))
                .thenReturn(new SuperAdminPlanManagementService.PlanCompatibility(true, List.of(), usage));
        when(planManagementService.evaluateTenantPlanCompatibility(usage, targetPlan))
                .thenReturn(new SuperAdminPlanManagementService.PlanCompatibility(true, List.of(), usage));

        String asaasBaseUrl = server == null ? "http://localhost:65535" : "http://localhost:" + server.getAddress().getPort();
        IoAutoBillingService service = new IoAutoBillingService(
                signupRepo,
                subscriptionRepo,
                integrationRepo,
                onboardingRepo,
                companyRepo,
                userRepo,
                onboardingService,
                planManagementService,
                "token-123",
                "webhook-123",
                asaasBaseUrl,
                "https://asaas.test",
                "https://app.test",
                "ioauto-growth",
                "IOAuto Growth",
                "Plano Growth",
                new BigDecimal("349.00"),
                "MONTHLY",
                "CREDIT_CARD"
        );

        return new TestContext(service, companyRepo, subscriptionRepo, onboardingRepo, planManagementService, companyId, company, subscription, currentPlan, targetPlan, usage);
    }

    private static HttpServer startServer(ExchangeHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
        return server;
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static void writeJson(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static String toDecimal(Long amountCents) {
        return BigDecimal.valueOf(amountCents == null ? 0L : amountCents, 2)
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString();
    }

    @FunctionalInterface
    private interface ExchangeHandler {
        void handle(HttpExchange exchange) throws IOException;
    }

    private record TestContext(
            IoAutoBillingService service,
            CompanyRepositoryJpa companyRepo,
            IoAutoBillingSubscriptionRepositoryJpa subscriptionRepo,
            OnboardingSubscriptionRepositoryJpa onboardingRepo,
            SuperAdminPlanManagementService planManagementService,
            UUID companyId,
            JpaCompanyEntity company,
            JpaIoAutoBillingSubscriptionEntity subscription,
            SuperAdminPlanManagementService.PlanSnapshot currentPlan,
            SuperAdminPlanManagementService.PlanSnapshot targetPlan,
            SuperAdminPlanManagementService.TenantPlanUsage usage
    ) {
    }
}
