package com.io.appioweb.adapters.persistence.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepositoryJpa extends JpaRepository<JpaPasswordResetTokenEntity, UUID> {
    Optional<JpaPasswordResetTokenEntity> findByToken(String token);
    Optional<JpaPasswordResetTokenEntity> findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(UUID userId);
}
