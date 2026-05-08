package com.io.appioweb.application.onboarding;

import com.io.appioweb.adapters.integrations.asaas.AsaasSubscriptionService;
import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.JpaTeamEntity;
import com.io.appioweb.adapters.persistence.auth.JpaUserEntity;
import com.io.appioweb.adapters.persistence.auth.TeamRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.*;
import com.io.appioweb.adapters.web.onboarding.dto.*;
import com.io.appioweb.domain.onboarding.*;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Core onboarding service for the first-user post-payment flow.
 * <p>
 * Handles: register → activate → send-access-email with full idempotency.
 */
@Service
public class FirstUserOnboardingService {

    private static final Logger log = LoggerFactory.getLogger(FirstUserOnboardingService.class);
    private static final int PASSWORD_RESET_TOKEN_TTL_HOURS = 72;

    private static final Set<String> VALID_ACTIVATION_STATUSES = Set.of(
            "CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"
    );

    private final OnboardingEventRepositoryJpa eventRepo;
    private final OnboardingSubscriptionRepositoryJpa subscriptionRepo;
    private final CompanyRepositoryJpa companyRepo;
    private final UserRepositoryJpa userRepo;
    private final TeamRepositoryJpa teamRepo;
    private final PasswordResetTokenRepositoryJpa passwordTokenRepo;
    private final EmailOutboxService emailOutboxService;
    private final AsaasSubscriptionService asaasSubscriptionService;
    private final String setPasswordBaseUrl;
    private final String loginUrl;

    public FirstUserOnboardingService(
            OnboardingEventRepositoryJpa eventRepo,
            OnboardingSubscriptionRepositoryJpa subscriptionRepo,
            CompanyRepositoryJpa companyRepo,
            UserRepositoryJpa userRepo,
            TeamRepositoryJpa teamRepo,
            PasswordResetTokenRepositoryJpa passwordTokenRepo,
            EmailOutboxService emailOutboxService,
            AsaasSubscriptionService asaasSubscriptionService,
            @Value("${SET_PASSWORD_URL:https://app.ioauto.com.br/definir-senha}") String setPasswordBaseUrl,
            @Value("${LOGIN_URL:https://app.ioauto.com.br/login}") String loginUrl
    ) {
        this.eventRepo = eventRepo;
        this.subscriptionRepo = subscriptionRepo;
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
        this.teamRepo = teamRepo;
        this.passwordTokenRepo = passwordTokenRepo;
        this.emailOutboxService = emailOutboxService;
        this.asaasSubscriptionService = asaasSubscriptionService;
        this.setPasswordBaseUrl = setPasswordBaseUrl != null ? setPasswordBaseUrl.trim() : "";
        this.loginUrl = loginUrl != null ? loginUrl.trim() : "";
    }

    // ====================================================================
    // 1. REGISTER
    // ====================================================================

