package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AtendimentoClassificationCatalogRepositoryJpa extends JpaRepository<JpaAtendimentoClassificationCatalogEntity, UUID> {
    List<JpaAtendimentoClassificationCatalogEntity> findAllByCompanyIdOrderByTitleAsc(UUID companyId);
    void deleteAllByCompanyId(UUID companyId);
}
