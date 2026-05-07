package com.io.appioweb.adapters.integrations.mercadolivre;

import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeliOAuthStateStoreTest {

    @Test
    void createPersistsStatePayloadWithTtl() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOperations);

        MeliOAuthStateStore store = new MeliOAuthStateStore(redis);
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        String state = store.create(companyId);

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(anyString(), payloadCaptor.capture(), eq(Duration.ofMinutes(10)));
        assertThat(state).isNotBlank();
        assertThat(payloadCaptor.getValue()).contains(companyId.toString());
        assertThat(payloadCaptor.getValue()).contains("nonce");
    }

    @Test
    void consumeRejectsExpiredState() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("meli:oauth:state:expired-state")).thenReturn("""
                {
                  "companyId": "11111111-1111-1111-1111-111111111111",
                  "nonce": "nonce-123",
                  "codeVerifier": "verifier-1234567890",
                  "issuedAt": "%s"
                }
                """.formatted(Instant.now().minus(Duration.ofMinutes(20))));

        MeliOAuthStateStore store = new MeliOAuthStateStore(redis);

        assertThatThrownBy(() -> store.consume("expired-state"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("expirado");
    }
}
