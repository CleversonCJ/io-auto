package com.io.appioweb.adapters.persistence.atendimentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AtendimentoMessageRepositoryJpa extends JpaRepository<JpaAtendimentoMessageEntity, UUID> {
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
}
