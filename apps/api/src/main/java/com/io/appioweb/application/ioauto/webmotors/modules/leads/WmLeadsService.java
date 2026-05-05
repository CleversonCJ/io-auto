package com.io.appioweb.application.ioauto.webmotors.modules.leads;

import com.io.appioweb.adapters.integrations.webmotors.rest.WebmotorsLeadsApiClient;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsCallbackEventEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsLeadEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsSyncLogEntity;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsCallbackEventRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsLeadRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsSyncLogRepositoryJpa;
import com.io.appioweb.application.ioauto.webmotors.modules.auth.WmAuthService;
import com.io.appioweb.application.ioauto.webmotors.modules.tenant.WmTenantCredentialsService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsLeadPayload;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class WmLeadsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WmTenantCredentialsService tenantCredentialsService;
    private final WmAuthService authService;
    private final WebmotorsLeadRepositoryJpa leadRepository;
    private final WebmotorsCallbackEventRepositoryJpa callbackEventRepository;
    private final WebmotorsAdRepositoryJpa adRepository;
    private final WebmotorsSyncLogRepositoryJpa logRepository;
    private final WebmotorsLeadsApiClient leadsApiClient;

    public WmLeadsService(
            WmTenantCredentialsService tenantCredentialsService,
            WmAuthService authService,
            WebmotorsLeadRepositoryJpa leadRepository,
            WebmotorsCallbackEventRepositoryJpa callbackEventRepository,
            WebmotorsAdRepositoryJpa adRepository,
            WebmotorsSyncLogRepositoryJpa logRepository,
            WebmotorsLeadsApiClient leadsApiClient
    ) {
        this.tenantCredentialsService = tenantCredentialsService;
        this.authService = authService;
        this.leadRepository = leadRepository;
        this.callbackEventRepository = callbackEventRepository;
        this.adRepository = adRepository;
        this.logRepository = logRepository;
        this.leadsApiClient = leadsApiClient;
    }

    @Transactional(readOnly = true)
    public List<JpaWebmotorsLeadEntity> listLeads(UUID companyId) {
        return leadRepository.findTop100ByCompanyIdOrderByReceivedAtDesc(companyId);
    }

    @Transactional
    public List<JpaWebmotorsLeadEntity> pullLeads(UUID companyId, String storeKey, String since) {
        WebmotorsCredentialSnapshot credentials = tenantCredentialsService.getOrCreate(companyId, normalizeStoreKey(storeKey));
        if (!credentials.featureFlags().restLeadsEnabled() || !credentials.featureFlags().leadPullEnabled()) {
            throw new BusinessException("WEBMOTORS_LEAD_PULL_DISABLED", "A recuperacao complementar de leads da Webmotors esta desativada para esta loja.");
        }
        WebmotorsTransportResult<WebmotorsRestAccessToken> tokenTransport = authService.issueAccessToken(credentials);
        logRest(companyId, "token", tokenTransport.statusCode(), tokenTransport.sanitizedRequest(), tokenTransport.sanitizedResponse());
        WebmotorsTransportResult<List<WebmotorsLeadPayload>> leadsTransport = leadsApiClient.fetchLeads(credentials, tokenTransport.payload(), since);
        logRest(companyId, "leads-pull", leadsTransport.statusCode(), leadsTransport.sanitizedRequest(), leadsTransport.sanitizedResponse());
        List<JpaWebmotorsLeadEntity> saved = new ArrayList<>();
        for (WebmotorsLeadPayload lead : leadsTransport.payload()) {
            saved.add(persistLead(companyId, normalizeStoreKey(storeKey), "PULL", lead));
        }
        tenantCredentialsService.markLeadPull(companyId, normalizeStoreKey(storeKey), Instant.now(), null);
        return saved;
    }

    @Transactional
    public JpaWebmotorsLeadEntity processCallback(UUID companyId, String storeKey, Map<String, String> headers, String payloadJson) {
        WebmotorsCredentialSnapshot credentials = tenantCredentialsService.getOrCreate(companyId, normalizeStoreKey(storeKey));
        if (!credentials.featureFlags().callbackEnabled()) {
            throw new BusinessException("WEBMOTORS_CALLBACK_DISABLED", "O callback de leads da Webmotors esta desativado para esta loja.");
        }
        validateCallbackSecret(credentials, headers);
        String payloadHash = sha256(payloadJson);
        JpaWebmotorsCallbackEventEntity existingEvent = callbackEventRepository.findByPayloadHash(payloadHash).orElse(null);
        if (existingEvent != null) {
            return leadRepository.findTop100ByCompanyIdOrderByReceivedAtDesc(companyId).stream().findFirst().orElse(null);
        }

        JpaWebmotorsCallbackEventEntity event = new JpaWebmotorsCallbackEventEntity();
        event.setId(UUID.randomUUID());
        event.setCompanyId(companyId);
        event.setStoreKey(normalizeStoreKey(storeKey));
        event.setPayloadHash(payloadHash);
        event.setHeadersJson(writeJson(new LinkedHashMap<>(headers)));
        event.setPayloadJson(payloadJson);
        event.setStatus("RECEIVED");
        event.setCreatedAt(Instant.now());
        callbackEventRepository.save(event);

        WebmotorsLeadPayload payload = parseLeadPayload(payloadJson);
        JpaWebmotorsLeadEntity lead = persistLead(companyId, normalizeStoreKey(storeKey), "CALLBACK", payload);
        event.setExternalEventId(payload.externalLeadId());
        event.setStatus("PROCESSED");
        event.setProcessedAt(Instant.now());
        callbackEventRepository.save(event);
        return lead;
    }

    private JpaWebmotorsLeadEntity persistLead(UUID companyId, String storeKey, String receivedVia, WebmotorsLeadPayload payload) {
        String dedupeKey = buildDedupeKey(payload);
        JpaWebmotorsLeadEntity existing = leadRepository.findByCompanyIdAndDedupeKey(companyId, dedupeKey).orElse(null);
        if (existing != null) {
            return existing;
        }
        JpaWebmotorsAdEntity ad = safe(payload.remoteAdCode()).isBlank() ? null : adRepository.findByCompanyIdAndRemoteAdCode(companyId, payload.remoteAdCode()).orElse(null);
        Instant now = Instant.now();
        JpaWebmotorsLeadEntity entity = new JpaWebmotorsLeadEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setStoreKey(storeKey);
        entity.setExternalLeadId(nullable(payload.externalLeadId()));
        entity.setVehicleId(ad == null ? null : ad.getVehicleId());
        entity.setWebmotorsAdId(ad == null ? null : ad.getId());
        entity.setCustomerName(nullable(payload.customerName()));
        entity.setCustomerEmail(nullable(payload.customerEmail()));
        entity.setCustomerPhone(nullable(payload.customerPhone()));
        entity.setMessage(nullable(payload.message()));
        entity.setSource("WEBMOTORS");
        entity.setReceivedVia(receivedVia);
        entity.setPayloadJson(payload.rawPayloadJson());
        entity.setDedupeKey(dedupeKey);
        entity.setReceivedAt(now);
        entity.setProcessedAt(now);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return leadRepository.save(entity);
    }

    private WebmotorsLeadPayload parseLeadPayload(String payloadJson) {
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payloadJson);
            JsonNode lead = root.has("lead") ? root.path("lead") : root;
            return new WebmotorsLeadPayload(
                    firstNonBlank(lead, "externalLeadId", "leadId", "id"),
                    firstNonBlank(lead, "remoteAdCode", "codigoAnuncio", "listingId"),
                    firstNonBlank(lead, "customerName", "nome", "name"),
                    firstNonBlank(lead, "customerEmail", "email"),
                    firstNonBlank(lead, "customerPhone", "telefone", "phone"),
                    firstNonBlank(lead, "message", "mensagem", "observacao"),
                    payloadJson
            );
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_LEAD_PAYLOAD_INVALID", "O payload de lead da Webmotors e invalido.");
        }
    }

    private void validateCallbackSecret(WebmotorsCredentialSnapshot credentials, Map<String, String> headers) {
        String configured = safe(credentials.callbackSecret());
        if (configured.isBlank()) {
            return;
        }
        String provided = firstNonBlank(
                headers.getOrDefault("x-webmotors-callback-secret", ""),
                headers.getOrDefault("X-Webmotors-Callback-Secret", ""),
                normalizeAuthorization(headers.getOrDefault("authorization", "")),
                normalizeAuthorization(headers.getOrDefault("Authorization", ""))
        );
        if (!configured.equals(provided)) {
            throw new BusinessException("WEBMOTORS_CALLBACK_UNAUTHORIZED", "O callback de leads da Webmotors foi rejeitado por segredo invalido.");
        }
    }

    private void logRest(UUID companyId, String operation, int statusCode, String requestPayload, String responsePayload) {
        if (safe(requestPayload).isBlank() == false) {
            saveLog(companyId, "REST", "REQUEST", operation, null, requestPayload);
        }
        saveLog(companyId, "REST", "RESPONSE", operation, statusCode, responsePayload);
    }

    private void saveLog(UUID companyId, String channel, String direction, String operation, Integer statusCode, String payload) {
        JpaWebmotorsSyncLogEntity log = new JpaWebmotorsSyncLogEntity();
        log.setId(UUID.randomUUID());
        log.setCompanyId(companyId);
        log.setChannel(channel);
        log.setDirection(direction);
        log.setOperation(operation);
        log.setStatusCode(statusCode);
        log.setSanitizedPayload(nullable(payload));
        log.setCreatedAt(Instant.now());
        logRepository.save(log);
    }

    private String buildDedupeKey(WebmotorsLeadPayload payload) {
        return sha256(firstNonBlank(payload.externalLeadId(), payload.customerPhone(), payload.customerEmail(), payload.rawPayloadJson()));
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(safe(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder buffer = new StringBuilder();
            for (byte item : digest) buffer.append(String.format("%02x", item));
            return buffer.toString();
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_HASH_FAILED", "Nao foi possivel calcular a assinatura do lead da Webmotors.");
        }
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_JSON_SERIALIZATION_FAILED", "Nao foi possivel serializar os dados da Webmotors.");
        }
    }

    private String normalizeAuthorization(String raw) {
        String value = safe(raw);
        if (value.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
            return value.substring(7).trim();
        }
        return value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (safe(value).isBlank() == false) {
                return value.trim();
            }
        }
        return "";
    }

    private String firstNonBlank(JsonNode node, String... names) {
        for (String name : names) {
            String value = safe(node.path(name).asText(""));
            if (value.isBlank() == false) {
                return value;
            }
        }
        return "";
    }

    private String normalizeStoreKey(String storeKey) {
        String normalized = safe(storeKey).toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? "default" : normalized;
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
