package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IoAutoIntegrationRepositoryJpa extends JpaRepository<JpaIoAutoIntegrationEntity, UUID> {
    List<JpaIoAutoIntegrationEntity> findAllByCompanyIdOrderByDisplayNameAsc(UUID companyId);
    Optional<JpaIoAutoIntegrationEntity> findByCompanyIdAndProviderKeyIgnoreCase(UUID companyId, String providerKey);
}
