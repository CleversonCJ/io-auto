package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.domain.auth.entity.Company;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompanyRepositoryPort {
    Optional<Company> findById(UUID id);
    Optional<Company> findByEmail(String email);
    Optional<Company> findByZapiInstanceId(String zapiInstanceId);
    List<Company> findAll();
    void deleteById(UUID id);
    void save(Company company);
}
