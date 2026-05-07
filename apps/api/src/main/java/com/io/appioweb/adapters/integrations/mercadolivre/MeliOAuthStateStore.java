package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
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
        payload.put("issuedAt", Instant.now().toString());
        try {
            redis.opsForValue().set(PREFIX + state, OBJECT_MAPPER.writeValueAsString(payload), STATE_TTL);
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
            throw new BusinessException("MELI_OAUTH_STATE_EXPIRED", "State do OAuth Mercado Livre expirado. Reinicie a conexao.");
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(raw);
            UUID companyId = UUID.fromString(root.path("companyId").asText(""));
            String nonce = root.path("nonce").asText("").trim();
            Instant issuedAt = Instant.parse(root.path("issuedAt").asText(""));
            if (nonce.isBlank()) {
                throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre invalido.");
            }
            if (issuedAt.isBefore(Instant.now().minus(STATE_TTL)) || issuedAt.isAfter(Instant.now().plusSeconds(30))) {
                throw new BusinessException("MELI_OAUTH_STATE_EXPIRED", "State do OAuth Mercado Livre expirado. Reinicie a conexao.");
            }
            return new StatePayload(companyId, nonce, issuedAt);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("MELI_OAUTH_STATE_INVALID", "State do OAuth Mercado Livre invalido.");
        }
    }

    public record StatePayload(UUID companyId, String nonce, Instant issuedAt) {
    }
}