    @Transactional
    public FirstUserRegisterResponse register(FirstUserRegisterRequest request, String payloadJson) {
        String key = request.idempotencyKey();
        log.info("[Onboarding:Register] Processing idempotencyKey={}", key);

        Optional<JpaOnboardingEventEntity> existingEvent = eventRepo.findByIdempotencyKey(key);
        if (existingEvent.isPresent() && OnboardingEventStatus.DONE.name().equals(existingEvent.get().getStatus())) {
            log.info("[Onboarding:Register] Idempotent hit – returning cached result for key={}", key);
            return buildRegisterResponseFromEvent(existingEvent.get());
        }

        JpaOnboardingEventEntity event = createEvent(key, "REGISTER", payloadJson);

        try {
            FirstUserRegisterRequest.FirstUserRegistration reg = request.firstUserRegistration();
            FirstUserRegisterRequest.Comercial comercial = request.comercial();
            FirstUserRegisterRequest.Billing billing = request.billing();

            requireNotBlank(reg.responsavelEmail(), "E-mail do responsável é obrigatório.");
            requireNotBlank(reg.responsavelNome(), "Nome do responsável é obrigatório.");

            String cnpj = normalizeCnpj(reg.cnpj());
            String email = normalizeEmail(reg.responsavelEmail());
            String uf = reg.uf() != null ? reg.uf().trim().toUpperCase(Locale.ROOT) : "";
            String whatsapp = normalizeWhatsapp(reg.whatsappNumber());

            JpaCompanyEntity company;
            boolean companyCreated = false;

            if (!cnpj.isBlank()) {
                company = companyRepo.findByCnpj(cnpj).orElse(null);
            } else {
                String companyEmail = reg.companyEmail() != null && !reg.companyEmail().isBlank()
                        ? reg.companyEmail().trim().toLowerCase(Locale.ROOT)
                        : email;

                company = companyRepo.findByEmail(companyEmail).orElse(null);
            }

            if (company == null) {
                company = new JpaCompanyEntity();
                company.setId(UUID.randomUUID());
                company.setCreatedAt(Instant.now());
                company.setStatus(CompanyStatus.INACTIVE.name());
                companyCreated = true;
            }

            company.setName(notBlankOr(reg.nomeFantasia(), company.getName(), reg.razaoSocial(), "Empresa"));

            if (reg.razaoSocial() != null && !reg.razaoSocial().isBlank()) {
                company.setRazaoSocial(reg.razaoSocial().trim());
            }

            if (reg.nomeFantasia() != null && !reg.nomeFantasia().isBlank()) {
                company.setNomeFantasia(reg.nomeFantasia().trim());
            }

            company.setEmail(reg.companyEmail() != null && !reg.companyEmail().isBlank()
                    ? reg.companyEmail().trim().toLowerCase(Locale.ROOT)
                    : email);

            if (!cnpj.isBlank()) {
                company.setCnpj(cnpj);
            }

            if (!whatsapp.isBlank()) {
                company.setWhatsappNumber(whatsapp);
            }

            if (reg.endereco() != null && !reg.endereco().isBlank()) {
                company.setEndereco(reg.endereco().trim());
            }

            if (reg.cidade() != null && !reg.cidade().isBlank()) {
                company.setCidade(reg.cidade().trim());
            }

            if (!uf.isBlank()) {
                company.setUf(uf);
            }

            if (reg.cep() != null && !reg.cep().isBlank()) {
                company.setCep(reg.cep().trim().replaceAll("\\D", ""));
            }

            company.setUpdatedAt(Instant.now());

            if (companyCreated) {
                company.setStatus(CompanyStatus.INACTIVE.name());
            }

            company = companyRepo.save(company);

            JpaUserEntity user;
            boolean userCreated = false;

            List<JpaUserEntity> existingUsers = userRepo.findAllByEmail(email);

            final UUID companyIdForUserLookup = company.getId();

            user = existingUsers.stream()
                    .filter(u -> Objects.equals(u.getCompanyId(), companyIdForUserLookup))
                    .findFirst()
                    .orElse(null);

            if (user == null && !existingUsers.isEmpty()) {
                user = existingUsers.getFirst();
            }

            if (user == null) {
                user = new JpaUserEntity();
                user.setId(UUID.randomUUID());
                user.setCompanyId(company.getId());
                user.setCreatedAt(Instant.now());
                user.setActive(false);
                user.setPrimary(true);

                UUID teamId = UUID.randomUUID();

                JpaTeamEntity team = new JpaTeamEntity();
                team.setId(teamId);
                team.setCompanyId(company.getId());
                team.setName("Equipe Comercial");
                team.setCreatedAt(Instant.now());
                team.setUpdatedAt(Instant.now());

                teamRepo.save(team);

                user.setTeamId(teamId);
                userCreated = true;
            }

            user.setEmail(email);
            user.setFullName(reg.responsavelNome().trim());
            user.setNome(reg.responsavelNome().trim());

            if (reg.responsavelWhatsapp() != null && !reg.responsavelWhatsapp().isBlank()) {
                user.setWhatsapp(normalizeWhatsapp(reg.responsavelWhatsapp()));
            }

            if (reg.profileImageUrl() != null) {
                user.setProfileImageUrl(reg.profileImageUrl());
            }

            user.setUpdatedAt(Instant.now());

            if (userCreated) {
                user.setActive(false);
                user.setPrimary(true);
            }

            user = userRepo.save(user);

            BigDecimal valor = comercial != null && comercial.valorPagoCliente() != null
                    ? new BigDecimal(comercial.valorPagoCliente().toString())
                    : BigDecimal.ZERO;

            String recorrencia = comercial != null && comercial.recorrenciaPagamento() != null
                    ? comercial.recorrenciaPagamento().trim()
                    : "mensal";

            String origem = comercial != null && comercial.origem() != null
                    ? comercial.origem().trim()
                    : "";

            LocalDate dataAssinatura = parseDate(comercial != null ? comercial.dataAssinatura() : null);

            String paymentId = billing != null ? trimOrEmpty(billing.paymentId()) : "";
            String subscriptionId = billing != null ? trimOrEmpty(billing.subscriptionId()) : "";
            String planName = billing != null ? trimOrEmpty(billing.planName()) : "";

            JpaOnboardingSubscriptionEntity subscription = findOrCreateSubscription(paymentId, subscriptionId);
            subscription.setCompanyId(company.getId());
            subscription.setAsaasPaymentId(paymentId.isBlank() ? subscription.getAsaasPaymentId() : paymentId);
            subscription.setAsaasSubscriptionId(subscriptionId.isBlank() ? subscription.getAsaasSubscriptionId() : subscriptionId);
            subscription.setValor(valor);
            subscription.setRecorrencia(recorrencia);
            subscription.setOrigem(origem);
            subscription.setDataAssinatura(dataAssinatura);
            subscription.setDescription(planName);
            subscription.setStatus(SubscriptionStatus.PENDING.name());
            subscription.setUpdatedAt(Instant.now());

            subscriptionRepo.save(subscription);

            event.setStatus(OnboardingEventStatus.DONE.name());
            event.setProcessedAt(Instant.now());
            eventRepo.save(event);

            log.info(
                    "[Onboarding:Register] Completed – company={} user={} created={}",
                    company.getId(),
                    user.getId(),
                    companyCreated || userCreated
            );

            return new FirstUserRegisterResponse(
                    company.getId(),
                    user.getId(),
                    companyCreated || userCreated,
                    CompanyStatus.INACTIVE.name()
            );
        } catch (Exception e) {
            event.setStatus(OnboardingEventStatus.ERROR.name());
            event.setErrorMessage(e.getMessage());
            event.setProcessedAt(Instant.now());
            eventRepo.save(event);
            throw e;
        }
    }

