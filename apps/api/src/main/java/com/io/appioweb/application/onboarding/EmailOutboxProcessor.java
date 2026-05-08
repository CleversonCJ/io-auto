package com.io.appioweb.application.onboarding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.io.appioweb.adapters.persistence.onboarding.EmailOutboxRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.JpaEmailOutboxEntity;
import com.io.appioweb.domain.onboarding.EmailStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class EmailOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxProcessor.class);
    private static final int MAX_RETRIES = 3;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final EmailOutboxRepositoryJpa outboxRepository;
    private final EmailSenderService emailSenderService;

    public EmailOutboxProcessor(
            EmailOutboxRepositoryJpa outboxRepository,
            EmailSenderService emailSenderService
    ) {
        this.outboxRepository = outboxRepository;
        this.emailSenderService = emailSenderService;
    }

    @Scheduled(fixedDelay = 30000) // Every 30 seconds
    @Transactional
    public void processPendingEmails() {
        List<JpaEmailOutboxEntity> pendingEmails = outboxRepository.findByStatusOrderByCreatedAtAsc(EmailStatus.PENDING.name());

        if (pendingEmails.isEmpty()) {
            return;
        }

        log.info("Found {} pending emails in outbox to process", pendingEmails.size());

        for (JpaEmailOutboxEntity email : pendingEmails) {
            try {
                processEmail(email);
            } catch (Exception e) {
                log.error("Error processing email ID: {}", email.getId(), e);
                handleFailure(email, e);
            }
        }
    }

    private void processEmail(JpaEmailOutboxEntity email) throws Exception {
        Map<String, Object> model = OBJECT_MAPPER.readValue(
                email.getPayloadJson(), 
                new TypeReference<Map<String, Object>>() {}
        );

        String subject = getSubjectForTemplate(email.getTemplate());

        emailSenderService.sendHtmlEmail(
                email.getToEmail(),
                subject,
                email.getTemplate(),
                model
        );

        email.setStatus(EmailStatus.SENT.name());
        email.setSentAt(Instant.now());
        outboxRepository.save(email);
    }

    private void handleFailure(JpaEmailOutboxEntity email, Exception e) {
        int retries = email.getRetryCount() + 1;
        email.setRetryCount(retries);
        email.setErrorMessage(e.getMessage());

        if (retries >= MAX_RETRIES) {
            email.setStatus(EmailStatus.ERROR.name());
            log.error("Email ID {} reached max retries and is now ERROR", email.getId());
        }

        outboxRepository.save(email);
    }

    private String getSubjectForTemplate(String template) {
        String normalized = template == null ? "" : template.trim().toLowerCase(java.util.Locale.ROOT).replace('_', '-');

        return switch (normalized) {
            case "first-user-access" -> "Bem-vindo ao IO Connect! Dados de Acesso";
            default -> "Notificação IO Connect";
        };
    }
}
