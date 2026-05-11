package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SupportTicketRepositoryJpa extends JpaRepository<JpaSupportTicketEntity, UUID> {
    List<JpaSupportTicketEntity> findAllByCompanyIdOrderByCreatedAtDesc(UUID companyId);
    List<JpaSupportTicketEntity> findAllByCompanyIdAndOpenedByUserIdOrderByCreatedAtDesc(UUID companyId, UUID openedByUserId);
}
