package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoMessageRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoMessageEntity;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.Team;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
public class IoAutoLeadDirectoryController {

    private final CurrentUserPort currentUser;
    private final UserRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final AtendimentoMessageRepositoryJpa messages;
    private final IoAutoSalesLeadLifecycleService salesLeadLifecycleService;

    public IoAutoLeadDirectoryController(
            CurrentUserPort currentUser,
            UserRepositoryPort users,
            TeamRepositoryPort teams,
            AtendimentoConversationRepositoryJpa conversations,
            AtendimentoMessageRepositoryJpa messages,
            IoAutoSalesLeadLifecycleService salesLeadLifecycleService
    ) {
        this.currentUser = currentUser;
        this.users = users;
        this.teams = teams;
        this.conversations = conversations;
        this.messages = messages;
        this.salesLeadLifecycleService = salesLeadLifecycleService;
    }

    @GetMapping("/ioauto/collaborators")
    public ResponseEntity<List<CollaboratorResponse>> listCollaborators() {
        UUID companyId = currentUser.companyId();
        Map<UUID, Team> teamsById = listTeamsById(companyId);
        var data = users.findAllByCompanyId(companyId).stream()
                .filter(User::isActive)
                .map(user -> new CollaboratorResponse(
                        user.id(),
                        user.fullName(),
                        user.email(),
                        user.teamId(),
                        teamsById.containsKey(user.teamId()) ? teamsById.get(user.teamId()).name() : null
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/ioauto/crm/leads")
    public ResponseEntity<List<LeadResponse>> listLeads() {
        UUID companyId = currentUser.companyId();
        requireCurrentUser(companyId);
        Map<UUID, Team> teamsById = listTeamsById(companyId);
        var deduplicated = conversations.findAllByCompanyIdOrderByLastMessageAtDescUpdatedAtDesc(companyId).stream()
                .filter(conversation -> isSupportedLeadSource(conversation.getSourcePlatform()))
                .collect(java.util.stream.Collectors.toMap(
                        this::leadDeduplicationKey,
                        conversation -> conversation,
                        (first, second) -> compareRecency(first, second) >= 0 ? first : second,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .toList();

        var conversationIds = deduplicated.stream().map(JpaAtendimentoConversationEntity::getId).toList();
        Map<UUID, JpaAtendimentoMessageEntity> lastMessageByConversationId = new LinkedHashMap<>();
        Map<UUID, IoAutoSalesLeadLifecycleService.LeadSessionSummary> sessionSummaryByConversationId =
                salesLeadLifecycleService.summarizeLatestLeadSessions(companyId, conversationIds);
        if (!conversationIds.isEmpty()) {
            for (JpaAtendimentoMessageEntity message : messages.findLatestByConversationIds(companyId, conversationIds)) {
                lastMessageByConversationId.merge(
                        message.getConversationId(),
                        message,
                        (current, candidate) -> candidate.getId().compareTo(current.getId()) > 0 ? candidate : current
                );
            }
        }

        var data = deduplicated.stream()
                .map(conversation -> toResponse(
                        conversation,
                        teamsById,
                        lastMessageByConversationId.get(conversation.getId()),
                        0L,
                        sessionSummaryByConversationId.get(conversation.getId())
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    private LeadResponse toResponse(
            JpaAtendimentoConversationEntity conversation,
            Map<UUID, Team> teamsById,
            JpaAtendimentoMessageEntity lastMessage,
            long unreadCount,
            IoAutoSalesLeadLifecycleService.LeadSessionSummary session
    ) {
        return new LeadResponse(
                conversation.getId(),
                conversation.getPhone(),
                conversation.getDisplayName(),
                conversation.getContactDisplayPhone(),
                conversation.getContactDescription(),
                conversation.getContactPhotoUrl(),
                conversation.getSourcePlatform(),
                conversation.getSourceReference(),
                conversation.getStatus(),
                conversation.getAssignedTeamId(),
                conversation.getAssignedTeamId() != null && teamsById.containsKey(conversation.getAssignedTeamId())
                        ? teamsById.get(conversation.getAssignedTeamId()).name()
                        : null,
                conversation.getAssignedUserId(),
                conversation.getAssignedUserName(),
                conversation.getLastMessageText(),
                conversation.getLastMessageAt(),
                lastMessage != null ? lastMessage.isFromMe() : null,
                lastMessage != null ? lastMessage.getStatus() : null,
                lastMessage != null ? normalizeMessageType(lastMessage.getMessageType(), conversation.getLastMessageText()) : null,
                lastMessage != null ? lastMessage.getId() : null,
                unreadCount,
                session != null ? session.sessionId() : null,
                session != null ? session.arrivedAt() : null,
                session != null ? session.firstResponseAt() : null,
                session != null ? session.completedAt() : null,
                session != null ? session.saleCompleted() : null,
                session != null ? session.soldVehicleId() : null,
                session != null ? session.soldVehicleTitle() : null,
                session != null ? session.saleCompletedAt() : null,
                session != null ? session.latestCompletedAt() : null,
                session != null ? session.latestCompletedSaleCompleted() : null,
                session != null ? session.latestCompletedSoldVehicleId() : null,
                session != null ? session.latestCompletedSoldVehicleTitle() : null,
                session == null
                        ? List.of()
                        : session.labels().stream()
                                .map(label -> new LeadLabelResponse(label.id(), label.title(), label.color()))
                                .toList()
        );
    }

    private User requireCurrentUser(UUID companyId) {
        return users.findByIdAndCompanyId(currentUser.userId(), companyId)
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuário não encontrado"));
    }

    private Map<UUID, Team> listTeamsById(UUID companyId) {
        return teams.findAllByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(Team::id, team -> team));
    }

    private boolean isSupportedLeadSource(String sourcePlatform) {
        String normalized = trimToNull(sourcePlatform);
        if (normalized == null) return true;
        String upper = normalized.toUpperCase(Locale.ROOT);
        return !"LEGACY_CHANNEL".equals(upper) && !"WHATSAPP".equals(upper) && !"SYSTEM_SALE".equals(upper);
    }

    private String leadDeduplicationKey(JpaAtendimentoConversationEntity conversation) {
        String lid = normalizeLid(conversation.getContactLid());
        if (lid != null) return "lid:" + lid;
        return "phone:" + canonicalPhone(conversation.getPhone());
    }

    private int compareRecency(JpaAtendimentoConversationEntity first, JpaAtendimentoConversationEntity second) {
        Instant firstLast = first.getLastMessageAt();
        Instant secondLast = second.getLastMessageAt();
        if (firstLast != null && secondLast != null) {
            int comparison = firstLast.compareTo(secondLast);
            if (comparison != 0) return comparison;
        } else if (firstLast != null) {
            return 1;
        } else if (secondLast != null) {
            return -1;
        }
        Instant firstUpdated = first.getUpdatedAt();
        Instant secondUpdated = second.getUpdatedAt();
        if (firstUpdated != null && secondUpdated != null) return firstUpdated.compareTo(secondUpdated);
        if (firstUpdated != null) return 1;
        if (secondUpdated != null) return -1;
        return 0;
    }

    private String normalizeMessageType(String messageType, String messageText) {
        if (trimToNull(messageText) != null) return "text";
        String normalizedType = trimToNull(messageType);
        return normalizedType == null ? "text" : normalizedType;
    }

    private static String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    private static String normalizeLid(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) return null;
        String digits = trimmed.toLowerCase(Locale.ROOT).replace("@lid", "").replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private static String canonicalPhone(String phone) {
        String normalized = normalizePhone(phone);
        if (normalized.isBlank()) return normalized;
        if (!normalized.startsWith("55") && (normalized.length() == 10 || normalized.length() == 11)) {
            normalized = "55" + normalized;
        }
        if (normalized.startsWith("55") && normalized.length() == 13 && normalized.charAt(4) == '9') {
            return normalized.substring(0, 4) + normalized.substring(5);
        }
        return normalized;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record CollaboratorResponse(UUID id, String fullName, String email, UUID teamId, String teamName) {}

    public record LeadLabelResponse(String id, String title, String color) {}

    public record LeadResponse(
            UUID id,
            String phone,
            String displayName,
            String contactDisplayPhone,
            String contactDescription,
            String photoUrl,
            String sourcePlatform,
            String sourceReference,
            String status,
            UUID assignedTeamId,
            String assignedTeamName,
            UUID assignedUserId,
            String assignedUserName,
            String lastMessage,
            Instant lastAt,
            Boolean lastMessageFromMe,
            String lastMessageStatus,
            String lastMessageType,
            UUID lastMessageId,
            long unreadCount,
            UUID sessionId,
            Instant arrivedAt,
            Instant firstResponseAt,
            Instant completedAt,
            Boolean saleCompleted,
            UUID soldVehicleId,
            String soldVehicleTitle,
            Instant saleCompletedAt,
            Instant latestCompletedAt,
            Boolean latestCompletedSaleCompleted,
            UUID latestCompletedSoldVehicleId,
            String latestCompletedSoldVehicleTitle,
            List<LeadLabelResponse> labels
    ) {}
}
