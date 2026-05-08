package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IoAutoSignupIntentRepositoryJpa extends JpaRepository<JpaIoAutoSignupIntentEntity, UUID> {
    Optional<JpaIoAutoSignupIntentEntity> findByCheckoutSessionId(String checkoutSessionId);
    Optional<JpaIoAutoSignupIntentEntity> findTopByEmailOrderByCreatedAtDesc(String email);
}
