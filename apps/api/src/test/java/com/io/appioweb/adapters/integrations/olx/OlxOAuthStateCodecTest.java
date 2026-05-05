package com.io.appioweb.adapters.integrations.olx;

import com.io.appioweb.adapters.security.SensitiveDataCrypto;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OlxOAuthStateCodecTest {

    @Test
    void encodeAndDecodeRoundTrip() {
        SensitiveDataCrypto crypto = new SensitiveDataCrypto("olx-state-test-key-123456789");
        Instant now = Instant.parse("2026-05-05T14:00:00Z");
        OlxOAuthStateCodec codec = new OlxOAuthStateCodec(crypto, Clock.fixed(now, ZoneOffset.UTC));
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        String encoded = codec.encode(companyId);
        OlxOAuthStateCodec.StatePayload decoded = codec.decode(encoded);

        assertThat(decoded.companyId()).isEqualTo(companyId);
        assertThat(decoded.nonce()).isNotBlank();
        assertThat(decoded.issuedAt()).isEqualTo(now);
    }

    @Test
    void decodeRejectsExpiredState() {
        SensitiveDataCrypto crypto = new SensitiveDataCrypto("olx-state-test-key-123456789");
        UUID companyId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        OlxOAuthStateCodec issuer = new OlxOAuthStateCodec(
                crypto,
                Clock.fixed(Instant.parse("2026-05-05T13:40:00Z"), ZoneOffset.UTC)
        );
        OlxOAuthStateCodec validator = new OlxOAuthStateCodec(
                crypto,
                Clock.fixed(Instant.parse("2026-05-05T14:00:30Z"), ZoneOffset.UTC)
        );

        String encoded = issuer.encode(companyId);

        assertThatThrownBy(() -> validator.decode(encoded))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("expirado");
    }
}
