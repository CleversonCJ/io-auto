package com.io.appioweb.adapters.web.auth;

import com.io.appioweb.adapters.persistence.onboarding.JpaPasswordResetTokenEntity;
import com.io.appioweb.adapters.persistence.onboarding.PasswordResetTokenRepositoryJpa;
import com.io.appioweb.adapters.web.auth.request.CompletePasswordSetupHttpRequest;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.PasswordHasherPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@RestController
public class PublicPasswordSetupController {

    private final PasswordResetTokenRepositoryJpa passwordTokens;
    private final UserRepositoryPort users;
    private final CompanyRepositoryPort companies;
    private final PasswordHasherPort hasher;

    public PublicPasswordSetupController(
            PasswordResetTokenRepositoryJpa passwordTokens,
            UserRepositoryPort users,
            CompanyRepositoryPort companies,
            PasswordHasherPort hasher
    ) {
        this.passwordTokens = passwordTokens;
        this.users = users;
        this.companies = companies;
        this.hasher = hasher;
    }

    @GetMapping("/public/password-setup/validate")
    @Transactional(readOnly = true)
    public ResponseEntity<PasswordSetupValidationHttpResponse> validate(@RequestParam("token") String token) {
        JpaPasswordResetTokenEntity passwordToken = resolveToken(token);
        User user = resolveUser(passwordToken.getUserId());
        String companyName = companies.findById(user.companyId())
                .map(company -> company.name())
                .orElse("IO Auto");

        return ResponseEntity.ok(new PasswordSetupValidationHttpResponse(
                true,
                user.fullName(),
                user.email(),
                companyName,
                passwordToken.getExpiresAt(),
                Math.max(1L, ChronoUnit.HOURS.between(Instant.now(), passwordToken.getExpiresAt()))
        ));
    }

    @PostMapping("/public/password-setup/complete")
    @Transactional
    public ResponseEntity<PasswordSetupCompletedHttpResponse> complete(@Valid @RequestBody CompletePasswordSetupHttpRequest request) {
        JpaPasswordResetTokenEntity passwordToken = resolveToken(request.token());
        User user = resolveUser(passwordToken.getUserId());

        User updatedUser = new User(
                user.id(),
                user.companyId(),
                user.email(),
                hasher.hash(request.password()),
                user.fullName(),
                user.profileImageUrl(),
                user.jobTitle(),
                user.birthDate(),
                user.permissionPreset(),
                user.modulePermissions(),
                user.teamId(),
                true,
                user.createdAt(),
                user.roles()
        );

        users.save(updatedUser);
        passwordToken.setUsed(true);
        passwordTokens.save(passwordToken);

        return ResponseEntity.ok(new PasswordSetupCompletedHttpResponse(
                true,
                "Senha definida com sucesso. Agora voce ja pode entrar no IO Auto."
        ));
    }

    private JpaPasswordResetTokenEntity resolveToken(String rawToken) {
        String token = rawToken == null ? "" : rawToken.trim();
        if (token.isBlank()) {
            throw new BusinessException("PASSWORD_SETUP_INVALID_TOKEN", "Token de definicao de senha invalido.");
        }

        JpaPasswordResetTokenEntity entity = passwordTokens.findByToken(token)
                .orElseThrow(() -> new BusinessException("PASSWORD_SETUP_INVALID_TOKEN", "Token de definicao de senha invalido."));

        if (entity.isUsed()) {
            throw new BusinessException("PASSWORD_SETUP_USED_TOKEN", "Este link de definicao de senha ja foi utilizado.");
        }

        if (entity.getExpiresAt() == null || entity.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("PASSWORD_SETUP_EXPIRED_TOKEN", "Este link de definicao de senha expirou.");
        }

        return entity;
    }

    private User resolveUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new BusinessException("PASSWORD_SETUP_USER_NOT_FOUND", "Usuario nao encontrado para este link."));
    }

    public record PasswordSetupValidationHttpResponse(
            boolean valid,
            String userName,
            String email,
            String companyName,
            Instant expiresAt,
            long remainingHours
    ) {
    }

    public record PasswordSetupCompletedHttpResponse(
            boolean success,
            String message
    ) {
    }
}
