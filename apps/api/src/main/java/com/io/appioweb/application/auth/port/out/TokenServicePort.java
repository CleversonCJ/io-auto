package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.application.auth.dto.AuthTokens;
import com.io.appioweb.domain.auth.entity.User;

public interface TokenServicePort {
    AuthTokens issueTokens(User user);
    AuthTokens rotateRefresh(String refreshToken);
    void revokeRefresh(String refreshToken);
    void blacklistAccess(String accessToken);
    boolean isAccessBlacklisted(String jti);
}
