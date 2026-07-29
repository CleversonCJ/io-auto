package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MeliAccountRepositoryJpa extends JpaRepository<JpaMeliAccountEntity, UUID> {
    Optional<JpaMeliAccountEntity> findByCompanyId(UUID companyId);
    Optional<JpaMeliAccountEntity> findByMeliUserId(Long meliUserId);
    void deleteAllByCompanyId(UUID companyId);
}
