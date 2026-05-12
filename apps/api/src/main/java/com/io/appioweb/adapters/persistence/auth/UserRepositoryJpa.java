package com.io.appioweb.adapters.persistence.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepositoryJpa extends JpaRepository<JpaUserEntity, UUID> {
    Optional<JpaUserEntity> findByCompanyIdAndEmail(UUID companyId, String email);
    List<JpaUserEntity> findAllByEmail(String email);
    List<JpaUserEntity> findAllByCompanyId(UUID companyId);
    Optional<JpaUserEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    long countByCompanyIdAndActiveTrue(UUID companyId);
    long countByCompanyIdAndTeamId(UUID companyId, UUID teamId);
    void deleteByCompanyId(UUID companyId);
}
