package com.io.appioweb.application.onboarding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.io.appioweb.adapters.persistence.onboarding.EmailOutboxRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.JpaEmailOutboxEntity;
import com.io.appioweb.domain.onboarding.EmailStatus;
import com.io.appioweb.domain.onboarding.EmailTemplateType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing the email outbox.
 * Creates outbox entries and stores the exact template model expected by the email renderer.
 */
@Service
public class EmailOutboxService {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxService.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final EmailOutboxRepositoryJpa emailOutboxRepo;

    public EmailOutboxService(EmailOutboxRepositoryJpa emailOutboxRepo) {
        this.emailOutboxRepo = emailOutboxRepo;
    }

    public Optional<JpaEmailOutboxEntity> findByIdempotencyKey(String idempotencyKey) {
        return emailOutboxRepo.findByIdempotencyKey(idempotencyKey);
    }

    public JpaEmailOutboxEntity createFirstUserAccessEmail(
            String idempotencyKey,
            String toEmail,
            String nome,
            String companyName,
            String loginUrl,
            String setPasswordTokenUrl,
            int expirationHours
    ) {
        Optional<JpaEmailOutboxEntity> existing = emailOutboxRepo.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.info("[EmailOutbox] Email already exists for idempotencyKey={} - returning existing", idempotencyKey);
            return existing.get();
        }

        JpaEmailOutboxEntity outbox = new JpaEmailOutboxEntity();
        outbox.setId(UUID.randomUUID());
        outbox.setTemplate(EmailTemplateType.FIRST_USER_ACCESS.name());
        outbox.setToEmail(toEmail);
        outbox.setStatus(EmailStatus.PENDING.name());
        outbox.setRetryCount(0);
        outbox.setIdempotencyKey(idempotencyKey);
        outbox.setCreatedAt(Instant.now());

        try {
            outbox.setPayloadJson(writeTemplatePayload(
                    nome,
                    companyName,
                    loginUrl,
                    setPasswordTokenUrl,
                    expirationHours
            ));

            String messageContent = buildFirstUserAccessEmailBody(nome, companyName, loginUrl, setPasswordTokenUrl, expirationHours);
            String subject = "Seu acesso ao IO Auto está liberado";

            log.info("[EmailOutbox] Email queued for {} - subject: '{}' - idempotencyKey={}", toEmail, subject, idempotencyKey);
            log.debug("[EmailOutbox] Email body:\n{}", messageContent);
        } catch (Exception e) {
            log.error("[EmailOutbox] Failed to prepare email for {}: {}", toEmail, e.getMessage(), e);
            outbox.setStatus(EmailStatus.ERROR.name());
            outbox.setErrorMessage(e.getMessage());
            outbox.setPayloadJson("{}");
        }

