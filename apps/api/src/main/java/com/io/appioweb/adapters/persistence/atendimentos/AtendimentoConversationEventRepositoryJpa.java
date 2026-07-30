package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AtendimentoConversationEventRepositoryJpa extends JpaRepository<JpaAtendimentoConversationEventEntity, UUID> {
    List<JpaAtendimentoConversationEventEntity> findAllByCompanyIdAndConversationIdOrderByEventAtAsc(UUID companyId, UUID conversationId);
    boolean existsByCompanyIdAndConversationIdAndEventTypeAndEventTextAndEventAt(
            UUID companyId,
            UUID conversationId,
            String eventType,
            String eventText,
            Instant eventAt
    );
}
