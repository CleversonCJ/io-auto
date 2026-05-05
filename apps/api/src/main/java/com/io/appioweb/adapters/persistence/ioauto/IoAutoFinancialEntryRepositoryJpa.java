package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IoAutoFinancialEntryRepositoryJpa extends JpaRepository<JpaIoAutoFinancialEntryEntity, UUID> {
    List<JpaIoAutoFinancialEntryEntity> findAllByCompanyIdOrderByDueDateAscUpdatedAtDesc(UUID companyId);
    Optional<JpaIoAutoFinancialEntryEntity> findByIdAndCompanyId(UUID id, UUID companyId);
}