        emailOutboxRepo.save(outbox);
        return outbox;
    }

    public JpaEmailOutboxEntity createPasswordResetEmail(
            String idempotencyKey,
            String toEmail,
            String nome,
            String companyName,
            String loginUrl,
            String setPasswordTokenUrl,
            int expirationHours
    ) {
        Optional<JpaEmailOutboxEntity> existing = emailOutboxRepo.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.info("[EmailOutbox] Password reset email already exists for idempotencyKey={} - returning existing", idempotencyKey);
            return existing.get();
        }

        JpaEmailOutboxEntity outbox = new JpaEmailOutboxEntity();
        outbox.setId(UUID.randomUUID());
        outbox.setTemplate(EmailTemplateType.PASSWORD_RESET.name());
        outbox.setToEmail(toEmail);
        outbox.setStatus(EmailStatus.PENDING.name());
        outbox.setRetryCount(0);
        outbox.setIdempotencyKey(idempotencyKey);
        outbox.setCreatedAt(Instant.now());

        try {
            outbox.setPayloadJson(writeTemplatePayload(
                    nome,
                    companyName,
                    loginUrl,
                    setPasswordTokenUrl,
                    expirationHours
            ));

            String messageContent = buildPasswordResetEmailBody(nome, companyName, loginUrl, setPasswordTokenUrl, expirationHours);
            String subject = "Redefina sua senha do IO Auto";

            log.info("[EmailOutbox] Password reset email queued for {} - subject: '{}' - idempotencyKey={}", toEmail, subject, idempotencyKey);
            log.debug("[EmailOutbox] Password reset body:\n{}", messageContent);
        } catch (Exception e) {
            log.error("[EmailOutbox] Failed to prepare password reset email for {}: {}", toEmail, e.getMessage(), e);
            outbox.setStatus(EmailStatus.ERROR.name());
            outbox.setErrorMessage(e.getMessage());
            outbox.setPayloadJson("{}");
        }

        emailOutboxRepo.save(outbox);
        return outbox;
    }

    public String buildFirstUserAccessEmailBody(
            String nome,
            String companyName,
            String loginUrl,
            String setPasswordTokenUrl,
            int expirationHours
    ) {
        String safeName = nome != null && !nome.isBlank() ? nome.trim() : "Cliente";
        String safeCompanyName = companyName != null && !companyName.isBlank() ? companyName.trim() : "sua empresa";
        String safeLoginUrl = loginUrl != null ? loginUrl.trim() : "";
        String safeSetPasswordUrl = setPasswordTokenUrl != null ? setPasswordTokenUrl.trim() : "";

        StringBuilder sb = new StringBuilder();
        sb.append("Olá, ").append(safeName).append("!\n\n");
        sb.append("Seu acesso à empresa ").append(safeCompanyName).append(" no IO Auto já está liberado.\n\n");

        if (!safeSetPasswordUrl.isBlank()) {
            sb.append("Defina sua senha pelo link abaixo:\n").append(safeSetPasswordUrl).append("\n\n");
            sb.append("Esse link é válido por ").append(expirationHours).append(" horas.\n\n");
        }

        if (!safeLoginUrl.isBlank()) {
            sb.append("Depois disso, você poderá entrar por aqui:\n").append(safeLoginUrl).append("\n\n");
        }

        sb.append("Se você não solicitou esse acesso, ignore este e-mail.\n\n");
        sb.append("Atenciosamente,\nEquipe IO Auto\n");
        return sb.toString();
    }

    public String buildPasswordResetEmailBody(
            String nome,
            String companyName,
            String loginUrl,
            String setPasswordTokenUrl,
            int expirationHours
    ) {
        String safeName = nome != null && !nome.isBlank() ? nome.trim() : "Cliente";
        String safeCompanyName = companyName != null && !companyName.isBlank() ? companyName.trim() : "sua empresa";
        String safeLoginUrl = loginUrl != null ? loginUrl.trim() : "";
        String safeSetPasswordUrl = setPasswordTokenUrl != null ? setPasswordTokenUrl.trim() : "";

        StringBuilder sb = new StringBuilder();
        sb.append("Ola, ").append(safeName).append("!\n\n");
        sb.append("Recebemos uma solicitacao para redefinir sua senha de acesso da empresa ").append(safeCompanyName).append(" no IO Auto.\n\n");

        if (!safeSetPasswordUrl.isBlank()) {
            sb.append("Use o link abaixo para criar uma nova senha:\n").append(safeSetPasswordUrl).append("\n\n");
            sb.append("Esse link e valido por ").append(expirationHours).append(" horas.\n\n");
        }

        if (!safeLoginUrl.isBlank()) {
            sb.append("Depois disso, voce podera entrar por aqui:\n").append(safeLoginUrl).append("\n\n");
        }

        sb.append("Se voce nao solicitou esta redefinicao, ignore este e-mail.\n\n");
        sb.append("Atenciosamente,\nEquipe IO Auto\n");
        return sb.toString();
    }

    private String writeTemplatePayload(
            String nome,
            String companyName,
            String loginUrl,
            String setPasswordTokenUrl,
            int expirationHours
    ) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userName", nome != null && !nome.isBlank() ? nome.trim() : "Cliente");
        payload.put("companyName", companyName != null && !companyName.isBlank() ? companyName.trim() : "sua empresa");
        payload.put("loginUrl", loginUrl != null ? loginUrl.trim() : "");
        payload.put("setPasswordUrl", setPasswordTokenUrl != null ? setPasswordTokenUrl.trim() : "");
        payload.put("expirationHours", expirationHours);
        return OBJECT_MAPPER.writeValueAsString(payload);
    }
}
