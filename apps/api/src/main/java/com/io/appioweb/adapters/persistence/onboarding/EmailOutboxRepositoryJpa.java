package com.io.appioweb.adapters.persistence.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailOutboxRepositoryJpa extends JpaRepository<JpaEmailOutboxEntity, UUID> {
    Optional<JpaEmailOutboxEntity> findByIdempotencyKey(String idempotencyKey);
    List<JpaEmailOutboxEntity> findByStatusOrderByCreatedAtAsc(String status);
}
