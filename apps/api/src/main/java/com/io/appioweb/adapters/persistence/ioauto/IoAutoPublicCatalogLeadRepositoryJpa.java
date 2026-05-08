package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface IoAutoPublicCatalogLeadRepositoryJpa extends JpaRepository<JpaIoAutoPublicCatalogLeadEntity, UUID> {
    List<JpaIoAutoPublicCatalogLeadEntity> findAllByCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID companyId,
            Instant fromAt,
            Instant toExclusiveAt
    );
}
