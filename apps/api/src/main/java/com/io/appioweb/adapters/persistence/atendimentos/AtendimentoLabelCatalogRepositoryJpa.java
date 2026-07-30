package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AtendimentoLabelCatalogRepositoryJpa extends JpaRepository<JpaAtendimentoLabelCatalogEntity, UUID> {
    List<JpaAtendimentoLabelCatalogEntity> findAllByCompanyIdOrderByTitleAsc(UUID companyId);
    void deleteAllByCompanyId(UUID companyId);
}
