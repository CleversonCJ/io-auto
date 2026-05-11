package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FeatureUsageEventRepositoryJpa extends JpaRepository<JpaFeatureUsageEventEntity, UUID> {
}
