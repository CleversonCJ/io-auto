package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query(value = """
            select distinct on (conversation_id) session.*
            from atendimento_sessions session
            where session.company_id = :companyId
              and session.conversation_id in (:conversationIds)
            order by session.conversation_id, session.arrived_at desc, session.created_at desc
            """, nativeQuery = true)
    List<JpaAtendimentoSessionEntity> findLatestByConversationIds(
            @Param("companyId") UUID companyId,
            @Param("conversationIds") Collection<UUID> conversationIds
    );

    @Query(value = """
            select distinct on (conversation_id) session.*
            from atendimento_sessions session
            where session.company_id = :companyId
              and session.conversation_id in (:conversationIds)
              and session.completed_at is not null
            order by session.conversation_id, session.completed_at desc, session.arrived_at desc
            """, nativeQuery = true)
    List<JpaAtendimentoSessionEntity> findLatestCompletedByConversationIds(
            @Param("companyId") UUID companyId,
            @Param("conversationIds") Collection<UUID> conversationIds
    );
}
