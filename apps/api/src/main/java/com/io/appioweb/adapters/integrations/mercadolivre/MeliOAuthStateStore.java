package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
public class MeliOAuthStateStore {

    private static final Logger log = LoggerFactory.getLogger(MeliOAuthStateStore.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final String PREFIX = "meli:oauth:state:";

    private final StringRedisTemplate redis;

    public MeliOAuthStateStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public String create(UUID companyId) {
        if (companyId == null) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "Nao foi possivel iniciar a conexao Mercado Livre.");
        }
        String state = UUID.randomUUID().toString();
        ObjectNode payload = OBJECT_MAPPER.createObjectNode();
        payload.put("companyId", companyId.toString());
        payload.put("nonce", UUID.randomUUID().toString());
        payload.put("codeVerifier", generateCodeVerifier());
        payload.put("issuedAt", Instant.now().toString());
        try {
            redis.opsForValue().set(PREFIX + state, OBJECT_MAPPER.writeValueAsString(payload), STATE_TTL);
            log.info("MELI OAuth state created companyId={} state={} ttlMinutes={}", companyId, shorten(state), STATE_TTL.toMinutes());
        } catch (Exception exception) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "Nao foi possivel iniciar a conexao Mercado Livre.");
        }
        return state;
    }

    public StatePayload consume(String state) {
        String normalized = state == null ? "" : state.trim();
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre ausente.");
        }
        String key = PREFIX + normalized;
        String raw = redis.opsForValue().get(key);
        redis.delete(key);
        if (raw == null || raw.isBlank()) {
            log.warn("MELI OAuth state missing or expired state={}", shorten(normalized));
            throw new BusinessException("MELI_OAUTH_STATE_EXPIRED", "State do OAuth Mercado Livre expirado. Reinicie a conexao.");
        }
        return parseState(normalized, raw, "consumed");
    }

    public StatePayload consumeForReadOnly(String state) {
        String normalized = state == null ? "" : state.trim();
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre ausente.");
        }
        String raw = redis.opsForValue().get(PREFIX + normalized);
        if (raw == null || raw.isBlank()) {
            log.warn("MELI OAuth state missing or expired during read-only access state={}", shorten(normalized));
            throw new BusinessException("MELI_OAUTH_STATE_EXPIRED", "State do OAuth Mercado Livre expirado. Reinicie a conexao.");
        }
        return parseState(normalized, raw, "loaded");
    }

    private StatePayload parseState(String normalized, String raw, String action) {
        try {
            JsonNode root = OBJECT_MAPPER.readTree(raw);
            UUID companyId = UUID.fromString(root.path("companyId").asText(""));
            String nonce = root.path("nonce").asText("").trim();
            String codeVerifier = root.path("codeVerifier").asText("").trim();
            Instant issuedAt = Instant.parse(root.path("issuedAt").asText(""));
            if (nonce.isBlank() || codeVerifier.isBlank()) {
                throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre invalido.");
            }
            if (issuedAt.isBefore(Instant.now().minus(STATE_TTL)) || issuedAt.isAfter(Instant.now().plusSeconds(30))) {
                log.warn("MELI OAuth state rejected by timestamp companyId={} state={} issuedAt={}", companyId, shorten(normalized), issuedAt);
                throw new BusinessException("MELI_OAUTH_STATE_EXPIRED", "State do OAuth Mercado Livre expirado. Reinicie a conexao.");
            }
            log.info("MELI OAuth state {} companyId={} state={} issuedAt={}", action, companyId, shorten(normalized), issuedAt);
            return new StatePayload(companyId, nonce, codeVerifier, issuedAt);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre invalido.");
        }
    }

    private String shorten(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() <= 8) {
            return normalized;
        }
        return normalized.substring(0, 8) + "...";
    }

    private String generateCodeVerifier() {
        byte[] bytes = new byte[48];
        new java.security.SecureRandom().nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record StatePayload(UUID companyId, String nonce, String codeVerifier, Instant issuedAt) {
    }
}
