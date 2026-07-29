package com.io.appioweb.adapters.security;

import com.io.appioweb.adapters.cache.RedisTokenStore;
import com.io.appioweb.application.auth.dto.AuthTokens;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtTokenServiceTest {

    private static final UUID USER_ID = UUID.fromString("f8adee9e-d389-4364-88ac-93c6e8d6bd1e");
    private static final UUID COMPANY_ID = UUID.fromString("84e90e8d-7d1c-4232-b31b-2696f96ff6ea");
    private static final Duration ACCESS_TTL = Duration.ofMinutes(15);
    private static final Duration REFRESH_TTL = Duration.ofDays(30);

    @Mock
    private JwtEncoder encoder;

    @Mock
    private JwtDecoder decoder;

    @Mock
    private RedisTokenStore store;

    @Test
    void returnsTheSameRotatedTokensToAConcurrentRefreshRequest() {
        when(decoder.decode("old-refresh")).thenReturn(oldRefreshJwt());
        when(store.consumeRefresh("old-refresh-jti")).thenReturn(null);
        when(store.getRefreshRotation("old-refresh-jti")).thenReturn(
                new RedisTokenStore.RefreshRotation("shared-access", "shared-refresh", 900)
        );

        AuthTokens result = service().rotateRefresh("old-refresh");

        assertEquals("shared-access", result.accessToken());
        assertEquals("shared-refresh", result.refreshToken());
        assertEquals(900, result.accessExpiresInSeconds());
        verify(encoder, never()).encode(any(JwtEncoderParameters.class));
    }

    @Test
    void consumesTheOldRefreshAndCachesTheRotationForConcurrentRequests() {
        when(decoder.decode("old-refresh")).thenReturn(oldRefreshJwt());
        when(store.consumeRefresh("old-refresh-jti")).thenReturn(USER_ID + "|" + COMPANY_ID);
        when(encoder.encode(any(JwtEncoderParameters.class))).thenReturn(
                encodedJwt("new-access"),
                encodedJwt("new-refresh")
        );

        AuthTokens result = service().rotateRefresh("old-refresh");

        assertEquals("new-access", result.accessToken());
        assertEquals("new-refresh", result.refreshToken());
        assertEquals(ACCESS_TTL.toSeconds(), result.accessExpiresInSeconds());
        verify(store).storeRefresh(anyString(), eq(USER_ID + "|" + COMPANY_ID), eq(REFRESH_TTL));
        verify(store).storeRefreshRotation(
                eq("old-refresh-jti"),
                eq("new-access"),
                eq("new-refresh"),
                eq(ACCESS_TTL.toSeconds()),
                eq(Duration.ofSeconds(5))
        );
    }

    private JwtTokenService service() {
        return new JwtTokenService(encoder, decoder, store, "app-io-web", ACCESS_TTL, REFRESH_TTL);
    }

    private Jwt oldRefreshJwt() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("old-refresh")
                .header("alg", "HS256")
                .issuer("app-io-web")
                .issuedAt(now.minusSeconds(30))
                .expiresAt(now.plus(REFRESH_TTL))
                .subject(USER_ID.toString())
                .jti("old-refresh-jti")
                .claim("cid", COMPANY_ID.toString())
                .claim("type", "refresh")
                .claim("roles", List.of("ADMIN"))
                .build();
    }

    private Jwt encodedJwt(String tokenValue) {
        return Jwt.withTokenValue(tokenValue)
                .header("alg", "HS256")
                .claim("token", tokenValue)
                .build();
    }
}
