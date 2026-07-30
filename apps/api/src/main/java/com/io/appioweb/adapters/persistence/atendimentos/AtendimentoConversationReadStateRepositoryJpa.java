package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtendimentoConversationReadStateRepositoryJpa extends JpaRepository<JpaAtendimentoConversationReadStateEntity, UUID> {
    Optional<JpaAtendimentoConversationReadStateEntity> findByCompanyIdAndUserIdAndConversationId(
            UUID companyId,
            UUID userId,
            UUID conversationId
    );

    List<JpaAtendimentoConversationReadStateEntity> findAllByCompanyIdAndUserIdAndConversationIdIn(
            UUID companyId,
            UUID userId,
            List<UUID> conversationIds
    );

    @Transactional
    @Modifying
    @Query(value = """
            insert into atendimento_conversation_read_states (
                id,
                company_id,
                user_id,
                conversation_id,
                last_read_message_id,
                last_read_at,
                created_at,
                updated_at
            ) values (
                :id,
                :companyId,
                :userId,
                :conversationId,
                :lastReadMessageId,
                :lastReadAt,
                :now,
                :now
            )
            on conflict (company_id, user_id, conversation_id) do update set
                last_read_message_id = excluded.last_read_message_id,
                last_read_at = excluded.last_read_at,
                updated_at = excluded.updated_at
            where atendimento_conversation_read_states.last_read_at is null
               or atendimento_conversation_read_states.last_read_at <= excluded.last_read_at
            """, nativeQuery = true)
    int upsertReadState(
            @Param("id") UUID id,
            @Param("companyId") UUID companyId,
            @Param("userId") UUID userId,
            @Param("conversationId") UUID conversationId,
            @Param("lastReadMessageId") UUID lastReadMessageId,
            @Param("lastReadAt") Instant lastReadAt,
            @Param("now") Instant now
    );
}
