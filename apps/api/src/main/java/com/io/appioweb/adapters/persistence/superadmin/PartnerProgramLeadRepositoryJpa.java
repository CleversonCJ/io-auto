package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PartnerProgramLeadRepositoryJpa extends JpaRepository<JpaPartnerProgramLeadEntity, UUID> {
    List<JpaPartnerProgramLeadEntity> findAllByOrderByCreatedAtDesc();
    List<JpaPartnerProgramLeadEntity> findAllByPartnerIdOrderByCreatedAtDesc(UUID partnerId);
}
