package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PartnerProgramPartnerRepositoryJpa extends JpaRepository<JpaPartnerProgramPartnerEntity, UUID> {
    List<JpaPartnerProgramPartnerEntity> findAllByOrderByCreatedAtDesc();
    Optional<JpaPartnerProgramPartnerEntity> findByReferenceCodeIgnoreCase(String referenceCode);
    boolean existsByReferenceCodeIgnoreCase(String referenceCode);
}
