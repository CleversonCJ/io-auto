package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CrmLabelCatalogRepositoryJpa extends JpaRepository<JpaCrmLabelCatalogEntity, UUID> {
    List<JpaCrmLabelCatalogEntity> findAllByCompanyIdOrderByTitleAsc(UUID companyId);
    void deleteAllByCompanyId(UUID companyId);
}
