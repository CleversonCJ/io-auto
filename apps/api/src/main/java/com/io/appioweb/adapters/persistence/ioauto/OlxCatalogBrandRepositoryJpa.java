package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OlxCatalogBrandRepositoryJpa extends JpaRepository<JpaOlxCatalogBrandEntity, UUID> {
    Optional<JpaOlxCatalogBrandEntity> findByOlxBrandIdAndType(String olxBrandId, String type);
    List<JpaOlxCatalogBrandEntity> findAllByTypeOrderByNameAsc(String type);
}
