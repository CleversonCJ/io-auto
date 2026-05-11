package com.io.appioweb.adapters.security;

import com.io.appioweb.adapters.cache.RedisTokenStore;
import com.io.appioweb.application.auth.dto.AuthTokens;
import com.io.appioweb.application.auth.port.out.TokenServicePort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

public class JwtTokenService implements TokenServicePort {
    private static final Duration IMPERSONATION_ACCESS_TTL = Duration.ofMinutes(15);
    private static final Duration IMPERSONATION_REFRESH_TTL = Duration.ofMinutes(30);

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final RedisTokenStore store;
    private final String issuer;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtTokenService(
            JwtEncoder encoder,
            JwtDecoder decoder,
            RedisTokenStore store,
            String issuer,
            Duration accessTtl,
            Duration refreshTtl
    ) {
        this.encoder = encoder;
        this.decoder = decoder;
        this.store = store;
        this.issuer = issuer;
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
    }

    @Override
    public AuthTokens issueTokens(User user) {
        return issueTokensInternal(user, accessTtl, refreshTtl, false, null, null, "refresh");
    }

    @Override
    public AuthTokens issueImpersonationTokens(User user, UUID actorSuperAdminId, UUID impersonatedTenantId) {
        if (actorSuperAdminId == null || impersonatedTenantId == null) {
            throw new BusinessException("IMPERSONATION_TOKEN_INVALID", "Dados invalidos para emissao de token de impersonacao.");
        }
        return issueTokensInternal(
                user,
                IMPERSONATION_ACCESS_TTL,
                IMPERSONATION_REFRESH_TTL,
                true,
                actorSuperAdminId,
                impersonatedTenantId,
                "impersonation_refresh"
        );
    }

    @Override
    public AuthTokens rotateRefresh(String refreshToken) {
        Jwt jwt = decodeSafe(refreshToken);

        String type = jwt.getClaimAsString("type");
        if (!"refresh".equals(type) && !"impersonation_refresh".equals(type)) {
            throw new BusinessException("AUTH_INVALID", "Refresh invalido");
        }

        String jti = jwt.getId();
        String saved = store.getRefresh(jti);
        if (saved == null) throw new BusinessException("AUTH_INVALID", "Refresh expirado ou revogado");

        store.deleteRefresh(jti);

        UUID userId = UUID.fromString(jwt.getSubject());
        UUID companyId = UUID.fromString(jwt.getClaimAsString("cid"));

        List<String> roles = jwt.getClaimAsStringList("roles");
        User user = new User(
                userId,
                companyId,
                "n/a",
                "n/a",
                "n/a",
                null,
                null,
                null,
                null,
                java.util.Collections.emptySet(),
                null,
                true,
                Instant.now(),
                new HashSet<>(roles == null ? List.of() : roles)
        );

        if ("impersonation_refresh".equals(type)) {
            String actorRaw = jwt.getClaimAsString("actorSuperAdminId");
            String tenantRaw = jwt.getClaimAsString("impersonatedTenantId");
            if (actorRaw == null || tenantRaw == null) {
                throw new BusinessException("AUTH_INVALID", "Refresh de impersonacao invalido");
            }
            return issueImpersonationTokens(user, UUID.fromString(actorRaw), UUID.fromString(tenantRaw));
        }

        return issueTokens(user);
    }

    @Override
    public void revokeRefresh(String refreshToken) {
        Jwt jwt = decodeSafe(refreshToken);
        store.deleteRefresh(jwt.getId());
    }

    @Override
    public void blacklistAccess(String accessToken) {
        Jwt jwt = decodeSafe(accessToken);

        String jti = jwt.getId();
        Instant exp = jwt.getExpiresAt();

        if (jti == null || jti.isBlank() || exp == null) return;

        Duration ttl = Duration.between(Instant.now(), exp);
        if (!ttl.isNegative() && !ttl.isZero()) {
            store.blacklistAccess(jti, ttl);
        }
    }

    @Override
    public boolean isAccessBlacklisted(String jti) {
        return store.isAccessBlacklisted(jti);
    }

    private AuthTokens issueTokensInternal(
            User user,
            Duration accessDuration,
            Duration refreshDuration,
            boolean impersonation,
            UUID actorSuperAdminId,
            UUID impersonatedTenantId,
            String refreshType
    ) {
        Instant now = Instant.now();
        List<String> roles = user.roles() == null ? List.of() : user.roles().stream().toList();

        String accessJti = UUID.randomUUID().toString();
        JwtClaimsSet.Builder accessBuilder = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plus(accessDuration))
                .subject(user.id().toString())
                .id(accessJti)
                .claim("cid", user.companyId().toString())
                .claim("roles", roles);

        String refreshJti = UUID.randomUUID().toString();
        JwtClaimsSet.Builder refreshBuilder = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plus(refreshDuration))
                .subject(user.id().toString())
                .id(refreshJti)
                .claim("cid", user.companyId().toString())
                .claim("type", refreshType)
                .claim("roles", roles);

        if (impersonation) {
            accessBuilder
                    .claim("impersonation", true)
                    .claim("actorSuperAdminId", actorSuperAdminId.toString())
                    .claim("impersonatedTenantId", impersonatedTenantId.toString());

            refreshBuilder
                    .claim("impersonation", true)
                    .claim("actorSuperAdminId", actorSuperAdminId.toString())
                    .claim("impersonatedTenantId", impersonatedTenantId.toString());
        }

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
                .keyId("io-hs256")
                .build();

        String access = encoder.encode(JwtEncoderParameters.from(header, accessBuilder.build())).getTokenValue();
        String refresh = encoder.encode(JwtEncoderParameters.from(header, refreshBuilder.build())).getTokenValue();

        store.storeRefresh(refreshJti, user.id() + "|" + user.companyId(), refreshDuration);

        return new AuthTokens(access, refresh, accessDuration.toSeconds());
    }

    private Jwt decodeSafe(String token) {
        try {
            return decoder.decode(token);
        } catch (Exception e) {
            throw new BusinessException("AUTH_INVALID", "Token invalido");
        }
    }
}
