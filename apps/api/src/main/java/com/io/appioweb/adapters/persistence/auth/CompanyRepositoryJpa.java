package com.io.appioweb.adapters.persistence.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompanyRepositoryJpa extends JpaRepository<JpaCompanyEntity, UUID> {
    interface CompanyReferenceProjection {
        UUID getId();
        String getName();
    }

    Optional<JpaCompanyEntity> findByEmail(String email);
    Optional<JpaCompanyEntity> findByZapiInstanceId(String zapiInstanceId);
    Optional<JpaCompanyEntity> findByCnpj(String cnpj);

    @Query("select c.name from JpaCompanyEntity c where c.id = :companyId")
    Optional<String> findNameById(@Param("companyId") UUID companyId);

    @Query("select c.id as id, c.name as name from JpaCompanyEntity c")
    List<CompanyReferenceProjection> findAllReferences();

    @Transactional
    @Modifying
    @Query("update JpaCompanyEntity c set c.lastAccessAt = :accessAt, c.updatedAt = :accessAt where c.id = :companyId")
    int touchLastAccess(@Param("companyId") UUID companyId, @Param("accessAt") Instant accessAt);
}
