package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OlxAdRepositoryJpa extends JpaRepository<JpaOlxAdEntity, UUID> {
    Optional<JpaOlxAdEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    Optional<JpaOlxAdEntity> findByCompanyIdAndVehicleId(UUID companyId, UUID vehicleId);
    Optional<JpaOlxAdEntity> findByCompanyIdAndLocalAdId(UUID companyId, String localAdId);
    Optional<JpaOlxAdEntity> findByCompanyIdAndOlxListId(UUID companyId, String olxListId);
    Optional<JpaOlxAdEntity> findByCompanyIdAndImportToken(UUID companyId, String importToken);
    List<JpaOlxAdEntity> findAllByCompanyIdOrderByUpdatedAtDesc(UUID companyId);
    List<JpaOlxAdEntity> findAllByCompanyIdAndVehicleIdIn(UUID companyId, List<UUID> vehicleIds);
    List<JpaOlxAdEntity> findTop20ByStatusInAndImportTokenIsNotNullOrderByUpdatedAtAsc(List<String> statuses);
    List<JpaOlxAdEntity> findAllByLocalAdId(String localAdId);
}
