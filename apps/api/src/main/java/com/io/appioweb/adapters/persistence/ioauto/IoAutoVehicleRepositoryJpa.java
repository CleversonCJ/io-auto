package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IoAutoVehicleRepositoryJpa extends JpaRepository<JpaIoAutoVehicleEntity, UUID> {
    List<JpaIoAutoVehicleEntity> findAllByCompanyIdOrderByUpdatedAtDesc(UUID companyId);
    Optional<JpaIoAutoVehicleEntity> findByIdAndCompanyId(UUID id, UUID companyId);

    @Query("""
            select count(v)
            from JpaIoAutoVehicleEntity v
            where v.companyId = :companyId
              and upper(coalesce(v.status, 'DRAFT')) not in ('DRAFT', 'ARCHIVED', 'SOLD', 'REMOVED')
            """)
    long countActiveByCompanyId(@Param("companyId") UUID companyId);
}
