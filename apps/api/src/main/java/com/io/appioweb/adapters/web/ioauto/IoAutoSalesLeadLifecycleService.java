package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionLabelRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionStatus;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionLabelEntity;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class IoAutoSalesLeadLifecycleService {

    private final AtendimentoSessionRepositoryJpa sessions;
    private final AtendimentoSessionLabelRepositoryJpa sessionLabels;
    private final TeamRepositoryPort teams;

    public IoAutoSalesLeadLifecycleService(
            AtendimentoSessionRepositoryJpa sessions,
            AtendimentoSessionLabelRepositoryJpa sessionLabels,
            TeamRepositoryPort teams
    ) {
        this.sessions = sessions;
        this.sessionLabels = sessionLabels;
        this.teams = teams;
    }

    @Transactional
    public JpaAtendimentoSessionEntity ensureSalesSession(
            UUID companyId,
            JpaAtendimentoConversationEntity conversation,
            Instant referenceAt,
            UUID responsibleTeamId,
            String responsibleTeamName,
            UUID responsibleUserId,
            String responsibleUserName,
            boolean startIfMissing
    ) {
        JpaAtendimentoSessionEntity session = findOpenSession(companyId, conversation.getId())
                .orElseGet(() -> createFallbackSession(companyId, conversation, referenceAt));

        if (responsibleTeamId != null) {
            session.setResponsibleTeamId(responsibleTeamId);
            session.setResponsibleTeamName(trimToNull(responsibleTeamName));
        }
        if (responsibleUserId != null) {
            session.setResponsibleUserId(responsibleUserId);
            session.setResponsibleUserName(responsibleUserName);
        }
        if (startIfMissing && session.getStartedAt() == null) {
            session.setStartedAt(referenceAt);
        }
        if (session.getStartedAt() != null) {
            session.setStatus(AtendimentoSessionStatus.IN_PROGRESS);
        } else if (session.getStatus() == null) {
            session.setStatus(AtendimentoSessionStatus.PENDING);
        }
        session.setUpdatedAt(referenceAt);
        return sessions.saveAndFlush(session);
    }

    @Transactional
    public JpaAtendimentoSessionEntity completeSaleSession(
            UUID companyId,
            JpaAtendimentoConversationEntity conversation,
            Instant completedAt
    ) {
        JpaAtendimentoSessionEntity session = findOpenSession(companyId, conversation.getId())
                .orElseGet(() -> createFallbackSession(companyId, conversation, completedAt));
        if (session.getCompletedAt() == null) {
            session.setCompletedAt(completedAt);
        }
        if (session.getStartedAt() == null && conversation.getStartedAt() != null) {
            session.setStartedAt(conversation.getStartedAt());
        }
        if (session.getResponsibleUserId() == null && conversation.getAssignedUserId() != null) {
            session.setResponsibleUserId(conversation.getAssignedUserId());
            session.setResponsibleUserName(conversation.getAssignedUserName());
        }
        if (session.getResponsibleTeamId() == null && conversation.getAssignedTeamId() != null) {
            session.setResponsibleTeamId(conversation.getAssignedTeamId());
            session.setResponsibleTeamName(resolveTeamName(companyId, conversation.getAssignedTeamId()));
        }
        session.setStatus(AtendimentoSessionStatus.COMPLETED);
        session.setUpdatedAt(completedAt);
        return sessions.saveAndFlush(session);
    }

    public Map<UUID, LeadSessionSummary> summarizeLatestLeadSessions(UUID companyId, Collection<UUID> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, JpaAtendimentoSessionEntity> latestByConversation = new LinkedHashMap<>();
        Map<UUID, JpaAtendimentoSessionEntity> latestCompletedByConversation = new LinkedHashMap<>();
        for (JpaAtendimentoSessionEntity row : sessions.findLatestByConversationIds(companyId, conversationIds)) {
            latestByConversation.put(row.getConversationId(), row);
        }
        for (JpaAtendimentoSessionEntity row : sessions.findLatestCompletedByConversationIds(companyId, conversationIds)) {
            latestCompletedByConversation.put(row.getConversationId(), row);
        }

        List<UUID> latestSessionIds = latestByConversation.values().stream()
                .map(JpaAtendimentoSessionEntity::getId)
                .toList();
        Map<UUID, List<LeadSessionLabel>> labelsBySession = new LinkedHashMap<>();
        if (!latestSessionIds.isEmpty()) {
            for (JpaAtendimentoSessionLabelEntity row : sessionLabels.findAllByCompanyIdAndSessionIdIn(companyId, latestSessionIds)) {
                labelsBySession.computeIfAbsent(row.getSessionId(), ignored -> new ArrayList<>())
                        .add(new LeadSessionLabel(row.getLabelId(), row.getLabelTitle(), row.getLabelColor()));
            }
            for (List<LeadSessionLabel> labels : labelsBySession.values()) {
                labels.sort(Comparator.comparing(LeadSessionLabel::title, String.CASE_INSENSITIVE_ORDER));
            }
        }

        Map<UUID, LeadSessionSummary> result = new LinkedHashMap<>();
        for (UUID conversationId : conversationIds) {
            JpaAtendimentoSessionEntity latest = latestByConversation.get(conversationId);
            JpaAtendimentoSessionEntity latestCompleted = latestCompletedByConversation.get(conversationId);
            if (latest == null && latestCompleted == null) continue;
            List<LeadSessionLabel> labels = latest == null
                    ? List.of()
                    : labelsBySession.getOrDefault(latest.getId(), List.of());
            result.put(conversationId, new LeadSessionSummary(
                    latest == null ? null : latest.getId(),
                    latest == null ? null : latest.getArrivedAt(),
                    latest == null ? null : latest.getStartedAt(),
                    latest == null ? null : latest.getFirstResponseAt(),
                    latest == null ? null : latest.getCompletedAt(),
                    latest == null ? null : latest.getResponsibleUserId(),
                    latest == null ? null : latest.getResponsibleUserName(),
                    latest == null ? null : latest.getStatus(),
                    latest == null ? null : latest.isSaleCompleted(),
                    latest == null ? null : latest.getSoldVehicleId(),
                    latest == null ? null : latest.getSoldVehicleTitle(),
                    latest == null ? null : latest.getSaleCompletedAt(),
                    latestCompleted == null ? null : latestCompleted.getCompletedAt(),
                    latestCompleted == null ? null : latestCompleted.isSaleCompleted(),
                    latestCompleted == null ? null : latestCompleted.getSoldVehicleId(),
                    latestCompleted == null ? null : latestCompleted.getSoldVehicleTitle(),
                    labels
            ));
        }
        return result;
    }

    private Optional<JpaAtendimentoSessionEntity> findOpenSession(UUID companyId, UUID conversationId) {
        return sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNullOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId);
    }

    private JpaAtendimentoSessionEntity createFallbackSession(
            UUID companyId,
            JpaAtendimentoConversationEntity conversation,
            Instant referenceAt
    ) {
        Instant arrivedAt = firstNonNull(conversation.getCreatedAt(), conversation.getLastMessageAt(), referenceAt, Instant.now());
        JpaAtendimentoSessionEntity created = createSession(
                companyId,
                conversation,
                arrivedAt,
                conversation.getAssignedTeamId(),
                resolveTeamName(companyId, conversation.getAssignedTeamId()),
                conversation.getAssignedUserId(),
                conversation.getAssignedUserName(),
                resolveInitialStatus(conversation)
        );
        if (conversation.getStartedAt() != null) {
            created.setStartedAt(conversation.getStartedAt());
            created.setStatus(AtendimentoSessionStatus.IN_PROGRESS);
            created.setUpdatedAt(referenceAt);
            return sessions.saveAndFlush(created);
        }
        return created;
    }

    private AtendimentoSessionStatus resolveInitialStatus(JpaAtendimentoConversationEntity conversation) {
        return conversation.getStartedAt() != null
                || conversation.getAssignedUserId() != null
                || conversation.getAssignedTeamId() != null
                ? AtendimentoSessionStatus.IN_PROGRESS
                : AtendimentoSessionStatus.PENDING;
    }

    private JpaAtendimentoSessionEntity createSession(
            UUID companyId,
            JpaAtendimentoConversationEntity conversation,
            Instant arrivedAt,
            UUID responsibleTeamId,
            String responsibleTeamName,
            UUID responsibleUserId,
            String responsibleUserName,
            AtendimentoSessionStatus status
    ) {
        JpaAtendimentoSessionEntity entity = new JpaAtendimentoSessionEntity();
        Instant now = firstNonNull(arrivedAt, Instant.now());
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setConversationId(conversation.getId());
        entity.setChannelId(trimToNull(conversation.getSourceReference()));
        entity.setChannelName(trimToNull(conversation.getSourcePlatform()));
        entity.setResponsibleTeamId(responsibleTeamId);
        entity.setResponsibleTeamName(trimToNull(responsibleTeamName));
        entity.setResponsibleUserId(responsibleUserId);
        entity.setResponsibleUserName(trimToNull(responsibleUserName));
        entity.setArrivedAt(now);
        entity.setStatus(status == null ? AtendimentoSessionStatus.PENDING : status);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return sessions.saveAndFlush(entity);
    }

    private String resolveTeamName(UUID companyId, UUID teamId) {
        if (teamId == null) return null;
        return teams.findByIdAndCompanyId(teamId, companyId)
                .map(team -> trimToNull(team.name()))
                .orElse(null);
    }

    private static Instant firstNonNull(Instant... values) {
        for (Instant value : values) {
            if (value != null) return value;
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record LeadSessionSummary(
            UUID sessionId,
            Instant arrivedAt,
            Instant startedAt,
            Instant firstResponseAt,
            Instant completedAt,
            UUID responsibleUserId,
            String responsibleUserName,
            AtendimentoSessionStatus status,
            Boolean saleCompleted,
            UUID soldVehicleId,
            String soldVehicleTitle,
            Instant saleCompletedAt,
            Instant latestCompletedAt,
            Boolean latestCompletedSaleCompleted,
            UUID latestCompletedSoldVehicleId,
            String latestCompletedSoldVehicleTitle,
            List<LeadSessionLabel> labels
    ) {}

    public record LeadSessionLabel(String id, String title, String color) {}
}
