package com.io.appioweb.adapters.persistence.superadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SupportTicketMessageRepositoryJpa extends JpaRepository<JpaSupportTicketMessageEntity, UUID> {
    List<JpaSupportTicketMessageEntity> findAllByTicketIdOrderByCreatedAtAsc(UUID ticketId);
}
