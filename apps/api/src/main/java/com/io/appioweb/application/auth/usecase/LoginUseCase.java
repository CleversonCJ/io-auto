package com.io.appioweb.application.auth.usecase;

import com.io.appioweb.application.auth.dto.AuthTokens;
import com.io.appioweb.application.auth.dto.LoginCommand;
import com.io.appioweb.application.auth.port.in.AuthUseCase;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.PasswordHasherPort;
import com.io.appioweb.application.auth.port.out.TokenServicePort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

public class LoginUseCase implements AuthUseCase {
    private static final Logger log = LoggerFactory.getLogger(LoginUseCase.class);

    private final UserRepositoryPort users;
    private final CompanyRepositoryPort companies;
    private final PasswordHasherPort hasher;
    private final TokenServicePort tokens;

    public LoginUseCase(UserRepositoryPort users, CompanyRepositoryPort companies, PasswordHasherPort hasher, TokenServicePort tokens) {
        this.users = users;
        this.companies = companies;
        this.hasher = hasher;
        this.tokens = tokens;
    }

    @Override
    public AuthTokens login(LoginCommand command) {
        String normalizedEmail = command.email() == null ? null : command.email().trim().toLowerCase();

        // Multiempresa minimo: se existir email em apenas um tenant, loga.
        Optional<User> opt = users.findByEmailGlobal(normalizedEmail);
        if (opt.isEmpty()) {
            log.warn("Login failed: user not found for email={}", normalizedEmail);
            throw new BusinessException("AUTH_INVALID", "Credenciais invalidas");
        }

        User user = opt.get();
        if (!user.isActive()) {
            log.warn("Login failed: inactive user id={} email={}", user.id(), user.email());
            throw new BusinessException("AUTH_INACTIVE", "Usuario inativo");
        }

        if (companies.isTenantBlocked(user.companyId())) {
            log.warn("Login blocked: tenant blocked companyId={} userId={} email={}", user.companyId(), user.id(), user.email());
            throw new BusinessException(
                    "TENANT_BLOCKED",
                    "A conta da sua empresa foi bloqueada, para saber mais entre em contato conosco via suporte."
            );
        }

        boolean matches = hasher.matches(command.password(), user.passwordHash());
        log.info(
                "Login check: requestedEmail={} resolvedUserId={} resolvedEmail={} active={} rawPasswordLength={} hashLength={} hashPrefix={} bcryptMatches={}",
                normalizedEmail,
                user.id(),
                user.email(),
                user.isActive(),
                command.password() == null ? null : command.password().length(),
                user.passwordHash() == null ? null : user.passwordHash().length(),
                hashPrefix(user.passwordHash()),
                matches
        );

        if (!matches) {
            throw new BusinessException("AUTH_INVALID", "Credenciais invalidas");
        }

        companies.touchLastAccess(user.companyId(), java.time.Instant.now());
        return tokens.issueTokens(user);
    }

    @Override
    public void logout(String accessToken, String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) tokens.revokeRefresh(refreshToken);
        if (accessToken != null && !accessToken.isBlank()) tokens.blacklistAccess(accessToken);
    }

    @Override
    public AuthTokens refresh(String refreshToken) {
        return tokens.rotateRefresh(refreshToken);
    }

    private String hashPrefix(String hash) {
        if (hash == null || hash.isBlank()) return "<empty>";
        return hash.length() <= 7 ? hash : hash.substring(0, 7);
    }
}
