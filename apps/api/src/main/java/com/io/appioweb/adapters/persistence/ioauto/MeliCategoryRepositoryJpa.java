package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MeliCategoryRepositoryJpa extends JpaRepository<JpaMeliCategoryEntity, UUID> {
    Optional<JpaMeliCategoryEntity> findBySiteIdAndCategoryId(String siteId, String categoryId);
    List<JpaMeliCategoryEntity> findAllBySiteIdOrderByNameAsc(String siteId);
}
