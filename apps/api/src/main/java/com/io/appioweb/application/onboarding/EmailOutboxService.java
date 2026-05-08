package com.io.appioweb.application.onboarding;

import com.io.appioweb.adapters.persistence.onboarding.EmailOutboxRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.JpaEmailOutboxEntity;
import com.io.appioweb.domain.onboarding.EmailStatus;
import com.io.appioweb.domain.onboarding.EmailTemplateType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing the email outbox.
 * Creates outbox entries and (when an email sender is available) sends them inline.
 * If no email sender is configured, entries remain PENDING for a worker to pick up.
 */
@Service
public class EmailOutboxService {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxService.class);

    private final EmailOutboxRepositoryJpa emailOutboxRepo;

    public EmailOutboxService(EmailOutboxRepositoryJpa emailOutboxRepo) {
        this.emailOutboxRepo = emailOutboxRepo;
    }

    /**
     * Checks if an email with this idempotency key was already sent or queued.
     */
    public Optional<JpaEmailOutboxEntity> findByIdempotencyKey(String idempotencyKey) {
        return emailOutboxRepo.findByIdempotencyKey(idempotencyKey);
    }

    /**
     * Creates and optionally sends an email for first-user access.
     *
     * @return the outbox entity (with status SENT or PENDING)
     */
    public JpaEmailOutboxEntity createFirstUserAccessEmail(
            String idempotencyKey,
            String toEmail,
            String nome,
            String loginUrl,
            String setPasswordTokenUrl,
            String payloadJson
    ) {
        // Check idempotency
        Optional<JpaEmailOutboxEntity> existing = emailOutboxRepo.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.info("[EmailOutbox] Email already exists for idempotencyKey={} – returning existing", idempotencyKey);
            return existing.get();
        }

        JpaEmailOutboxEntity outbox = new JpaEmailOutboxEntity();
        outbox.setId(UUID.randomUUID());
        outbox.setTemplate(EmailTemplateType.FIRST_USER_ACCESS.name());
        outbox.setToEmail(toEmail);
        outbox.setPayloadJson(payloadJson);
        outbox.setStatus(EmailStatus.PENDING.name());
        outbox.setRetryCount(0);
        outbox.setIdempotencyKey(idempotencyKey);
        outbox.setCreatedAt(Instant.now());

        // Try to send inline (best effort)
        try {
            String messageContent = buildFirstUserAccessEmailBody(nome, loginUrl, setPasswordTokenUrl);
            String subject = "Seu acesso ao IO Connect está liberado";

            // TODO: integrate with actual email provider (SES, SMTP, etc.)
            // For now, log the email content and mark as PENDING for worker processing
            log.info("[EmailOutbox] Email queued for {} – subject: '{}' – idempotencyKey={}", toEmail, subject, idempotencyKey);
            log.debug("[EmailOutbox] Email body:\n{}", messageContent);

            // If a real mail sender were available:
            // mailSender.send(toEmail, subject, messageContent);
            // outbox.setStatus(EmailStatus.SENT.name());
            // outbox.setSentAt(Instant.now());
            // outbox.setProviderId("provider-msg-id");

            outbox.setStatus(EmailStatus.PENDING.name());
        } catch (Exception e) {
            log.error("[EmailOutbox] Failed to send email to {}: {}", toEmail, e.getMessage(), e);
            outbox.setStatus(EmailStatus.ERROR.name());
            outbox.setErrorMessage(e.getMessage());
        }

        emailOutboxRepo.save(outbox);
        return outbox;
    }

    /**
     * Builds the plain-text email body for first-user access.
     */
    public String buildFirstUserAccessEmailBody(String nome, String loginUrl, String setPasswordTokenUrl) {
        String safeName = nome != null && !nome.isBlank() ? nome.trim() : "Usuário";
        String safeLoginUrl = loginUrl != null ? loginUrl.trim() : "";
        String safeSetPasswordUrl = setPasswordTokenUrl != null ? setPasswordTokenUrl.trim() : "";

        StringBuilder sb = new StringBuilder();
        sb.append("Olá, ").append(safeName).append("!\n\n");
        sb.append("Seu pagamento foi confirmado e o acesso da sua empresa ao IO Connect já está liberado.\n\n");

        if (!safeLoginUrl.isBlank()) {
            sb.append("Acesse:\n").append(safeLoginUrl).append("\n\n");
        }

        if (!safeSetPasswordUrl.isBlank()) {
            sb.append("Para definir sua senha, clique no link abaixo:\n").append(safeSetPasswordUrl).append("\n\n");
        }

        sb.append("Se você não solicitou esse acesso, ignore este e-mail.\n\n");
        sb.append("Atenciosamente,\nEquipe IO Connect\n");
        return sb.toString();
    }
}
