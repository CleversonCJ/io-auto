package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OlxCatalogModelRepositoryJpa extends JpaRepository<JpaOlxCatalogModelEntity, UUID> {
    Optional<JpaOlxCatalogModelEntity> findByOlxBrandIdAndOlxModelId(String olxBrandId, String olxModelId);
    List<JpaOlxCatalogModelEntity> findAllByOlxBrandIdOrderByNameAsc(String olxBrandId);
}
