package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IoAutoDreSubcategoryRepositoryJpa extends JpaRepository<JpaIoAutoDreSubcategoryEntity, UUID> {
    List<JpaIoAutoDreSubcategoryEntity> findAllByCompanyIdOrderBySectionCodeAscSortOrderAscNameAsc(UUID companyId);
    Optional<JpaIoAutoDreSubcategoryEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    Optional<JpaIoAutoDreSubcategoryEntity> findByCompanyIdAndCode(UUID companyId, String code);
    boolean existsByCompanyIdAndSectionCodeAndEntryTypeAndNameIgnoreCase(UUID companyId, String sectionCode, String entryType, String name);
}