    // ====================================================================
    // 2. ACTIVATE
    // ====================================================================

    @Transactional
    public FirstUserActivateResponse activate(FirstUserActivateRequest request, String payloadJson) {
        String key = request.idempotencyKey();
        log.info("[Onboarding:Activate] Processing idempotencyKey={}", key);

        Optional<JpaOnboardingEventEntity> existingEvent = eventRepo.findByIdempotencyKey(key);
        if (existingEvent.isPresent() && OnboardingEventStatus.DONE.name().equals(existingEvent.get().getStatus())) {
            log.info("[Onboarding:Activate] Idempotent hit – key={}", key);
            return buildActivateResponseFromEvent(existingEvent.get(), true);
        }

        JpaOnboardingEventEntity event = createEvent(key, "ACTIVATE", payloadJson);

        try {
            String paymentStatus = request.paymentStatus() != null
                    ? request.paymentStatus().trim().toUpperCase(Locale.ROOT)
                    : "";

            if (!VALID_ACTIVATION_STATUSES.contains(paymentStatus)) {
                log.warn("[Onboarding:Activate] Invalid paymentStatus='{}' – not activating", paymentStatus);

                event.setStatus(OnboardingEventStatus.DONE.name());
                event.setProcessedAt(Instant.now());
                event.setErrorMessage("Invalid paymentStatus: " + paymentStatus);
                eventRepo.save(event);

                throw new BusinessException(
                        "ONBOARDING_INVALID_PAYMENT_STATUS",
                        "Status de pagamento '" + paymentStatus + "' não é válido para ativação. Aceitos: " + VALID_ACTIVATION_STATUSES
                );
            }

            String subscriptionId = trimOrEmpty(request.subscriptionId());
            String paymentId = trimOrEmpty(request.paymentId());

            if (subscriptionId.isBlank() && paymentId.isBlank()) {
                throw new BusinessException(
                        "ONBOARDING_MISSING_REFERENCE",
                        "subscriptionId ou paymentId é obrigatório."
                );
            }

            JpaOnboardingSubscriptionEntity subscription = findSubscriptionForActivation(subscriptionId, paymentId);

            if (subscription == null) {
                throw new BusinessException(
                        "ONBOARDING_SUBSCRIPTION_NOT_FOUND",
                        "Assinatura não encontrada para subscriptionId=" + subscriptionId + " / paymentId=" + paymentId
                );
            }

            UUID companyId = subscription.getCompanyId();

            JpaCompanyEntity company = companyRepo.findById(companyId)
                    .orElseThrow(() -> new BusinessException(
                            "ONBOARDING_COMPANY_NOT_FOUND",
                            "Empresa não encontrada: " + companyId
                    ));

            JpaUserEntity primaryUser = findPrimaryUser(companyId);

            if (primaryUser == null) {
                throw new BusinessException(
                        "ONBOARDING_USER_NOT_FOUND",
                        "Usuário primário não encontrado para empresa: " + companyId
                );
            }

            if (CompanyStatus.ACTIVE.name().equals(company.getStatus()) && primaryUser.isActive()) {
                log.info("[Onboarding:Activate] Already active – company={} user={}", companyId, primaryUser.getId());

                event.setStatus(OnboardingEventStatus.DONE.name());
                event.setProcessedAt(Instant.now());
                eventRepo.save(event);

                return new FirstUserActivateResponse(false, true, companyId, primaryUser.getId(), subscription.getId());
            }

            subscription.setStatus(SubscriptionStatus.ACTIVE.name());

            if (request.valorPagoCliente() != null) {
                subscription.setValor(new BigDecimal(request.valorPagoCliente().toString()));
            }

            if (request.recorrenciaPagamento() != null && !request.recorrenciaPagamento().isBlank()) {
                subscription.setRecorrencia(request.recorrenciaPagamento().trim());
            }

            subscription.setDataAssinatura(parseDate(request.dataAssinatura()));

            if (request.origem() != null && !request.origem().isBlank()) {
                subscription.setOrigem(request.origem().trim());
            }

            if (request.planName() != null && !request.planName().isBlank()) {
                subscription.setDescription(request.planName().trim());
            }

            subscription.setUpdatedAt(Instant.now());
            subscriptionRepo.save(subscription);

            company.setStatus(CompanyStatus.ACTIVE.name());
            company.setUpdatedAt(Instant.now());
            companyRepo.save(company);

            primaryUser.setActive(true);
            primaryUser.setUpdatedAt(Instant.now());
            userRepo.save(primaryUser);

            if (primaryUser.getPasswordHash() == null || primaryUser.getPasswordHash().isBlank()) {
                generatePasswordResetToken(primaryUser.getId());
            }

            if (!subscriptionId.isBlank()) {
                try {
                    String planName = request.planName() != null && !request.planName().isBlank()
                            ? request.planName().trim()
                            : subscription.getDescription();

                    asaasSubscriptionService.syncDescription(subscription, planName, companyId.toString());
                } catch (Exception e) {
                    log.error("[Onboarding:Activate] Asaas description sync failed (non-blocking): {}", e.getMessage());
                }
            }

            event.setStatus(OnboardingEventStatus.DONE.name());
            event.setProcessedAt(Instant.now());
            eventRepo.save(event);

            log.info(
                    "[Onboarding:Activate] Completed – company={} user={} subscription={}",
                    companyId,
                    primaryUser.getId(),
                    subscription.getId()
            );

            return new FirstUserActivateResponse(true, false, companyId, primaryUser.getId(), subscription.getId());
        } catch (Exception e) {
            if (!OnboardingEventStatus.DONE.name().equals(event.getStatus())) {
                event.setStatus(OnboardingEventStatus.ERROR.name());
                event.setErrorMessage(e.getMessage());
                event.setProcessedAt(Instant.now());
                eventRepo.save(event);
            }

            throw e;
        }
    }

