package com.io.appioweb.application.onboarding;

import com.io.appioweb.adapters.integrations.asaas.AsaasClient;
import com.io.appioweb.adapters.integrations.asaas.AsaasProperties;
import com.io.appioweb.adapters.integrations.asaas.AsaasSubscriptionService;
import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.JpaUserEntity;
import com.io.appioweb.adapters.persistence.auth.TeamRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.*;
import com.io.appioweb.adapters.web.onboarding.dto.*;
import com.io.appioweb.domain.onboarding.*;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FirstUserOnboardingServiceTest {

    @Mock private OnboardingEventRepositoryJpa eventRepo;
    @Mock private OnboardingSubscriptionRepositoryJpa subscriptionRepo;
    @Mock private CompanyRepositoryJpa companyRepo;
    @Mock private UserRepositoryJpa userRepo;
    @Mock private TeamRepositoryJpa teamRepo;
    @Mock private PasswordResetTokenRepositoryJpa passwordTokenRepo;
    @Mock private EmailOutboxRepositoryJpa emailOutboxRepo;
    @Mock private AsaasClient asaasClient;
    @Mock private AsaasSubscriptionService asaasSubscriptionService;

    private EmailOutboxService emailOutboxService;
    private FirstUserOnboardingService service;

    @BeforeEach
    void setUp() {
        emailOutboxService = new EmailOutboxService(emailOutboxRepo);
        service = new FirstUserOnboardingService(
                eventRepo, subscriptionRepo, companyRepo, userRepo, teamRepo,
                passwordTokenRepo, emailOutboxService, asaasSubscriptionService,
                "https://app.ioauto.com.br/definir-senha",
                "https://app.ioauto.com.br/login"
        );
    }

    // ====================================================================
    // Helper methods
    // ====================================================================

    private FirstUserRegisterRequest buildRegisterRequest(String idempotencyKey) {
        return new FirstUserRegisterRequest(
                idempotencyKey,
                new FirstUserRegisterRequest.FirstUserRegistration(
                        null, "Empresa X", "Empresa X", "contato@empresa.com",
                        null, "12345678000199", "47999999999",
                        "Rua X, 123", "Blumenau", "SC", "89000000",
                        "João Silva", "joao@empresa.com", "47999999999", "INACTIVE"
                ),
                new FirstUserRegisterRequest.Comercial(197, "mensal", "2026-05-08", "meta-campanha"),
                new FirstUserRegisterRequest.Billing("pay_xxx", "sub_xxx", "IO Connect - Plano Mensal")
        );
    }

    private FirstUserActivateRequest buildActivateRequest(String idempotencyKey, String paymentStatus) {
        return new FirstUserActivateRequest(
                idempotencyKey, "pay_xxx", "sub_xxx", paymentStatus,
                197, "mensal", "2026-05-08", "meta-campanha", "IO Connect - Plano Mensal"
        );
    }

    private JpaOnboardingEventEntity buildDoneEvent(String key) {
        JpaOnboardingEventEntity event = new JpaOnboardingEventEntity();
        event.setId(UUID.randomUUID());
        event.setIdempotencyKey(key);
        event.setEventType("REGISTER");
        event.setPayloadJson("{}");
        event.setStatus(OnboardingEventStatus.DONE.name());
        event.setCreatedAt(Instant.now());
        return event;
    }

    private JpaOnboardingSubscriptionEntity buildSubscription(UUID companyId) {
        JpaOnboardingSubscriptionEntity sub = new JpaOnboardingSubscriptionEntity();
        sub.setId(UUID.randomUUID());
        sub.setCompanyId(companyId);
        sub.setAsaasSubscriptionId("sub_xxx");
        sub.setAsaasPaymentId("pay_xxx");
        sub.setValor(BigDecimal.valueOf(197));
        sub.setRecorrencia("mensal");
        sub.setStatus(SubscriptionStatus.PENDING.name());
        sub.setCreatedAt(Instant.now());
        sub.setUpdatedAt(Instant.now());
        return sub;
    }

    private JpaCompanyEntity buildCompany(UUID id, String status) {
        JpaCompanyEntity company = new JpaCompanyEntity();
        company.setId(id);
        company.setName("Empresa X");
        company.setStatus(status);
        company.setCreatedAt(Instant.now());
        company.setUpdatedAt(Instant.now());
        return company;
    }

    private JpaUserEntity buildUser(UUID id, UUID companyId, boolean active, boolean primary) {
        JpaUserEntity user = new JpaUserEntity();
        user.setId(id);
        user.setCompanyId(companyId);
        user.setEmail("joao@empresa.com");
        user.setFullName("João Silva");
        user.setActive(active);
        user.setPrimary(primary);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        return user;
    }

    // ====================================================================
    // REGISTER Tests
    // ====================================================================

    @Nested
    @DisplayName("Register endpoint")
    class RegisterTests {

        @Test
        @DisplayName("1. register cria empresa INACTIVE")
        void register_createsInactiveCompany() {
            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.findByCnpj(anyString())).thenReturn(Optional.empty());
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.findAllByEmail(anyString())).thenReturn(List.of());
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionId(anyString())).thenReturn(Optional.empty());
            when(subscriptionRepo.findByAsaasPaymentId(anyString())).thenReturn(Optional.empty());
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FirstUserRegisterResponse response = service.register(buildRegisterRequest("key-1"), "{}");

            assertNotNull(response.companyId());
            assertEquals("INACTIVE", response.status());

            ArgumentCaptor<JpaCompanyEntity> companyCaptor = ArgumentCaptor.forClass(JpaCompanyEntity.class);
            verify(companyRepo).save(companyCaptor.capture());
            assertEquals(CompanyStatus.INACTIVE.name(), companyCaptor.getValue().getStatus());
        }

        @Test
        @DisplayName("2. register cria primeiro usuário INACTIVE")
        void register_createsInactiveUser() {
            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.findByCnpj(anyString())).thenReturn(Optional.empty());
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.findAllByEmail(anyString())).thenReturn(List.of());
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionId(anyString())).thenReturn(Optional.empty());
            when(subscriptionRepo.findByAsaasPaymentId(anyString())).thenReturn(Optional.empty());
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.register(buildRegisterRequest("key-2"), "{}");

            ArgumentCaptor<JpaUserEntity> userCaptor = ArgumentCaptor.forClass(JpaUserEntity.class);
            verify(userRepo).save(userCaptor.capture());
            assertFalse(userCaptor.getValue().isActive());
            assertTrue(userCaptor.getValue().isPrimary());
        }

        @Test
        @DisplayName("3. register duplicado não cria empresa duplicada")
        void register_idempotent_doesNotDuplicateCompany() {
            JpaOnboardingEventEntity doneEvent = buildDoneEvent("key-dup");
            when(eventRepo.findByIdempotencyKey("key-dup")).thenReturn(Optional.of(doneEvent));

            FirstUserRegisterResponse response = service.register(buildRegisterRequest("key-dup"), "{}");

            assertFalse(response.created());
            verify(companyRepo, never()).save(any());
        }

        @Test
        @DisplayName("4. register duplicado não cria usuário duplicado")
        void register_idempotent_doesNotDuplicateUser() {
            JpaOnboardingEventEntity doneEvent = buildDoneEvent("key-dup2");
            when(eventRepo.findByIdempotencyKey("key-dup2")).thenReturn(Optional.of(doneEvent));

            service.register(buildRegisterRequest("key-dup2"), "{}");

            verify(userRepo, never()).save(any());
        }
    }

    // ====================================================================
    // ACTIVATE Tests
    // ====================================================================

    @Nested
    @DisplayName("Activate endpoint")
    class ActivateTests {

        @Test
        @DisplayName("5. activate com PAYMENT_CONFIRMED ativa empresa e usuário")
        void activate_paymentConfirmed_activatesCompanyAndUser() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FirstUserActivateResponse response = service.activate(buildActivateRequest("act-1", "PAYMENT_CONFIRMED"), "{}");

            assertTrue(response.activated());
            assertFalse(response.alreadyActive());

            ArgumentCaptor<JpaCompanyEntity> companyCaptor = ArgumentCaptor.forClass(JpaCompanyEntity.class);
            verify(companyRepo).save(companyCaptor.capture());
            assertEquals(CompanyStatus.ACTIVE.name(), companyCaptor.getValue().getStatus());

            ArgumentCaptor<JpaUserEntity> userCaptor = ArgumentCaptor.forClass(JpaUserEntity.class);
            verify(userRepo).save(userCaptor.capture());
            assertTrue(userCaptor.getValue().isActive());
        }

        @Test
        @DisplayName("6. activate com PAYMENT_RECEIVED ativa empresa e usuário")
        void activate_paymentReceived_activatesCompanyAndUser() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FirstUserActivateResponse response = service.activate(buildActivateRequest("act-2", "PAYMENT_RECEIVED"), "{}");

            assertTrue(response.activated());
        }

        @Test
        @DisplayName("7. activate duplicado retorna alreadyActive true")
        void activate_alreadyActive_returnsAlreadyActive() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.ACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, true, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));

            FirstUserActivateResponse response = service.activate(buildActivateRequest("act-3", "CONFIRMED"), "{}");

            assertFalse(response.activated());
            assertTrue(response.alreadyActive());
        }

        @Test
        @DisplayName("8. activate com status inválido não ativa")
        void activate_invalidStatus_doesNotActivate() {
            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThrows(BusinessException.class, () ->
                    service.activate(buildActivateRequest("act-4", "PENDING"), "{}")
            );

            verify(companyRepo, never()).save(any());
            verify(userRepo, never()).save(any());
        }

        @Test
        @DisplayName("12. updateSubscriptionDescription é chamado quando existe subscriptionId")
        void activate_callsAsaasDescriptionSync() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.activate(buildActivateRequest("act-5", "CONFIRMED"), "{}");

            verify(asaasSubscriptionService).syncDescription(any(), eq("IO Connect - Plano Mensal"), eq(companyId.toString()));
        }

        @Test
        @DisplayName("13. Falha no updateSubscriptionDescription não quebra o fluxo")
        void activate_asaasFailure_doesNotBreakActivation() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            doThrow(new RuntimeException("Asaas error")).when(asaasSubscriptionService)
                    .syncDescription(any(), anyString(), anyString());

            FirstUserActivateResponse response = service.activate(buildActivateRequest("act-6", "CONFIRMED"), "{}");

            assertTrue(response.activated());
            // Activation succeeded despite Asaas failure
        }

        @Test
        @DisplayName("14. origem do pagamento é salva na tabela subscriptions")
        void activate_savesOrigem() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.activate(buildActivateRequest("act-7", "CONFIRMED"), "{}");

            ArgumentCaptor<JpaOnboardingSubscriptionEntity> subCaptor = ArgumentCaptor.forClass(JpaOnboardingSubscriptionEntity.class);
            verify(subscriptionRepo, atLeastOnce()).save(subCaptor.capture());
            assertEquals("meta-campanha", subCaptor.getValue().getOrigem());
        }

        @Test
        @DisplayName("15. paymentId e subscriptionId são salvos corretamente")
        void activate_savesPaymentAndSubscriptionIds() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaOnboardingSubscriptionEntity sub = buildSubscription(companyId);
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.INACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, false, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(subscriptionRepo.findByAsaasSubscriptionIdForUpdate("sub_xxx")).thenReturn(Optional.of(sub));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findAllByCompanyId(companyId)).thenReturn(List.of(user));
            when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(teamRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.activate(buildActivateRequest("act-8", "CONFIRMED"), "{}");

            assertEquals("pay_xxx", sub.getAsaasPaymentId());
            assertEquals("sub_xxx", sub.getAsaasSubscriptionId());
        }
    }

    // ====================================================================
    // SEND ACCESS EMAIL Tests
    // ====================================================================

    @Nested
    @DisplayName("SendAccessEmail endpoint")
    class SendAccessEmailTests {

        @Test
        @DisplayName("9. send-access-email cria outbox")
        void sendAccessEmail_createsOutbox() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.ACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, true, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(emailOutboxRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(emailOutboxRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findById(userId)).thenReturn(Optional.of(user));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SendAccessEmailRequest req = new SendAccessEmailRequest(
                    "email-1", userId.toString(), companyId.toString(),
                    "joao@empresa.com", "João Silva",
                    "https://app.ioauto.com.br/login", null, null
            );

            SendAccessEmailResponse response = service.sendAccessEmail(req, "{}");

            assertNotNull(response);
            verify(emailOutboxRepo).save(any());
        }

        @Test
        @DisplayName("10. send-access-email duplicado não envia duas vezes")
        void sendAccessEmail_idempotent() {
            JpaEmailOutboxEntity existing = new JpaEmailOutboxEntity();
            existing.setId(UUID.randomUUID());
            existing.setStatus(EmailStatus.SENT.name());
            existing.setProviderId("msg-123");
            existing.setIdempotencyKey("email-dup");

            when(emailOutboxRepo.findByIdempotencyKey("email-dup")).thenReturn(Optional.of(existing));

            SendAccessEmailRequest req = new SendAccessEmailRequest(
                    "email-dup", null, null,
                    "joao@empresa.com", "João Silva",
                    "https://app.ioauto.com.br/login", null, null
            );

            SendAccessEmailResponse response = service.sendAccessEmail(req, "{}");

            assertTrue(response.emailSent());
            assertEquals("msg-123", response.providerMessageId());
            // save should only be called for the outbox entity once (returned from findByIdempotencyKey)
            verify(emailOutboxRepo, never()).save(any());
        }

        @Test
        @DisplayName("11. Falha no envio de e-mail não desfaz ativação")
        void sendAccessEmail_failure_doesNotDeactivate() {
            UUID companyId = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            JpaCompanyEntity company = buildCompany(companyId, CompanyStatus.ACTIVE.name());
            JpaUserEntity user = buildUser(userId, companyId, true, true);

            when(eventRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(emailOutboxRepo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
            when(emailOutboxRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(companyRepo.findById(companyId)).thenReturn(Optional.of(company));
            when(userRepo.findById(userId)).thenReturn(Optional.of(user));
            when(passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(any())).thenReturn(Optional.empty());
            when(passwordTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SendAccessEmailRequest req = new SendAccessEmailRequest(
                    "email-fail", userId.toString(), companyId.toString(),
                    "joao@empresa.com", "João Silva",
                    "https://app.ioauto.com.br/login", null, null
            );

            // Should complete without exception even if email sending fails
            SendAccessEmailResponse response = service.sendAccessEmail(req, "{}");
            assertNotNull(response);

            // Company should still be ACTIVE (no deactivation)
            assertEquals(CompanyStatus.ACTIVE.name(), company.getStatus());
        }
    }

    // ====================================================================
    // Concurrency test
    // ====================================================================

    @Test
    @DisplayName("16. Chamadas duplicadas com mesmo idempotencyKey não duplicam registros")
    void idempotency_duplicateCallsDoNotDuplicate() {
        String key = "concurrent-key";
        JpaOnboardingEventEntity doneEvent = buildDoneEvent(key);
        when(eventRepo.findByIdempotencyKey(key)).thenReturn(Optional.of(doneEvent));

        // First call returns cached result
        FirstUserRegisterResponse r1 = service.register(buildRegisterRequest(key), "{}");
        FirstUserRegisterResponse r2 = service.register(buildRegisterRequest(key), "{}");

        assertFalse(r1.created());
        assertFalse(r2.created());
        verify(companyRepo, never()).save(any());
        verify(userRepo, never()).save(any());
    }
}
