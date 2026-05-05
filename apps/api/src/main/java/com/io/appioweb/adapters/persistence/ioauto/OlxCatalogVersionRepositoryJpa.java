package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OlxCatalogVersionRepositoryJpa extends JpaRepository<JpaOlxCatalogVersionEntity, UUID> {
    Optional<JpaOlxCatalogVersionEntity> findByOlxBrandIdAndOlxModelIdAndOlxVersionId(String olxBrandId, String olxModelId, String olxVersionId);
    List<JpaOlxCatalogVersionEntity> findAllByOlxBrandIdAndOlxModelIdOrderByNameAsc(String olxBrandId, String olxModelId);
}
