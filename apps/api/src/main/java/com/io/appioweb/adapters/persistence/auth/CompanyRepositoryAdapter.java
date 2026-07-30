package com.io.appioweb.adapters.persistence.auth;

import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.domain.auth.entity.Company;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public class CompanyRepositoryAdapter implements CompanyRepositoryPort {
    private final CompanyRepositoryJpa jpa;

    public CompanyRepositoryAdapter(CompanyRepositoryJpa jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<Company> findById(java.util.UUID id) {
        return jpa.findById(id).map(entity -> new Company(
                entity.getId(),
                entity.getName(),
                entity.getProfileImageUrl(),
                entity.getEmail(),
                entity.getContractEndDate(),
                entity.getCnpj(),
                entity.getOpenedAt(),
                entity.getWhatsappNumber(),
                entity.getZapiInstanceId(),
                entity.getZapiInstanceToken(),
                entity.getZapiClientToken(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getBusinessHoursWeeklyJson(),
                entity.getPublicStockBannerMode(),
                entity.getPublicStockBannerImagesJson(),
                entity.getCreatedAt()
        ));
    }

    @Override
    public Optional<String> findNameById(java.util.UUID id) {
        return jpa.findNameById(id);
    }

    @Override
    public Optional<Company> findByEmail(String email) {
        return jpa.findByEmail(email.toLowerCase()).map(entity -> new Company(
                entity.getId(),
                entity.getName(),
                entity.getProfileImageUrl(),
                entity.getEmail(),
                entity.getContractEndDate(),
                entity.getCnpj(),
                entity.getOpenedAt(),
                entity.getWhatsappNumber(),
                entity.getZapiInstanceId(),
                entity.getZapiInstanceToken(),
                entity.getZapiClientToken(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getBusinessHoursWeeklyJson(),
                entity.getPublicStockBannerMode(),
                entity.getPublicStockBannerImagesJson(),
                entity.getCreatedAt()
        ));
    }

    @Override
    public Optional<Company> findByZapiInstanceId(String zapiInstanceId) {
        return jpa.findByZapiInstanceId(zapiInstanceId).map(entity -> new Company(
                entity.getId(),
                entity.getName(),
                entity.getProfileImageUrl(),
                entity.getEmail(),
                entity.getContractEndDate(),
                entity.getCnpj(),
                entity.getOpenedAt(),
                entity.getWhatsappNumber(),
                entity.getZapiInstanceId(),
                entity.getZapiInstanceToken(),
                entity.getZapiClientToken(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getBusinessHoursWeeklyJson(),
                entity.getPublicStockBannerMode(),
                entity.getPublicStockBannerImagesJson(),
                entity.getCreatedAt()
        ));
    }

    @Override
    public List<Company> findAll() {
        return jpa.findAll().stream()
                .map(entity -> new Company(
                        entity.getId(),
                        entity.getName(),
                        entity.getProfileImageUrl(),
                        entity.getEmail(),
                        entity.getContractEndDate(),
                        entity.getCnpj(),
                        entity.getOpenedAt(),
                        entity.getWhatsappNumber(),
                        entity.getZapiInstanceId(),
                        entity.getZapiInstanceToken(),
                        entity.getZapiClientToken(),
                        entity.getBusinessHoursStart(),
                        entity.getBusinessHoursEnd(),
                        entity.getBusinessHoursWeeklyJson(),
                        entity.getPublicStockBannerMode(),
                        entity.getPublicStockBannerImagesJson(),
                        entity.getCreatedAt()
                ))
                .toList();
    }

    @Override
    public boolean isTenantBlocked(java.util.UUID companyId) {
        return jpa.findById(companyId)
                .map(entity -> "BLOCKED".equalsIgnoreCase(entity.getStatus()))
                .orElse(false);
    }

    @Override
    public void deleteById(java.util.UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public void save(Company company) {
        JpaCompanyEntity entity = jpa.findById(company.id()).orElseGet(JpaCompanyEntity::new);
        boolean isNew = entity.getId() == null;
        entity.setId(company.id());
        entity.setName(company.name());
        entity.setProfileImageUrl(company.profileImageUrl());
        entity.setEmail(company.email());
        entity.setContractEndDate(company.contractEndDate());
        entity.setCnpj(company.cnpj() == null ? "" : company.cnpj());
        entity.setOpenedAt(company.openedAt());
        entity.setWhatsappNumber(company.whatsappNumber() == null ? "" : company.whatsappNumber());
        entity.setZapiInstanceId(company.zapiInstanceId());
        entity.setZapiInstanceToken(company.zapiInstanceToken());
        entity.setZapiClientToken(company.zapiClientToken());
        entity.setBusinessHoursStart(company.businessHoursStart());
        entity.setBusinessHoursEnd(company.businessHoursEnd());
        entity.setBusinessHoursWeeklyJson(company.businessHoursWeeklyJson());
        entity.setPublicStockBannerMode(company.publicStockBannerMode());
        entity.setPublicStockBannerImagesJson(company.publicStockBannerImagesJson());
        entity.setCreatedAt(isNew ? company.createdAt() : entity.getCreatedAt());
        entity.setStatus(entity.getStatus() == null || entity.getStatus().isBlank() ? "ACTIVE" : entity.getStatus());
        entity.setUpdatedAt(Instant.now());
        jpa.save(entity);
    }

    @Override
    public void touchLastAccess(java.util.UUID companyId, Instant accessAt) {
        jpa.touchLastAccess(companyId, accessAt == null ? Instant.now() : accessAt);
    }
}
