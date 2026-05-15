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
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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

    @Test
    void previewUpgradeMonthlyUsesCatalogAmountAndMarksPendingPayments() {
        TestContext ctx = newTestContext();

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "pro", "MONTHLY");

        assertThat(response.currentPlan().key()).isEqualTo("basic");
        assertThat(response.targetPlan().key()).isEqualTo("pro");
        assertThat(response.targetPlan().amountCents()).isEqualTo(14990L);
        assertThat(response.changeType()).isEqualTo("UPGRADE");
        assertThat(response.asaasCycle()).isEqualTo("MONTHLY");
        assertThat(response.willUpdatePendingPayments()).isTrue();
    }

    @Test
    void previewMonthlyToAnnualUsesYearlyAsaasCycle() {
        TestContext ctx = newTestContext();

        PlanChangePreviewResponse response = ctx.service.previewPlanChange(ctx.companyId, "basic", "ANNUAL");

        assertThat(response.currentPlan().billingInterval()).isEqualTo("MONTHLY");
        assertThat(response.targetPlan().billingInterval()).isEqualTo("ANNUAL");
        assertThat(response.targetPlan().amountCents()).isEqualTo(99900L);
        assertThat(response.changeType()).isEqualTo("CYCLE_CHANGE");
        assertThat(response.asaasCycle()).isEqualTo("YEARLY");
        assertThat(response.willUpdatePendingPayments()).isFalse();
    }

    @Test
    void confirmPlanChangeSuccessUpdatesLocalSnapshotAfterAsaas() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>("");
        HttpServer server = startServer(exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            writeJson(exchange, 200, """
                    {
                      "id": "sub_123",
                      "customer": "cus_123",
                      "status": "ACTIVE",
                      "value": 149.90,
                      "cycle": "MONTHLY",
                      "nextDueDate": "2026-06-15"
                    }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);

            PlanChangeConfirmResponse response = ctx.service.confirmPlanChange(ctx.companyId, "pro", "MONTHLY", true);
            BillingSnapshot snapshot = ctx.service.getBillingSnapshot(ctx.companyId);

            assertThat(response.success()).isTrue();
            assertThat(response.subscription().planKey()).isEqualTo("pro");
            assertThat(ctx.company.getPlanId()).isEqualTo(ctx.targetPlan.planId());
            assertThat(ctx.company.getSubscriptionAmountCents()).isEqualTo(14990L);
            assertThat(ctx.subscription.getPlanKey()).isEqualTo("pro");
            assertThat(ctx.subscription.getBillingInterval()).isEqualTo("MONTHLY");
            assertThat(snapshot.planKey()).isEqualTo("pro");
            assertThat(snapshot.amountCents()).isEqualTo(14990L);
            assertThat(requestBody.get()).contains("\"updatePendingPayments\":true");
            assertThat(requestBody.get()).contains("\"cycle\":\"MONTHLY\"");
            assertThat(requestBody.get()).contains("\"value\":149.90");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void confirmPlanChangeFailureFromAsaasDoesNotPersistLocalChanges() throws Exception {
        HttpServer server = startServer(exchange ->
                writeJson(exchange, 500, """
                        { "errors": [ { "description": "gateway-failed" } ] }
                        """));

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
    void confirmPlanChangeWhenAsaasIsUnavailableReturnsCommunicationDetail() {
        TestContext ctx = newTestContext();

        assertThatThrownBy(() -> ctx.service.confirmPlanChange(ctx.companyId, "pro", "MONTHLY", true))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> {
                    BusinessException businessException = (BusinessException) error;
                    assertThat(businessException.code()).isEqualTo("ASAAS_SUBSCRIPTION_UPDATE_FAILED");
                    assertThat(businessException.getMessage()).contains("Falha de comunicacao com o Asaas");
                });
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
        onboardingSubscription.setValor(new java.math.BigDecimal("99.90"));
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
    void confirmUsesOnboardingMirrorWhenLocalBillingSubscriptionIsMissing() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>("");
        HttpServer server = startServer(exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            writeJson(exchange, 200, """
                    {
                      "id": "sub_123",
                      "customer": "cus_123",
                      "status": "ACTIVE",
                      "value": 149.90,
                      "cycle": "MONTHLY",
                      "nextDueDate": "2026-06-15"
                    }
                    """);
        });

        try {
            TestContext ctx = newTestContext(server);
            JpaOnboardingSubscriptionEntity onboardingSubscription = new JpaOnboardingSubscriptionEntity();
            onboardingSubscription.setId(UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd"));
            onboardingSubscription.setCompanyId(ctx.companyId);
            onboardingSubscription.setAsaasSubscriptionId("sub_123");
            onboardingSubscription.setValor(new java.math.BigDecimal("99.90"));
            onboardingSubscription.setRecorrencia("mensal");
            onboardingSubscription.setStatus("ACTIVE");
            onboardingSubscription.setCreatedAt(Instant.parse("2026-05-01T03:00:00Z"));
            onboardingSubscription.setUpdatedAt(Instant.parse("2026-05-15T10:00:00Z"));

            when(ctx.subscriptionRepo.findTopByCompanyIdOrderByUpdatedAtDesc(ctx.companyId)).thenReturn(Optional.empty());
            when(ctx.onboardingRepo.findByCompanyId(ctx.companyId)).thenReturn(Optional.of(onboardingSubscription));

            PlanChangeConfirmResponse response = ctx.service.confirmPlanChange(ctx.companyId, "pro", "MONTHLY", true);

            assertThat(response.success()).isTrue();
            assertThat(ctx.company.getPlanId()).isEqualTo(ctx.targetPlan.planId());
            assertThat(ctx.company.getSubscriptionAmountCents()).isEqualTo(14990L);
            verify(ctx.subscriptionRepo).save(any(JpaIoAutoBillingSubscriptionEntity.class));
            assertThat(requestBody.get()).contains("\"value\":149.90");
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

        JpaCompanyEntity company = new JpaCompanyEntity();
        company.setId(companyId);
        company.setName("Loja Teste");
        company.setStatus("ACTIVE");
        company.setSubscriptionStatus("ACTIVE");
        company.setPlanId(currentPlanId);
        company.setBillingRecurrence("MONTHLY");
        company.setSubscriptionAmountCents(9990L);
        company.setUpdatedAt(Instant.parse("2026-05-15T10:00:00Z"));

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
        subscription.setCurrentPeriodEnd(Instant.parse("2026-06-01T03:00:00Z"));
        subscription.setCreatedAt(Instant.parse("2026-05-01T03:00:00Z"));
        subscription.setUpdatedAt(Instant.parse("2026-05-15T10:00:00Z"));

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
                new java.math.BigDecimal("349.00"),
                "MONTHLY",
                "CREDIT_CARD"
        );

        return new TestContext(service, companyRepo, subscriptionRepo, onboardingRepo, planManagementService, companyId, company, subscription, currentPlan, targetPlan, usage);
    }

    private static HttpServer startServer(ExchangeHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/subscriptions/sub_123", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.createContext("/v3/subscriptions/sub_123", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
        return server;
    }

    private static void writeJson(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
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
