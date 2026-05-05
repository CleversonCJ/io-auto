package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OlxAccountRepositoryJpa extends JpaRepository<JpaOlxAccountEntity, UUID> {
    Optional<JpaOlxAccountEntity> findByCompanyId(UUID companyId);
}
