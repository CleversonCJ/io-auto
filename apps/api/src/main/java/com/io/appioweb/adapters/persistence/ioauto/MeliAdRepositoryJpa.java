package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MeliAdRepositoryJpa extends JpaRepository<JpaMeliAdEntity, UUID> {
    Optional<JpaMeliAdEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    Optional<JpaMeliAdEntity> findByCompanyIdAndVehicleId(UUID companyId, UUID vehicleId);
    Optional<JpaMeliAdEntity> findByCompanyIdAndMeliItemId(UUID companyId, String meliItemId);
    Optional<JpaMeliAdEntity> findByCompanyIdAndSellerSku(UUID companyId, String sellerSku);
    List<JpaMeliAdEntity> findAllByCompanyIdOrderByUpdatedAtDesc(UUID companyId);
    List<JpaMeliAdEntity> findAllByCompanyIdAndStatusOrderByUpdatedAtDesc(UUID companyId, String status);
    List<JpaMeliAdEntity> findTop50ByStatusInOrderByUpdatedAtAsc(List<String> statuses);
}
