package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MeliWebhookEventRepositoryJpa extends JpaRepository<JpaMeliWebhookEventEntity, UUID> {
    List<JpaMeliWebhookEventEntity> findTop50ByProcessedFalseOrderByReceivedAtAsc();
}
