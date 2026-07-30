package com.io.appioweb.adapters.web.atendimentos;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationResult;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionLabelRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionStatus;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionLabelEntity;
import com.io.appioweb.adapters.web.atendimentos.request.ConversationLabelHttpRequest;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class AtendimentoSessionLifecycleService {

    private final AtendimentoSessionRepositoryJpa sessions;
    private final AtendimentoSessionLabelRepositoryJpa sessionLabels;
    private final CompanyRepositoryPort companies;
    private final TeamRepositoryPort teams;

    public AtendimentoSessionLifecycleService(
            AtendimentoSessionRepositoryJpa sessions,
            AtendimentoSessionLabelRepositoryJpa sessionLabels,
            CompanyRepositoryPort companies,
            TeamRepositoryPort teams
    ) {
        this.sessions = sessions;
        this.sessionLabels = sessionLabels;
        this.companies = companies;
        this.teams = teams;
    }

    @Transactional
    public JpaAtendimentoSessionEntity touchInboundMessage(UUID companyId, JpaAtendimentoConversationEntity conversation, Instant arrivedAt) {
        JpaAtendimentoSessionEntity openSession = findOpenSession(companyId, conversation.getId()).orElse(null);
        if (openSession != null) {
            return openSession;
        }

        JpaAtendimentoSessionEntity latestCompleted = findLatestCompletedSession(companyId, conversation.getId()).orElse(null);
        if (latestCompleted != null) {
            conversation.setStatus("NEW");
            conversation.setAssignedTeamId(null);
            conversation.setAssignedUserId(null);
            conversation.setAssignedUserName(null);
            conversation.setAssignedAgentId(null);
            conversation.setStartedAt(null);
            conversation.setHumanHandoffRequested(false);
            conversation.setHumanHandoffQueue(null);
            conversation.setHumanHandoffRequestedAt(null);
            conversation.setHumanUserChoiceRequired(false);
            conversation.setHumanChoiceOptionsJson("[]");
        }

        return createSession(companyId, conversation, arrivedAt, null, null, null, null, AtendimentoSessionStatus.PENDING);
    }

    @Transactional
    public JpaAtendimentoSessionEntity ensureSessionForHumanAction(
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
                .orElseGet(() -> createLegacyFallbackSession(companyId, conversation, referenceAt));

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
    public void markFirstHumanResponse(UUID companyId, UUID conversationId, UUID actorUserId, Instant respondedAt) {
        if (actorUserId == null) return;
        JpaAtendimentoSessionEntity session = findOpenSession(companyId, conversationId).orElse(null);
        if (session == null) return;
        if (session.getStartedAt() == null || session.getFirstResponseAt() != null) return;
        if (session.getResponsibleUserId() == null || !session.getResponsibleUserId().equals(actorUserId)) return;
        session.setFirstResponseAt(respondedAt);
        session.setStatus(AtendimentoSessionStatus.IN_PROGRESS);
        session.setUpdatedAt(respondedAt);
        sessions.saveAndFlush(session);
    }

    @Transactional
    public JpaAtendimentoSessionEntity concludeConversation(
            UUID companyId,
            JpaAtendimentoConversationEntity conversation,
            AtendimentoClassificationResult classificationResult,
            String classificationLabel,
            Collection<ConversationLabelHttpRequest> labels,
            Instant completedAt
    ) {
        JpaAtendimentoSessionEntity session = findOpenSession(companyId, conversation.getId())
                .orElseGet(() -> createLegacyFallbackSession(companyId, conversation, completedAt));

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
        session.setClassificationResult(classificationResult);
        session.setClassificationLabel(trimToNull(classificationLabel));
        session.setStatus(AtendimentoSessionStatus.COMPLETED);
        session.setUpdatedAt(completedAt);
        JpaAtendimentoSessionEntity saved = sessions.saveAndFlush(session);
        replaceLabels(companyId, saved.getId(), labels, completedAt);
        return saved;
    }

    @Transactional
    public void updateConversationLabels(UUID companyId, UUID conversationId, Collection<ConversationLabelHttpRequest> labels, Instant now) {
        JpaAtendimentoSessionEntity session = findOpenSession(companyId, conversationId)
                .orElseGet(() -> sessions.findFirstByCompanyIdAndConversationIdOrderByArrivedAtDescCreatedAtDesc(companyId, conversationId)
                        .orElse(null));
        if (session == null) return;
        replaceLabels(companyId, session.getId(), labels, now);
    }

    public Map<UUID, ConversationSessionSummary> summarizeLatestSessions(UUID companyId, Collection<UUID> conversationIds) {
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
        Map<UUID, List<ConversationSessionLabel>> labelsBySession = new LinkedHashMap<>();
        if (!latestSessionIds.isEmpty()) {
            for (JpaAtendimentoSessionLabelEntity row : sessionLabels.findAllByCompanyIdAndSessionIdIn(companyId, latestSessionIds)) {
                labelsBySession.computeIfAbsent(row.getSessionId(), ignored -> new ArrayList<>())
                        .add(new ConversationSessionLabel(row.getLabelId(), row.getLabelTitle(), row.getLabelColor()));
            }
            for (List<ConversationSessionLabel> list : labelsBySession.values()) {
                list.sort(Comparator.comparing(ConversationSessionLabel::title, String.CASE_INSENSITIVE_ORDER));
            }
        }

        Map<UUID, ConversationSessionSummary> result = new LinkedHashMap<>();
        for (UUID conversationId : conversationIds) {
            JpaAtendimentoSessionEntity latest = latestByConversation.get(conversationId);
            JpaAtendimentoSessionEntity latestCompleted = latestCompletedByConversation.get(conversationId);
            if (latest == null && latestCompleted == null) continue;
            List<ConversationSessionLabel> labels = latest == null
                    ? List.of()
                    : labelsBySession.getOrDefault(latest.getId(), List.of());
            result.put(conversationId, new ConversationSessionSummary(
                    latest == null ? null : latest.getId(),
                    latest == null ? null : latest.getArrivedAt(),
                    latest == null ? null : latest.getStartedAt(),
                    latest == null ? null : latest.getFirstResponseAt(),
                    latest == null ? null : latest.getCompletedAt(),
                    latest == null ? null : latest.getResponsibleUserId(),
                    latest == null ? null : latest.getResponsibleUserName(),
                    latest == null ? null : latest.getStatus(),
                    latest == null ? null : latest.getClassificationResult(),
                    latest == null ? null : latest.getClassificationLabel(),
                    latest == null ? null : latest.isSaleCompleted(),
                    latest == null ? null : latest.getSoldVehicleId(),
                    latest == null ? null : latest.getSoldVehicleTitle(),
                    latest == null ? null : latest.getSaleCompletedAt(),
                    latestCompleted == null ? null : latestCompleted.getCompletedAt(),
                    latestCompleted == null ? null : latestCompleted.getClassificationResult(),
                    latestCompleted == null ? null : latestCompleted.getClassificationLabel(),
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

    private Optional<JpaAtendimentoSessionEntity> findLatestCompletedSession(UUID companyId, UUID conversationId) {
        return sessions.findFirstByCompanyIdAndConversationIdAndCompletedAtIsNotNullOrderByCompletedAtDescArrivedAtDesc(companyId, conversationId);
    }

    private JpaAtendimentoSessionEntity createLegacyFallbackSession(UUID companyId, JpaAtendimentoConversationEntity conversation, Instant referenceAt) {
        Instant arrivedAt = firstNonNull(conversation.getCreatedAt(), conversation.getLastMessageAt(), referenceAt, Instant.now());
        JpaAtendimentoSessionEntity created = createSession(
                companyId,
                conversation,
                arrivedAt,
                conversation.getAssignedTeamId(),
                resolveTeamName(companyId, conversation.getAssignedTeamId()),
                conversation.getAssignedUserId(),
                conversation.getAssignedUserName(),
                resolveStatusForLegacy(conversation)
        );
        if (conversation.getStartedAt() != null) {
            created.setStartedAt(conversation.getStartedAt());
            created.setStatus(AtendimentoSessionStatus.IN_PROGRESS);
            created.setUpdatedAt(referenceAt);
            return sessions.saveAndFlush(created);
        }
        return created;
    }

    private AtendimentoSessionStatus resolveStatusForLegacy(JpaAtendimentoConversationEntity conversation) {
        return conversation.getStartedAt() != null || conversation.getAssignedUserId() != null || conversation.getAssignedTeamId() != null
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
        entity.setChannelId(resolveChannelId(companyId));
        entity.setChannelName(resolveChannelName(companyId));
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

    private void replaceLabels(UUID companyId, UUID sessionId, Collection<ConversationLabelHttpRequest> labels, Instant now) {
        Map<String, ConversationLabelSnapshot> desiredById = new LinkedHashMap<>();
        if (labels != null) {
            for (ConversationLabelHttpRequest item : labels) {
                if (item == null) continue;
                String id = trimToNull(item.id());
                String title = trimToNull(item.title());
                if (id == null || title == null) continue;
                desiredById.put(id, new ConversationLabelSnapshot(id, title, trimToNull(item.color())));
            }
        }

        List<JpaAtendimentoSessionLabelEntity> existingRows = sessionLabels.findAllByCompanyIdAndSessionId(companyId, sessionId);
        Map<String, JpaAtendimentoSessionLabelEntity> existingById = new LinkedHashMap<>();
        List<JpaAtendimentoSessionLabelEntity> rowsToDelete = new ArrayList<>();
        for (JpaAtendimentoSessionLabelEntity row : existingRows) {
            String normalizedId = trimToNull(row.getLabelId());
            if (normalizedId == null) {
                rowsToDelete.add(row);
                continue;
            }
            if (!desiredById.containsKey(normalizedId)) {
                rowsToDelete.add(row);
                continue;
            }
            existingById.putIfAbsent(normalizedId, row);
        }

        if (!rowsToDelete.isEmpty()) {
            sessionLabels.deleteAllInBatch(rowsToDelete);
            sessionLabels.flush();
        }

        List<JpaAtendimentoSessionLabelEntity> rowsToSave = new ArrayList<>();
        for (ConversationLabelSnapshot desired : desiredById.values()) {
            JpaAtendimentoSessionLabelEntity existing = existingById.get(desired.id());
            if (existing != null) {
                boolean changed = false;
                if (!Objects.equals(existing.getLabelTitle(), desired.title())) {
                    existing.setLabelTitle(desired.title());
                    changed = true;
                }
                if (!Objects.equals(trimToNull(existing.getLabelColor()), desired.color())) {
                    existing.setLabelColor(desired.color());
                    changed = true;
                }
                if (changed) {
                    existing.setUpdatedAt(now);
                    rowsToSave.add(existing);
                }
                continue;
            }

            JpaAtendimentoSessionLabelEntity row = new JpaAtendimentoSessionLabelEntity();
            row.setId(UUID.randomUUID());
            row.setSessionId(sessionId);
            row.setCompanyId(companyId);
            row.setLabelId(desired.id());
            row.setLabelTitle(desired.title());
            row.setLabelColor(desired.color());
            row.setCreatedAt(now);
            row.setUpdatedAt(now);
            rowsToSave.add(row);
        }

        if (!rowsToSave.isEmpty()) {
            sessionLabels.saveAllAndFlush(rowsToSave);
        }
    }

    private String resolveChannelId(UUID companyId) {
        return companies.findById(companyId)
                .map(company -> trimToNull(company.zapiInstanceId()))
                .orElse(null);
    }

    private String resolveChannelName(UUID companyId) {
        return companies.findById(companyId)
                .map(company -> {
                    String whatsapp = trimToNull(company.whatsappNumber());
                    if (whatsapp != null) return whatsapp;
                    return "Integração";
                })
                .orElse("Integração");
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

    public record ConversationSessionSummary(
            UUID sessionId,
            Instant arrivedAt,
            Instant startedAt,
            Instant firstResponseAt,
            Instant completedAt,
            UUID responsibleUserId,
            String responsibleUserName,
            AtendimentoSessionStatus status,
            AtendimentoClassificationResult classificationResult,
            String classificationLabel,
            Boolean saleCompleted,
            UUID soldVehicleId,
            String soldVehicleTitle,
            Instant saleCompletedAt,
            Instant latestCompletedAt,
            AtendimentoClassificationResult latestCompletedClassificationResult,
            String latestCompletedClassificationLabel,
            Boolean latestCompletedSaleCompleted,
            UUID latestCompletedSoldVehicleId,
            String latestCompletedSoldVehicleTitle,
            List<ConversationSessionLabel> labels
    ) {
    }

    public record ConversationSessionLabel(String id, String title, String color) {
    }

    private record ConversationLabelSnapshot(String id, String title, String color) {
    }
}
