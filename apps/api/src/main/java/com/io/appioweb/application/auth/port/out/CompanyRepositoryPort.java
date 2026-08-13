package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.domain.auth.entity.Company;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompanyRepositoryPort {
    record CompanyReference(UUID id, String name) {
    }

    Optional<Company> findById(UUID id);
    Optional<String> findNameById(UUID id);
    Optional<Company> findByEmail(String email);
    Optional<Company> findByZapiInstanceId(String zapiInstanceId);
    List<Company> findAll();
    List<CompanyReference> findAllReferences();
    boolean isTenantBlocked(UUID companyId);
    void deleteById(UUID id);
    void save(Company company);
    void touchLastAccess(UUID companyId, Instant accessAt);
}
