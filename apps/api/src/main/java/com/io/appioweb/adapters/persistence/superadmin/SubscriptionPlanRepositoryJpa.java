package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionPlanRepositoryJpa extends JpaRepository<JpaSubscriptionPlanEntity, UUID> {
    List<JpaSubscriptionPlanEntity> findAllByOrderBySortOrderAscPlanNameAsc();
    List<JpaSubscriptionPlanEntity> findAllByActiveTrueOrderBySortOrderAscPlanNameAsc();
    Optional<JpaSubscriptionPlanEntity> findByPlanKeyIgnoreCase(String planKey);
    boolean existsByPlanKeyIgnoreCase(String planKey);
    boolean existsByPlanKeyIgnoreCaseAndIdNot(String planKey, UUID id);
}