    // ====================================================================
    // 3. SEND ACCESS EMAIL
    // ====================================================================

    @Transactional
    public SendAccessEmailResponse sendAccessEmail(SendAccessEmailRequest request, String payloadJson) {
        String key = request.idempotencyKey();
        log.info("[Onboarding:SendAccessEmail] Processing idempotencyKey={}", key);

        Optional<JpaEmailOutboxEntity> existingEmail = emailOutboxService.findByIdempotencyKey(key);

        if (existingEmail.isPresent()) {
            log.info("[Onboarding:SendAccessEmail] Idempotent hit on email_outbox – key={}", key);

            JpaEmailOutboxEntity emailOutbox = existingEmail.get();

            return new SendAccessEmailResponse(
                    EmailStatus.SENT.name().equals(emailOutbox.getStatus()),
                    emailOutbox.getProviderId() != null ? emailOutbox.getProviderId() : ""
            );
        }

        Optional<JpaOnboardingEventEntity> existingEvent = eventRepo.findByIdempotencyKey(key);

        if (existingEvent.isPresent() && OnboardingEventStatus.DONE.name().equals(existingEvent.get().getStatus())) {
            log.info("[Onboarding:SendAccessEmail] Idempotent hit on onboarding_events – key={}", key);
            return new SendAccessEmailResponse(true, "");
        }

        JpaOnboardingEventEntity event = createEvent(key, "SEND_ACCESS_EMAIL", payloadJson);

        try {
            String email = normalizeEmail(request.email());
            String nome = request.nome() != null ? request.nome().trim() : "";

            UUID companyId = parseUuidOrNull(request.companyId());
            UUID userId = parseUuidOrNull(request.userId());
            String companyName = "";

            if (companyId != null) {
                JpaCompanyEntity company = companyRepo.findById(companyId).orElse(null);

                if (company == null || !CompanyStatus.ACTIVE.name().equals(company.getStatus())) {
                    throw new BusinessException(
                            "ONBOARDING_COMPANY_NOT_ACTIVE",
                            "Empresa não está ativa. Ative primeiro via /activate."
                    );
                }
            }

            if (companyId != null) {
                JpaCompanyEntity company = companyRepo.findById(companyId).orElse(null);
                if (company != null) {
                    companyName = company.getNomeFantasia() != null && !company.getNomeFantasia().isBlank()
                            ? company.getNomeFantasia().trim()
                            : company.getName();
                }
            }

            if (userId != null) {
                JpaUserEntity user = userRepo.findById(userId).orElse(null);

                if (user == null || !user.isActive()) {
                    throw new BusinessException(
                            "ONBOARDING_USER_NOT_ACTIVE",
                            "Usuário não está ativo. Ative primeiro via /activate."
                    );
                }
            }

            String setPasswordTokenUrl = request.setPasswordTokenUrl();

            if ((setPasswordTokenUrl == null || setPasswordTokenUrl.isBlank()) && userId != null) {
                setPasswordTokenUrl = generateSetPasswordUrl(userId);
            }

            String resolvedLoginUrl = request.loginUrl() != null && !request.loginUrl().isBlank()
                    ? request.loginUrl().trim()
                    : this.loginUrl;

            JpaEmailOutboxEntity outbox = emailOutboxService.createFirstUserAccessEmail(
                    key,
                    email,
                    nome,
                    companyName,
                    resolvedLoginUrl,
                    setPasswordTokenUrl,
                    PASSWORD_RESET_TOKEN_TTL_HOURS
            );

            event.setStatus(OnboardingEventStatus.DONE.name());
            event.setProcessedAt(Instant.now());
            eventRepo.save(event);

            log.info("[Onboarding:SendAccessEmail] Completed – email={} outboxId={}", email, outbox.getId());

            return new SendAccessEmailResponse(
                    EmailStatus.SENT.name().equals(outbox.getStatus()),
                    outbox.getProviderId() != null ? outbox.getProviderId() : ""
            );
        } catch (Exception e) {
            event.setStatus(OnboardingEventStatus.ERROR.name());
            event.setErrorMessage(e.getMessage());
            event.setProcessedAt(Instant.now());
            eventRepo.save(event);
            throw e;
        }
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    private JpaOnboardingEventEntity createEvent(String idempotencyKey, String eventType, String payloadJson) {
        JpaOnboardingEventEntity event = new JpaOnboardingEventEntity();
        event.setId(UUID.randomUUID());
        event.setIdempotencyKey(idempotencyKey);
        event.setEventType(eventType);
        event.setPayloadJson(payloadJson != null ? payloadJson : "{}");
        event.setStatus(OnboardingEventStatus.PENDING.name());
        event.setCreatedAt(Instant.now());

        return eventRepo.save(event);
    }

    private JpaOnboardingSubscriptionEntity findOrCreateSubscription(String paymentId, String subscriptionId) {
        if (!subscriptionId.isBlank()) {
            Optional<JpaOnboardingSubscriptionEntity> existing = subscriptionRepo.findByAsaasSubscriptionId(subscriptionId);

            if (existing.isPresent()) {
                return existing.get();
            }
        }

        if (!paymentId.isBlank()) {
            Optional<JpaOnboardingSubscriptionEntity> existing = subscriptionRepo.findByAsaasPaymentId(paymentId);

            if (existing.isPresent()) {
                return existing.get();
            }
        }

        JpaOnboardingSubscriptionEntity subscription = new JpaOnboardingSubscriptionEntity();
        subscription.setId(UUID.randomUUID());
        subscription.setCreatedAt(Instant.now());
        subscription.setAsaasDescriptionSynced(false);

        return subscription;
    }

    private JpaOnboardingSubscriptionEntity findSubscriptionForActivation(String subscriptionId, String paymentId) {
        if (!subscriptionId.isBlank()) {
            Optional<JpaOnboardingSubscriptionEntity> subscription = subscriptionRepo.findByAsaasSubscriptionIdForUpdate(subscriptionId);

            if (subscription.isPresent()) {
                return subscription.get();
            }
        }

        if (!paymentId.isBlank()) {
            Optional<JpaOnboardingSubscriptionEntity> subscription = subscriptionRepo.findByAsaasPaymentIdForUpdate(paymentId);

            if (subscription.isPresent()) {
                return subscription.get();
            }
        }

        return null;
    }

    private JpaUserEntity findPrimaryUser(UUID companyId) {
        List<JpaUserEntity> users = userRepo.findAllByCompanyId(companyId);

        return users.stream()
                .filter(JpaUserEntity::isPrimary)
                .findFirst()
                .orElseGet(() -> users.stream().findFirst().orElse(null));
    }

    private String generatePasswordResetToken(UUID userId) {
        Optional<JpaPasswordResetTokenEntity> existing = passwordTokenRepo.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(userId);

        if (existing.isPresent() && existing.get().getExpiresAt().isAfter(Instant.now())) {
            return existing.get().getToken();
        }

        JpaPasswordResetTokenEntity token = new JpaPasswordResetTokenEntity();
        token.setId(UUID.randomUUID());
        token.setUserId(userId);
        token.setToken(UUID.randomUUID().toString());
        token.setExpiresAt(Instant.now().plusSeconds(PASSWORD_RESET_TOKEN_TTL_HOURS * 3600L));
        token.setUsed(false);
        token.setCreatedAt(Instant.now());

        passwordTokenRepo.save(token);

        log.info("[Onboarding] Password reset token generated for user={}", userId);

        return token.getToken();
    }

    private String generateSetPasswordUrl(UUID userId) {
        String token = generatePasswordResetToken(userId);

        if (setPasswordBaseUrl.isBlank()) {
            return "";
        }

        return setPasswordBaseUrl + "?token=" + token;
    }

    private FirstUserRegisterResponse buildRegisterResponseFromEvent(JpaOnboardingEventEntity event) {
        return new FirstUserRegisterResponse(null, null, false, CompanyStatus.INACTIVE.name());
    }

    private FirstUserActivateResponse buildActivateResponseFromEvent(JpaOnboardingEventEntity event, boolean wasDone) {
        return new FirstUserActivateResponse(false, true, null, null, null);
    }

    private String normalizeCnpj(String cnpj) {
        if (cnpj == null || cnpj.isBlank()) {
            return "";
        }

        return cnpj.trim().replaceAll("\\D", "");
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessException("ONBOARDING_INVALID_EMAIL", "E-mail é obrigatório.");
        }

        String normalized = email.trim().toLowerCase(Locale.ROOT);

        if (!normalized.contains("@")) {
            throw new BusinessException("ONBOARDING_INVALID_EMAIL", "E-mail inválido: " + normalized);
        }

        return normalized;
    }

    private String normalizeWhatsapp(String whatsapp) {
        if (whatsapp == null || whatsapp.isBlank()) {
            return "";
        }

        return whatsapp.trim().replaceAll("\\D", "");
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return null;
        }

        try {
            String trimmed = dateStr.trim();
            return LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length())));
        } catch (Exception e) {
            return null;
        }
    }

    private UUID parseUuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void requireNotBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException("ONBOARDING_VALIDATION", message);
        }
    }

    private String trimOrEmpty(String value) {
        return value != null ? value.trim() : "";
    }

    private String notBlankOr(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }

        return "";
    }
}
