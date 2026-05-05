package com.io.appioweb.adapters.web.atendimentos;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationResult;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionLabelRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionStatus;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionLabelEntity;
import com.io.appioweb.adapters.web.atendimentos.request.ConversationLabelHttpRequest;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.domain.auth.entity.Company;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AtendimentoSessionLifecycleServiceTest {

    @Mock
    private AtendimentoSessionRepositoryJpa sessions;

    @Mock
    private AtendimentoSessionLabelRepositoryJpa labels;

    @Mock
    private CompanyRepositoryPort companies;

    @InjectMocks
    private AtendimentoSessionLifecycleService service;

    @Test
    void touchInboundMessageCreatesNewPendingSessionAndResetsConversationAfterCompletion() {
        UUID companyId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID oldUserId = UUID.randomUUID();
        Instant arrivedAt = Instant.parse("2026-03-18T15:00:00Z");

        JpaAtendimentoConversationEntity conversation = new JpaAtendimentoConversationEntity();
        conversation.setId(conversationId);
        conversation.setCompanyId(companyId);
        conversation.setAssignedUserId(oldUserId);
        conversation.setAssignedUserName("Atendente Antigo");
        conversation.setAssignedAgentId("agent-1");
        conversation.setStatus("IN_PROGRESS");
        conversation.setStartedAt(Instant.parse("2026-03-18T14:00:00Z"));
        conversation.setCreatedAt(Instant.parse("2026-03-18T13:00:00Z"));

        JpaAtendimentoSessionEntity latestCompleted = new JpaAtendimentoSessionEntity();
        latestCompleted.setId(UUID.randomUUID());
        latestCompleted.setConversationId(conversationId);
        latestCompleted.setCompletedAt(Instant.parse("2026-03-18T14:30:00Z"));

        when(sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId))
                .thenReturn(Optional.empty());
        when(sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNotNullOrderByCompletedAtDescArrivedAtDesc(companyId, conversationId))
                .thenReturn(Optional.of(latestCompleted));
        when(companies.findById(companyId)).thenReturn(Optional.of(company(companyId)));
        when(sessions.saveAndFlush(any(JpaAtendimentoSessionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        JpaAtendimentoSessionEntity created = service.touchInboundMessage(companyId, conversation, arrivedAt);

        assertThat(created.getStatus()).isEqualTo(AtendimentoSessionStatus.PENDING);
        assertThat(created.getArrivedAt()).isEqualTo(arrivedAt);
        assertThat(created.getResponsibleUserId()).isNull();
        assertThat(conversation.getStatus()).isEqualTo("NEW");
        assertThat(conversation.getAssignedUserId()).isNull();
        assertThat(conversation.getAssignedUserName()).isNull();
        assertThat(conversation.getAssignedAgentId()).isNull();
        assertThat(conversation.getStartedAt()).isNull();
    }

    @Test
    void markFirstHumanResponsePersistsOnlyForResponsibleUser() {
        UUID companyId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID responsibleUserId = UUID.randomUUID();
        Instant responseAt = Instant.parse("2026-03-18T16:10:00Z");

        JpaAtendimentoSessionEntity session = new JpaAtendimentoSessionEntity();
        session.setId(UUID.randomUUID());
        session.setConversationId(conversationId);
        session.setCompanyId(companyId);
        session.setStartedAt(Instant.parse("2026-03-18T16:00:00Z"));
        session.setResponsibleUserId(responsibleUserId);
        session.setStatus(AtendimentoSessionStatus.IN_PROGRESS);

        when(sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId))
                .thenReturn(Optional.of(session));

        service.markFirstHumanResponse(companyId, conversationId, responsibleUserId, responseAt);

        assertThat(session.getFirstResponseAt()).isEqualTo(responseAt);
        verify(sessions).saveAndFlush(session);

        session.setFirstResponseAt(null);
        service.markFirstHumanResponse(companyId, conversationId, UUID.randomUUID(), responseAt.plusSeconds(30));

        assertThat(session.getFirstResponseAt()).isNull();
        verify(sessions, times(1)).saveAndFlush(session);
    }

    @Test
    void concludeConversationStoresClassificationAndSessionLabels() {
        UUID companyId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant completedAt = Instant.parse("2026-03-18T17:00:00Z");

        JpaAtendimentoConversationEntity conversation = new JpaAtendimentoConversationEntity();
        conversation.setId(conversationId);
        conversation.setCompanyId(companyId);
        conversation.setStartedAt(Instant.parse("2026-03-18T16:00:00Z"));
        conversation.setAssignedUserId(UUID.randomUUID());
        conversation.setAssignedUserName("Maria");

        JpaAtendimentoSessionEntity session = new JpaAtendimentoSessionEntity();
        session.setId(UUID.randomUUID());
        session.setConversationId(conversationId);
        session.setCompanyId(companyId);
        session.setArrivedAt(Instant.parse("2026-03-18T15:30:00Z"));
        session.setStartedAt(Instant.parse("2026-03-18T16:00:00Z"));
        session.setStatus(AtendimentoSessionStatus.IN_PROGRESS);

        when(sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId))
                .thenReturn(Optional.of(session));
        when(sessions.saveAndFlush(any(JpaAtendimentoSessionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(labels.findAllByCompanyIdAndSessionId(companyId, session.getId())).thenReturn(List.of());

        service.concludeConversation(
                companyId,
                conversation,
                AtendimentoClassificationResult.OBJECTIVE_ACHIEVED,
                "Objetivo atingido",
                List.of(
                        new ConversationLabelHttpRequest("vip", "VIP", "#0EA5E9"),
                        new ConversationLabelHttpRequest("suporte", "Suporte", "#10B981")
                ),
                completedAt
        );

        assertThat(session.getCompletedAt()).isEqualTo(completedAt);
        assertThat(session.getClassificationResult()).isEqualTo(AtendimentoClassificationResult.OBJECTIVE_ACHIEVED);
        assertThat(session.getClassificationLabel()).isEqualTo("Objetivo atingido");
        assertThat(session.getStatus()).isEqualTo(AtendimentoSessionStatus.COMPLETED);

        ArgumentCaptor<List<JpaAtendimentoSessionLabelEntity>> labelCaptor = ArgumentCaptor.forClass(List.class);
        verify(labels).findAllByCompanyIdAndSessionId(companyId, session.getId());
        verify(labels, never()).deleteAllByCompanyIdAndSessionId(any(), any());
        verify(labels).saveAllAndFlush(labelCaptor.capture());
        assertThat(labelCaptor.getValue()).hasSize(2);
        assertThat(labelCaptor.getValue()).extracting(JpaAtendimentoSessionLabelEntity::getLabelTitle)
                .containsExactlyInAnyOrder("VIP", "Suporte");
    }

    @Test
    void concludeConversationReusesExistingLabelsAndDeduplicatesPayload() {
        UUID companyId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant completedAt = Instant.parse("2026-03-18T17:30:00Z");

        JpaAtendimentoConversationEntity conversation = new JpaAtendimentoConversationEntity();
        conversation.setId(conversationId);
        conversation.setCompanyId(companyId);

        JpaAtendimentoSessionEntity session = new JpaAtendimentoSessionEntity();
        session.setId(UUID.randomUUID());
        session.setConversationId(conversationId);
        session.setCompanyId(companyId);
        session.setArrivedAt(Instant.parse("2026-03-18T15:30:00Z"));
        session.setStatus(AtendimentoSessionStatus.IN_PROGRESS);

        JpaAtendimentoSessionLabelEntity existingLabel = new JpaAtendimentoSessionLabelEntity();
        existingLabel.setId(UUID.randomUUID());
        existingLabel.setSessionId(session.getId());
        existingLabel.setCompanyId(companyId);
        existingLabel.setLabelId("label_1771613920438");
        existingLabel.setLabelTitle("VIP");
        existingLabel.setLabelColor("#0EA5E9");
        existingLabel.setCreatedAt(Instant.parse("2026-03-18T16:00:00Z"));
        existingLabel.setUpdatedAt(Instant.parse("2026-03-18T16:00:00Z"));

        when(sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId))
                .thenReturn(Optional.of(session));
        when(sessions.saveAndFlush(any(JpaAtendimentoSessionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(labels.findAllByCompanyIdAndSessionId(companyId, session.getId())).thenReturn(List.of(existingLabel));

        service.concludeConversation(
                companyId,
                conversation,
                AtendimentoClassificationResult.OBJECTIVE_ACHIEVED,
                "Objetivo atingido",
                List.of(
                        new ConversationLabelHttpRequest("label_1771613920438", "VIP", "#0EA5E9"),
                        new ConversationLabelHttpRequest("label_1771613920438", "VIP", "#0EA5E9")
                ),
                completedAt
        );

        verify(labels).findAllByCompanyIdAndSessionId(companyId, session.getId());
        verify(labels, never()).deleteAllInBatch(any());
        verify(labels, never()).flush();
        verify(labels, never()).saveAllAndFlush(any());
        assertThat(existingLabel.getLabelTitle()).isEqualTo("VIP");
        assertThat(existingLabel.getLabelColor()).isEqualTo("#0EA5E9");
    }

    private static Company company(UUID companyId) {
        return new Company(
                companyId,
                "Empresa Teste",
                null,
                "teste@io.com",
                LocalDate.parse("2027-01-01"),
                "00.000.000/0001-00",
                LocalDate.parse("2024-01-01"),
                "5511999999999",
                "instance-1",
                "token-1",
                "client-token",
                "08:00",
                "18:00",
                null,
                "VEHICLES",
                "[]",
                Instant.parse("2024-01-01T00:00:00Z")
        );
    }
}
