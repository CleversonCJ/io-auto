package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtendimentoMessageRepositoryJpa extends JpaRepository<JpaAtendimentoMessageEntity, UUID> {
    interface ConversationUnreadCount {
        UUID getConversationId();
        long getUnreadCount();
    }

    List<JpaAtendimentoMessageEntity> findAllByConversationIdAndCompanyIdOrderByCreatedAtAsc(UUID conversationId, UUID companyId);
    List<JpaAtendimentoMessageEntity> findAllByConversationIdAndCompanyIdOrderByCreatedAtDesc(UUID conversationId, UUID companyId, Pageable pageable);
    List<JpaAtendimentoMessageEntity> findAllByConversationIdInAndCompanyIdOrderByCreatedAtAsc(List<UUID> conversationIds, UUID companyId);
    List<JpaAtendimentoMessageEntity> findAllByCompanyIdAndZapiMessageIdIn(UUID companyId, List<String> zapiMessageIds);
    Optional<JpaAtendimentoMessageEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    Optional<JpaAtendimentoMessageEntity> findByCompanyIdAndZapiMessageId(UUID companyId, String zapiMessageId);
    Optional<JpaAtendimentoMessageEntity> findFirstByConversationIdAndCompanyIdOrderByCreatedAtDesc(UUID conversationId, UUID companyId);

    @Query("""
            select message
            from JpaAtendimentoMessageEntity message
            where message.companyId = :companyId
              and message.conversationId in :conversationIds
              and message.createdAt = (
                  select max(candidate.createdAt)
                  from JpaAtendimentoMessageEntity candidate
                  where candidate.companyId = :companyId
                    and candidate.conversationId = message.conversationId
              )
            """)
    List<JpaAtendimentoMessageEntity> findLatestByConversationIds(
            @Param("companyId") UUID companyId,
            @Param("conversationIds") List<UUID> conversationIds
    );

    @Query(value = """
            select message.conversation_id as "conversationId", count(message.id) as "unreadCount"
            from atendimento_messages message
            left join atendimento_conversation_read_states read_state
              on read_state.company_id = message.company_id
             and read_state.conversation_id = message.conversation_id
             and read_state.user_id = :userId
            where message.company_id = :companyId
              and message.conversation_id in (:conversationIds)
              and message.from_me = false
              and (
                    read_state.id is null
                 or read_state.last_read_at is null
                 or message.created_at > read_state.last_read_at
              )
            group by message.conversation_id
            """, nativeQuery = true)
    List<ConversationUnreadCount> countUnreadByConversationIds(
            @Param("companyId") UUID companyId,
            @Param("userId") UUID userId,
            @Param("conversationIds") List<UUID> conversationIds
    );
}
