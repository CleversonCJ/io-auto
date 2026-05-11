package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.application.auth.dto.AuthTokens;
import com.io.appioweb.domain.auth.entity.User;

import java.util.UUID;

public interface TokenServicePort {
    AuthTokens issueTokens(User user);
    AuthTokens issueImpersonationTokens(User user, UUID actorSuperAdminId, UUID impersonatedTenantId);
    AuthTokens rotateRefresh(String refreshToken);
    void revokeRefresh(String refreshToken);
    void blacklistAccess(String accessToken);
    boolean isAccessBlacklisted(String jti);
}
