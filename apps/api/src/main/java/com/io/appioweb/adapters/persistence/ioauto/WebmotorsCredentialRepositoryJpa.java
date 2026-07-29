package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WebmotorsCredentialRepositoryJpa extends JpaRepository<JpaWebmotorsCredentialEntity, UUID> {
    Optional<JpaWebmotorsCredentialEntity> findByCompanyIdAndStoreKey(UUID companyId, String storeKey);
    void deleteAllByCompanyId(UUID companyId);
}
