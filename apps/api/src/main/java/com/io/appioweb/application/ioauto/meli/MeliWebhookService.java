package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliProperties;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliWebhookEventEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAccountRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.MeliWebhookEventRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class MeliWebhookService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final MeliProperties properties;
    private final MeliWebhookEventRepositoryJpa events;
    private final MeliAccountRepositoryJpa accounts;
    private final MeliAdService adService;

    public MeliWebhookService(
            MeliProperties properties,
            MeliWebhookEventRepositoryJpa events,
            MeliAccountRepositoryJpa accounts,
            MeliAdService adService
    ) {
        this.properties = properties;
        this.events = events;
        this.accounts = accounts;
        this.adService = adService;
    }

    @Transactional
    public void registerWebhook(String rawPayload, String providedSecret) {
        validateSecret(providedSecret);
        JsonNode payload = parsePayload(rawPayload);
        JpaMeliWebhookEventEntity entity = new JpaMeliWebhookEventEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(resolveCompanyId(payload.path("user_id").isNumber() ? payload.path("user_id").asLong() : null));
        entity.setUserId(payload.path("user_id").isNumber() ? payload.path("user_id").asLong() : null);
        entity.setTopic(text(payload, "topic"));
        entity.setResource(text(payload, "resource"));
        entity.setApplicationId(payload.path("application_id").isNumber() ? payload.path("application_id").asLong() : null);
        entity.setAttempts(payload.path("attempts").isNumber() ? payload.path("attempts").asInt() : null);
        entity.setSentAt(parseInstant(payload.path("sent").asText("")));
        entity.setReceivedAt(firstNonNull(parseInstant(payload.path("received").asText("")), Instant.now()));
        entity.setPayload(writePayload(payload));
        entity.setProcessed(false);
        events.save(entity);
    }

    @Transactional
    public void processPendingEventsBatch(int batchSize) {
        List<JpaMeliWebhookEventEntity> pending = events.findTop50ByProcessedFalseOrderByReceivedAtAsc().stream()
                .limit(Math.max(1, batchSize))
                .toList();
        for (JpaMeliWebhookEventEntity event : pending) {
            processEvent(event);
        }
    }

    private void processEvent(JpaMeliWebhookEventEntity event) {
        try {
            String topic = safe(event.getTopic()).toLowerCase();
            if ("items".equals(topic)) {
                processItemEvent(event);
            }
            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            event.setError(null);
        } catch (Exception exception) {
            event.setError(exception.getMessage());
        }
        events.save(event);
    }

    private void processItemEvent(JpaMeliWebhookEventEntity event) {
        if (event.getCompanyId() == null) {
            throw new BusinessException("MELI_WEBHOOK_COMPANY_NOT_FOUND", "Nao foi possivel identificar a empresa do webhook Mercado Livre.");
        }
        String resource = safe(event.getResource());
        String itemId = resource.contains("/") ? resource.substring(resource.lastIndexOf("/") + 1) : resource;
        if (itemId.isBlank()) {
            return;
        }
        adService.syncAdByItemId(event.getCompanyId(), itemId);
    }

    private void validateSecret(String providedSecret) {
        String expected = safe(properties.getWebhookSecret());
        if (expected.isBlank()) {
            return;
        }
        if (!expected.equals(safe(providedSecret))) {
            throw new BusinessException("MELI_WEBHOOK_FORBIDDEN", "Webhook Mercado Livre invalido.");
        }
    }

    private UUID resolveCompanyId(Long userId) {
        if (userId == null) {
            return null;
        }
        return accounts.findByMeliUserId(userId).map(account -> account.getCompanyId()).orElse(null);
    }

    private JsonNode parsePayload(String rawPayload) {
        try {
            String source = rawPayload == null || rawPayload.isBlank() ? "{}" : rawPayload;
            return OBJECT_MAPPER.readTree(source);
        } catch (Exception exception) {
            ObjectNode fallback = OBJECT_MAPPER.createObjectNode();
            fallback.put("raw", rawPayload == null ? "" : rawPayload);
            return fallback;
        }
    }

    private String writePayload(JsonNode payload) {
        try {
            return OBJECT_MAPPER.writeValueAsString(payload);
        } catch (Exception exception) {
            return "{\"raw\":\"\"}";
        }
    }

    private Instant parseInstant(String value) {
        try {
            String normalized = safe(value);
            return normalized.isBlank() ? null : Instant.parse(normalized);
        } catch (Exception exception) {
            return null;
        }
    }

    private Instant firstNonNull(Instant... values) {
        for (Instant value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : safe(value.asText(""));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
