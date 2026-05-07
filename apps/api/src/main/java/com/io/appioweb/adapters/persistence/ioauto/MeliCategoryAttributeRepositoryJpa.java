package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MeliCategoryAttributeRepositoryJpa extends JpaRepository<JpaMeliCategoryAttributeEntity, UUID> {
    Optional<JpaMeliCategoryAttributeEntity> findByCategoryIdAndAttributeId(String categoryId, String attributeId);
    List<JpaMeliCategoryAttributeEntity> findAllByCategoryIdOrderByRequiredDescNameAsc(String categoryId);
}
