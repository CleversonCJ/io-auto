package com.io.appioweb.adapters.persistence.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface OnboardingEventRepositoryJpa extends JpaRepository<JpaOnboardingEventEntity, UUID> {
    Optional<JpaOnboardingEventEntity> findByIdempotencyKey(String idempotencyKey);
}
