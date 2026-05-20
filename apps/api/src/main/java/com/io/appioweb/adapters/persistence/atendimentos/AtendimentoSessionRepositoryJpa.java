package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtendimentoSessionRepositoryJpa extends JpaRepository<JpaAtendimentoSessionEntity, UUID> {
    Optional<JpaAtendimentoSessionEntity> findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(UUID companyId, UUID conversationId);
    Optional<JpaAtendimentoSessionEntity> findFirstByCompanyIdAndConversationIdOrderByArrivedAtDescCreatedAtDesc(UUID companyId, UUID conversationId);
    Optional<JpaAtendimentoSessionEntity> findFirstByCompanyIdAndConversationIdAndCompletedAtIsNotNullOrderByCompletedAtDescArrivedAtDesc(UUID companyId, UUID conversationId);
    List<JpaAtendimentoSessionEntity> findAllByCompanyIdAndConversationIdInOrderByArrivedAtDescCreatedAtDesc(UUID companyId, Collection<UUID> conversationIds);
    List<JpaAtendimentoSessionEntity> findAllByCompanyIdAndArrivedAtGreaterThanEqualAndArrivedAtLessThanOrderByArrivedAtAsc(UUID companyId, java.time.Instant startAt, java.time.Instant endAt);
    List<JpaAtendimentoSessionEntity> findAllByCompanyIdAndSaleCompletedIsTrueAndSaleCompletedAtGreaterThanEqualAndSaleCompletedAtLessThanOrderBySaleCompletedAtAsc(UUID companyId, java.time.Instant startAt, java.time.Instant endAt);
    List<JpaAtendimentoSessionEntity> findAllByCompanyIdAndSaleCompletedIsTrueOrderBySaleCompletedAtDesc(UUID companyId);
}
