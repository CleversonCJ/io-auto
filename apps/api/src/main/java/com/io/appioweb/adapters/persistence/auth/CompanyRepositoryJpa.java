package com.io.appioweb.adapters.persistence.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CompanyRepositoryJpa extends JpaRepository<JpaCompanyEntity, UUID> {
    Optional<JpaCompanyEntity> findByEmail(String email);
    Optional<JpaCompanyEntity> findByZapiInstanceId(String zapiInstanceId);
    Optional<JpaCompanyEntity> findByCnpj(String cnpj);
}
