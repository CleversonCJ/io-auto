package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TenantAdminLogRepositoryJpa extends JpaRepository<JpaTenantAdminLogEntity, UUID> {
    List<JpaTenantAdminLogEntity> findTop200ByCompanyIdOrderByCreatedAtDesc(UUID companyId);
}
