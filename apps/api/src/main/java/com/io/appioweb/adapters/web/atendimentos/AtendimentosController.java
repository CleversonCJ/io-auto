package com.io.appioweb.adapters.web.atendimentos;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.io.appioweb.adapters.persistence.aiagents.AiAgentKanbanMoveAttemptRepositoryJpa;
import com.io.appioweb.adapters.persistence.aiagents.AiAgentKanbanStateRepositoryJpa;
import com.io.appioweb.adapters.persistence.aiagents.AiAgentRunLogRepositoryJpa;
import com.io.appioweb.adapters.persistence.googlecalendar.AiAgentCalendarSuggestionStateRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoClassificationResult;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoMessageRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoMessageEntity;
import com.io.appioweb.adapters.web.aiagents.AiAgentOrchestrationService;
import com.io.appioweb.adapters.web.aiagents.kanban.KanbanMoveDecisionService;
import com.io.appioweb.adapters.web.aiagents.request.AiAgentOrchestrateHttpRequest;
import com.io.appioweb.adapters.web.aisupervisors.SupervisorRoutingService;
import com.io.appioweb.adapters.web.atendimentos.request.ConcludeConversationHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.CreateManualConversationHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.UpdateConversationLabelsHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.SendAudioHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.SendDocumentHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.SendImageHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.SendTextHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.SendVideoHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.request.TransferConversationHttpRequest;
import com.io.appioweb.adapters.web.atendimentos.response.AtendimentoTeamHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.AtendimentoUserHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.ConversationHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.CreateConversationHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.ConversationLabelHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.MessageHttpResponse;
import com.io.appioweb.adapters.web.atendimentos.response.SendTextHttpResponse;
import com.io.appioweb.adapters.web.ioauto.IoAutoSaleCalculationService;
import com.io.appioweb.adapters.web.ioauto.IoAutoSalesService;
import com.io.appioweb.application.superadmin.FeatureUsageService;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.Company;
import com.io.appioweb.domain.auth.entity.Team;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.realtime.RealtimeGateway;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
public class AtendimentosController {

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Logger log = LoggerFactory.getLogger(AtendimentosController.class);
    private final Map<String, String> autoReplyDebounceTokens = new ConcurrentHashMap<>();

    private final CompanyRepositoryPort companies;
    private final CurrentUserPort currentUser;
    private final UserRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final AiAgentRunLogRepositoryJpa aiAgentRunLogs;
    private final AiAgentKanbanMoveAttemptRepositoryJpa aiAgentKanbanMoveAttempts;
    private final AiAgentKanbanStateRepositoryJpa aiAgentKanbanStates;
    private final AiAgentCalendarSuggestionStateRepositoryJpa aiAgentCalendarSuggestionStates;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final AtendimentoMessageRepositoryJpa messages;
    private final RealtimeGateway realtime;
    private final AtendimentoSessionLifecycleService sessionLifecycleService;
    private final AiAgentOrchestrationService aiAgentOrchestration;
    private final KanbanMoveDecisionService kanbanMoveDecisionService;
    private final SupervisorRoutingService supervisorRoutingService;
    private final IoAutoSalesService ioAutoSalesService;
    private final FeatureUsageService featureUsageService;

    public AtendimentosController(
            CompanyRepositoryPort companies,
            CurrentUserPort currentUser,
            UserRepositoryPort users,
            TeamRepositoryPort teams,
            AiAgentRunLogRepositoryJpa aiAgentRunLogs,
            AiAgentKanbanMoveAttemptRepositoryJpa aiAgentKanbanMoveAttempts,
            AiAgentKanbanStateRepositoryJpa aiAgentKanbanStates,
            AiAgentCalendarSuggestionStateRepositoryJpa aiAgentCalendarSuggestionStates,
            AtendimentoConversationRepositoryJpa conversations,
            AtendimentoMessageRepositoryJpa messages,
            RealtimeGateway realtime,
            AtendimentoSessionLifecycleService sessionLifecycleService,
            AiAgentOrchestrationService aiAgentOrchestration,
            KanbanMoveDecisionService kanbanMoveDecisionService,
            SupervisorRoutingService supervisorRoutingService,
            IoAutoSalesService ioAutoSalesService,
            FeatureUsageService featureUsageService
    ) {
        this.companies = companies;
        this.currentUser = currentUser;
        this.users = users;
        this.teams = teams;
        this.aiAgentRunLogs = aiAgentRunLogs;
        this.aiAgentKanbanMoveAttempts = aiAgentKanbanMoveAttempts;
        this.aiAgentKanbanStates = aiAgentKanbanStates;
        this.aiAgentCalendarSuggestionStates = aiAgentCalendarSuggestionStates;
        this.conversations = conversations;
        this.messages = messages;
        this.realtime = realtime;
        this.sessionLifecycleService = sessionLifecycleService;
        this.aiAgentOrchestration = aiAgentOrchestration;
        this.kanbanMoveDecisionService = kanbanMoveDecisionService;
        this.supervisorRoutingService = supervisorRoutingService;
        this.ioAutoSalesService = ioAutoSalesService;
        this.featureUsageService = featureUsageService;
    }

    @GetMapping("/atendimentos/users")
    public ResponseEntity<List<AtendimentoUserHttpResponse>> listAtendimentoUsers() {
        UUID companyId = currentUser.companyId();
        Map<UUID, Team> teamsById = listTeamsById(companyId);
        var data = users.findAllByCompanyId(companyId).stream()
                .filter(user -> user.isActive())
                .map(user -> new AtendimentoUserHttpResponse(
                        user.id(),
                        user.fullName(),
                        user.email(),
                        user.teamId(),
                        teamsById.containsKey(user.teamId()) ? teamsById.get(user.teamId()).name() : null
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/atendimentos/teams")
    public ResponseEntity<List<AtendimentoTeamHttpResponse>> listAtendimentoTeams() {
        UUID companyId = currentUser.companyId();
        var data = teams.findAllByCompanyId(companyId).stream()
                .map(team -> new AtendimentoTeamHttpResponse(team.id(), team.name()))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PostMapping("/atendimentos/conversations/manual")
    public ResponseEntity<CreateConversationHttpResponse> createManualConversation(@Valid @RequestBody CreateManualConversationHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        UUID companyId = currentUser.companyId();
        String phone = normalizePhone(req.phone());
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }
        User actor = requireCurrentOperator(companyId);
        ResolvedConversationAssignment assignment = resolveConversationAssignment(companyId, req.teamId(), req.assignedUserId(), actor);

        var conversation = resolveConversation(companyId, phone, phone);
        Instant now = Instant.now();
        assignConversation(conversation, assignment, now);
        conversations.saveAndFlush(conversation);
        sessionLifecycleService.ensureSessionForHumanAction(
                companyId,
                conversation,
                now,
                assignment.team().id(),
                assignment.team().name(),
                assignment.user() == null ? null : assignment.user().id(),
                assignment.user() == null ? null : assignment.user().fullName(),
                assignment.user() != null
        );
        realtime.conversationChanged(companyId, conversation.getId());

        return ResponseEntity.ok(new CreateConversationHttpResponse(conversation.getId()));
    }

    @GetMapping("/atendimentos/conversations")
    public ResponseEntity<List<ConversationHttpResponse>> listConversations() {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        Map<UUID, Team> teamsById = listTeamsById(companyId);
        var deduped = conversations.findAllByCompanyIdOrderByLastMessageAtDescUpdatedAtDesc(companyId).stream()
                .filter(conversation -> isSupportedConversationSource(conversation.getSourcePlatform()))
                .filter(conversation -> canAccessConversation(actor, conversation))
                .collect(java.util.stream.Collectors.toMap(
                        this::conversationDedupKey,
                        c -> c,
                        (a, b) -> compareConversationRecency(a, b) >= 0 ? a : b,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .toList();

        var conversationIds = deduped.stream().map(JpaAtendimentoConversationEntity::getId).toList();
        Map<UUID, JpaAtendimentoMessageEntity> lastMessageByConversationId = new LinkedHashMap<>();
        Map<UUID, AtendimentoSessionLifecycleService.ConversationSessionSummary> sessionSummaryByConversationId =
                sessionLifecycleService.summarizeLatestSessions(companyId, conversationIds);
        if (!conversationIds.isEmpty()) {
            var conversationMessages = messages.findAllByConversationIdInAndCompanyIdOrderByCreatedAtAsc(conversationIds, companyId);
            for (JpaAtendimentoMessageEntity message : conversationMessages) {
                lastMessageByConversationId.put(message.getConversationId(), message);
            }
        }

        var data = deduped.stream()
                .map(c -> {
                    JpaAtendimentoMessageEntity lastMessage = lastMessageByConversationId.get(c.getId());
                    AtendimentoSessionLifecycleService.ConversationSessionSummary session = sessionSummaryByConversationId.get(c.getId());
                    return new ConversationHttpResponse(
                            c.getId(),
                            c.getPhone(),
                            c.getDisplayName(),
                            c.getContactPhotoUrl(),
                            c.getSourcePlatform(),
                            c.getSourceReference(),
                            c.getStatus(),
                            c.getAssignedTeamId(),
                            c.getAssignedTeamId() != null && teamsById.containsKey(c.getAssignedTeamId()) ? teamsById.get(c.getAssignedTeamId()).name() : null,
                            c.getAssignedUserId(),
                            c.getAssignedUserName(),
                            c.getAssignedAgentId(),
                            c.isHumanHandoffRequested(),
                            c.getHumanHandoffQueue(),
                            c.isHumanUserChoiceRequired(),
                            c.getStartedAt(),
                            c.getPresenceStatus(),
                            c.getPresenceLastSeen(),
                            c.getLastMessageText(),
                            c.getLastMessageAt(),
                            lastMessage != null ? lastMessage.isFromMe() : null,
                            lastMessage != null ? lastMessage.getStatus() : null,
                            lastMessage != null
                                    ? normalizePersistedMessageType(lastMessage.getMessageType(), c.getLastMessageText())
                                    : null,
                            session != null ? session.sessionId() : null,
                            session != null ? session.arrivedAt() : null,
                            session != null ? session.firstResponseAt() : null,
                            session != null ? session.completedAt() : null,
                            session != null && session.classificationResult() != null ? session.classificationResult().name() : null,
                            session != null ? session.classificationLabel() : null,
                            session != null ? session.saleCompleted() : null,
                            session != null ? session.soldVehicleId() : null,
                            session != null ? session.soldVehicleTitle() : null,
                            session != null ? session.saleCompletedAt() : null,
                            session != null ? session.latestCompletedAt() : null,
                            session != null && session.latestCompletedClassificationResult() != null ? session.latestCompletedClassificationResult().name() : null,
                            session != null ? session.latestCompletedClassificationLabel() : null,
                            session != null ? session.latestCompletedSaleCompleted() : null,
                            session != null ? session.latestCompletedSoldVehicleId() : null,
                            session != null ? session.latestCompletedSoldVehicleTitle() : null,
                            session == null
                                    ? List.of()
                                    : session.labels().stream()
                                            .map(label -> new ConversationLabelHttpResponse(label.id(), label.title(), label.color()))
                                            .toList()
                    );
                })
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/atendimentos/conversations/{conversationId}/messages")
    public ResponseEntity<List<MessageHttpResponse>> listMessages(@PathVariable UUID conversationId) {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(actor, conversation);

        List<String> equivalentPhones = equivalentPhones(conversation.getPhone());
        List<UUID> conversationIds = conversations.findAllByCompanyIdAndPhoneIn(companyId, equivalentPhones).stream()
                .filter(item -> canAccessConversation(actor, item))
                .map(JpaAtendimentoConversationEntity::getId)
                .toList();
        if (conversationIds.isEmpty()) {
            conversationIds = List.of(conversation.getId());
        }

        var data = messages.findAllByConversationIdInAndCompanyIdOrderByCreatedAtAsc(conversationIds, companyId).stream()
                .map(m -> new MessageHttpResponse(
                        m.getId(),
                        conversation.getId(),
                        m.getPhone(),
                        m.getMessageText(),
                        normalizePersistedMessageType(m.getMessageType(), m.getMessageText()),
                        extractImageUrl(m.getPayloadJson()),
                        extractStickerUrl(m.getPayloadJson()),
                        extractVideoUrl(m.getPayloadJson()),
                        extractAudioUrl(m.getPayloadJson()),
                        extractDocumentUrl(m.getPayloadJson()),
                        extractDocumentName(m.getPayloadJson()),
                        m.isFromMe(),
                        m.getStatus(),
                        m.getZapiMessageId(),
                        m.getMoment(),
                        m.getCreatedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PostMapping("/atendimentos/conversations/{conversationId}/start")
    public ResponseEntity<Void> startConversation(@PathVariable UUID conversationId) {
        UUID companyId = currentUser.companyId();
        User current = requireCurrentOperator(companyId);

        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(current, conversation);

        Instant now = Instant.now();
        assignConversation(conversation, new ResolvedConversationAssignment(resolveTeam(companyId, current.teamId()), current), now);
        conversations.saveAndFlush(conversation);
        sessionLifecycleService.ensureSessionForHumanAction(
                companyId,
                conversation,
                now,
                current.teamId(),
                resolveTeam(companyId, current.teamId()).name(),
                current.id(),
                current.fullName(),
                true
        );
        realtime.conversationChanged(companyId, conversation.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/atendimentos/conversations/{conversationId}/transfer")
    public ResponseEntity<Void> transferConversation(@PathVariable UUID conversationId, @Valid @RequestBody TransferConversationHttpRequest req) {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        ResolvedConversationAssignment assignment = resolveConversationAssignment(companyId, req.teamId(), req.targetUserId(), actor);

        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(actor, conversation);

        Instant now = Instant.now();
        assignConversation(conversation, assignment, now);
        conversations.saveAndFlush(conversation);
        sessionLifecycleService.ensureSessionForHumanAction(
                companyId,
                conversation,
                now,
                assignment.team().id(),
                assignment.team().name(),
                assignment.user() == null ? null : assignment.user().id(),
                assignment.user() == null ? null : assignment.user().fullName(),
                assignment.user() != null
        );
        realtime.conversationChanged(companyId, conversation.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/atendimentos/conversations/{conversationId}/conclude")
    public ResponseEntity<Void> concludeConversation(@PathVariable UUID conversationId, @Valid @RequestBody ConcludeConversationHttpRequest req) {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(actor, conversation);

        AtendimentoClassificationResult classificationResult = parseClassificationResult(req.classificationResult());
        Instant now = Instant.now();
        ResolvedSaleSeller saleSeller = null;
        if (Boolean.TRUE.equals(req.saleCompleted())) {
            saleSeller = resolveSaleSeller(companyId, req.sellerUserId());
            conversation.setAssignedTeamId(saleSeller.team() == null ? null : saleSeller.team().id());
            conversation.setAssignedUserId(saleSeller.user().id());
            conversation.setAssignedUserName(saleSeller.user().fullName());
            if (conversation.getStartedAt() == null) {
                conversation.setStartedAt(now);
            }
        }
        var session = sessionLifecycleService.concludeConversation(
                companyId,
                conversation,
                classificationResult,
                req.classificationLabel(),
                req.labels(),
                now
        );
        if (Boolean.TRUE.equals(req.saleCompleted())) {
            if (req.soldVehicleId() == null) {
                throw new BusinessException("ATENDIMENTO_SALE_VEHICLE_REQUIRED", "Selecione o veículo vendido para concluir a venda.");
            }
            if (classificationResult != AtendimentoClassificationResult.OBJECTIVE_ACHIEVED) {
                throw new BusinessException("ATENDIMENTO_SALE_INVALID_CLASSIFICATION", "Venda concluída deve usar uma classificação de objetivo alcançado.");
            }
            String saleOriginPlatform = normalizeSaleOriginPlatform(req.saleOriginPlatform(), conversation.getSourcePlatform());
            if (saleOriginPlatform == null) {
                throw new BusinessException("ATENDIMENTO_SALE_ORIGIN_REQUIRED", "Informe a origem da venda para concluir o atendimento.");
            }
            ioAutoSalesService.registerCompletedSale(
                    companyId,
                    session,
                    req.soldVehicleId(),
                    now,
                    saleOriginPlatform,
                    saleSeller == null ? null : saleSeller.user().id(),
                    saleSeller == null ? null : saleSeller.user().fullName(),
                    saleSeller == null || saleSeller.team() == null ? null : saleSeller.team().id(),
                    saleSeller == null || saleSeller.team() == null ? null : saleSeller.team().name(),
                    IoAutoSaleCalculationService.SaleClosingCommand.empty()
            );
            featureUsageService.registerUsage(
                    companyId,
                    FeatureUsageService.FEATURE_SALES_MANAGEMENT,
                    Map.of("action", "REGISTER_SALE", "saleOriginPlatform", saleOriginPlatform)
            );
        }
        conversation.setUpdatedAt(now);
        conversations.saveAndFlush(conversation);
        realtime.conversationChanged(companyId, conversation.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/atendimentos/conversations/{conversationId}/labels")
    public ResponseEntity<Void> updateConversationLabels(@PathVariable UUID conversationId, @Valid @RequestBody UpdateConversationLabelsHttpRequest req) {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(actor, conversation);

        Instant now = Instant.now();
        sessionLifecycleService.updateConversationLabels(companyId, conversationId, req.labels(), now);
        conversation.setUpdatedAt(now);
        conversations.saveAndFlush(conversation);
        realtime.conversationChanged(companyId, conversation.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/atendimentos/conversations/{conversationId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteConversation(@PathVariable UUID conversationId) {
        UUID companyId = currentUser.companyId();
        User actor = requireCurrentOperator(companyId);
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_CONVERSATION_NOT_FOUND", "Conversa nao encontrada"));
        assertConversationAccessible(actor, conversation);

        List<JpaAtendimentoConversationEntity> relatedConversations = resolveConversationDeletionTargets(companyId, conversation);
        List<UUID> relatedConversationIds = relatedConversations.stream()
                .map(JpaAtendimentoConversationEntity::getId)
                .distinct()
                .toList();

        if (!relatedConversationIds.isEmpty()) {
            aiAgentCalendarSuggestionStates.deleteAllByCompanyIdAndConversationIdIn(companyId, relatedConversationIds);
            aiAgentKanbanStates.deleteAllByCompanyIdAndConversationIdIn(companyId, relatedConversationIds);
            aiAgentKanbanMoveAttempts.deleteAllByCompanyIdAndConversationIdIn(companyId, relatedConversationIds);
            aiAgentRunLogs.deleteAllByCompanyIdAndConversationIdIn(companyId, relatedConversationIds);
            conversations.deleteAllInBatch(relatedConversations);
        }

        for (UUID deletedConversationId : relatedConversationIds) {
            realtime.conversationChanged(companyId, deletedConversationId);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/atendimentos/send-text")
    public ResponseEntity<SendTextHttpResponse> sendText(@Valid @RequestBody SendTextHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        var company = companies.findById(currentUser.companyId())
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

        String phone = req.phone().replaceAll("\\D", "");
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }

        String message = req.message().trim();
        if (message.isBlank()) {
            throw new BusinessException("ATENDIMENTO_EMPTY_MESSAGE", "Mensagem nao pode ser vazia");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", phone);
        payload.put("message", message);
        if (req.delayMessage() != null) payload.put("delayMessage", req.delayMessage());
        payload.put("delayTyping", req.delayTyping() != null ? req.delayTyping() : 5);
        if (req.editMessageId() != null && !req.editMessageId().isBlank()) payload.put("editMessageId", req.editMessageId().trim());

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-text".formatted(
                encode(company.zapiInstanceId()),
                encode(company.zapiInstanceToken())
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", company.zapiClientToken())
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_REQUEST_ERROR", "Erro ao montar requisicao de envio");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_SEND_INTERRUPTED", "Envio interrompido");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_SEND_FAILED", "Falha na comunicacao com a Z-API");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException(
                    "ATENDIMENTO_SEND_FAILED",
                    "Falha ao enviar mensagem pela Z-API (status " + response.statusCode() + "): " + extractErrorMessage(response.body())
            );
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String zaapId = asString(zapiData.get("zaapId"));
            String messageId = asString(zapiData.get("messageId"));
            String id = asString(zapiData.get("id"));

            UUID conversationId = persistMessage(
                    company.id(),
                    phone,
                    null,
                    null,
                    null,
                    message,
                    "text",
                    true,
                    messageId,
                    "SENT",
                    null,
                    null
            );
            sessionLifecycleService.markFirstHumanResponse(company.id(), conversationId, currentUser.userId(), Instant.now());

            return ResponseEntity.ok(new SendTextHttpResponse(conversationId, zaapId, messageId, id));
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_INVALID_RESPONSE", "Resposta invalida da Z-API");
        }
    }

    @PostMapping("/atendimentos/send-image")
    public ResponseEntity<SendTextHttpResponse> sendImage(@Valid @RequestBody SendImageHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        var company = companies.findById(currentUser.companyId())
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

        String phone = req.phone().replaceAll("\\D", "");
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }

        String image = req.image().trim();
        if (image.isBlank()) {
            throw new BusinessException("ATENDIMENTO_EMPTY_IMAGE", "Imagem obrigatoria");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", phone);
        payload.put("image", image);
        if (trimToNull(req.caption()) != null) payload.put("caption", req.caption().trim());
        if (req.delayMessage() != null) payload.put("delayMessage", req.delayMessage());
        if (req.viewOnce() != null) payload.put("viewOnce", req.viewOnce());
        if (trimToNull(req.messageId()) != null) payload.put("messageId", req.messageId().trim());

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-image".formatted(
                encode(company.zapiInstanceId()),
                encode(company.zapiInstanceToken())
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", company.zapiClientToken())
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_REQUEST_ERROR", "Erro ao montar requisicao de envio");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_SEND_INTERRUPTED", "Envio interrompido");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_SEND_FAILED", "Falha na comunicacao com a Z-API");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException(
                    "ATENDIMENTO_SEND_FAILED",
                    "Falha ao enviar imagem pela Z-API (status " + response.statusCode() + "): " + extractErrorMessage(response.body())
            );
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String zaapId = asString(zapiData.get("zaapId"));
            String messageId = asString(zapiData.get("messageId"));
            String id = asString(zapiData.get("id"));

            String normalizedCaption = trimToNull(req.caption());
            String storedText = normalizedCaption != null ? normalizedCaption : "[Imagem]";
            String outgoingPayload = safeJson(Map.of(
                    "image", Map.of("imageUrl", image)
            ));
            UUID conversationId = persistMessage(
                    company.id(),
                    phone,
                    null,
                    null,
                    null,
                    storedText,
                    "image",
                    true,
                    messageId,
                    "SENT",
                    null,
                    outgoingPayload
            );
            sessionLifecycleService.markFirstHumanResponse(company.id(), conversationId, currentUser.userId(), Instant.now());

            return ResponseEntity.ok(new SendTextHttpResponse(conversationId, zaapId, messageId, id));
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_INVALID_RESPONSE", "Resposta invalida da Z-API");
        }
    }

    @PostMapping("/atendimentos/send-video")
    public ResponseEntity<SendTextHttpResponse> sendVideo(@Valid @RequestBody SendVideoHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        var company = companies.findById(currentUser.companyId())
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

        String phone = req.phone().replaceAll("\\D", "");
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }

        String video = req.video().trim();
        if (video.isBlank()) {
            throw new BusinessException("ATENDIMENTO_EMPTY_VIDEO", "Video obrigatorio");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", phone);
        payload.put("video", video);
        if (trimToNull(req.caption()) != null) payload.put("caption", req.caption().trim());
        if (req.delayMessage() != null) payload.put("delayMessage", req.delayMessage());
        if (req.viewOnce() != null) payload.put("viewOnce", req.viewOnce());
        if (trimToNull(req.messageId()) != null) payload.put("messageId", req.messageId().trim());
        if (req.asyncSend() != null) payload.put("async", req.asyncSend());

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-video".formatted(
                encode(company.zapiInstanceId()),
                encode(company.zapiInstanceToken())
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", company.zapiClientToken())
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_REQUEST_ERROR", "Erro ao montar requisicao de envio");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_SEND_INTERRUPTED", "Envio interrompido");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_SEND_FAILED", "Falha na comunicacao com a Z-API");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException(
                    "ATENDIMENTO_SEND_FAILED",
                    "Falha ao enviar video pela Z-API (status " + response.statusCode() + "): " + extractErrorMessage(response.body())
            );
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String zaapId = asString(zapiData.get("zaapId"));
            String messageId = asString(zapiData.get("messageId"));
            String id = asString(zapiData.get("id"));

            String normalizedCaption = trimToNull(req.caption());
            String storedText = normalizedCaption != null ? normalizedCaption : "[Video]";
            String outgoingPayload = safeJson(Map.of(
                    "video", Map.of("videoUrl", video)
            ));
            UUID conversationId = persistMessage(
                    company.id(),
                    phone,
                    null,
                    null,
                    null,
                    storedText,
                    "video",
                    true,
                    messageId,
                    "SENT",
                    null,
                    outgoingPayload
            );
            sessionLifecycleService.markFirstHumanResponse(company.id(), conversationId, currentUser.userId(), Instant.now());

            return ResponseEntity.ok(new SendTextHttpResponse(conversationId, zaapId, messageId, id));
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_INVALID_RESPONSE", "Resposta invalida da Z-API");
        }
    }

    @PostMapping("/atendimentos/send-audio")
    public ResponseEntity<SendTextHttpResponse> sendAudio(@Valid @RequestBody SendAudioHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        var company = companies.findById(currentUser.companyId())
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

        String phone = req.phone().replaceAll("\\D", "");
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }

        String audio = req.audio().trim();
        if (audio.isBlank()) {
            throw new BusinessException("ATENDIMENTO_EMPTY_AUDIO", "Audio obrigatorio");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", phone);
        payload.put("audio", audio);
        if (req.delayMessage() != null) payload.put("delayMessage", req.delayMessage());
        if (req.delayTyping() != null) payload.put("delayTyping", req.delayTyping());
        if (req.viewOnce() != null) payload.put("viewOnce", req.viewOnce());
        if (req.waveform() != null) payload.put("waveform", req.waveform());
        payload.put("async", req.asyncSend() != null ? req.asyncSend() : true);

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-audio".formatted(
                encode(company.zapiInstanceId()),
                encode(company.zapiInstanceToken())
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", company.zapiClientToken())
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_REQUEST_ERROR", "Erro ao montar requisicao de envio");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_SEND_INTERRUPTED", "Envio interrompido");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_SEND_FAILED", "Falha na comunicacao com a Z-API");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException(
                    "ATENDIMENTO_SEND_FAILED",
                    "Falha ao enviar audio pela Z-API (status " + response.statusCode() + "): " + extractErrorMessage(response.body())
            );
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String zaapId = asString(zapiData.get("zaapId"));
            String messageId = asString(zapiData.get("messageId"));
            String id = asString(zapiData.get("id"));

            String outgoingPayload = safeJson(Map.of(
                    "audio", Map.of("audioUrl", audio)
            ));
            UUID conversationId = persistMessage(
                    company.id(),
                    phone,
                    null,
                    null,
                    null,
                    "[Audio]",
                    "audio",
                    true,
                    messageId,
                    "SENT",
                    null,
                    outgoingPayload
            );
            sessionLifecycleService.markFirstHumanResponse(company.id(), conversationId, currentUser.userId(), Instant.now());

            return ResponseEntity.ok(new SendTextHttpResponse(conversationId, zaapId, messageId, id));
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_INVALID_RESPONSE", "Resposta invalida da Z-API");
        }
    }

    @PostMapping("/atendimentos/send-document")
    public ResponseEntity<SendTextHttpResponse> sendDocument(@Valid @RequestBody SendDocumentHttpRequest req) {
        if (whatsappChannelRemoved()) {
            throw removedWhatsAppChannelException();
        }
        var company = companies.findById(currentUser.companyId())
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

        String phone = req.phone().replaceAll("\\D", "");
        if (phone.isBlank()) {
            throw new BusinessException("ATENDIMENTO_INVALID_PHONE", "Telefone invalido");
        }

        String document = req.document().trim();
        if (document.isBlank()) {
            throw new BusinessException("ATENDIMENTO_EMPTY_DOCUMENT", "Documento obrigatorio");
        }

        String extension = normalizeDocumentExtension(req.extension());
        if (extension == null) {
            throw new BusinessException("ATENDIMENTO_INVALID_DOCUMENT_EXTENSION", "Extensao do documento obrigatoria");
        }

        String normalizedFileName = trimToNull(req.fileName());
        String normalizedCaption = trimToNull(req.caption());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", phone);
        payload.put("document", document);
        if (normalizedFileName != null) payload.put("fileName", normalizedFileName);
        if (normalizedCaption != null) payload.put("caption", normalizedCaption);
        if (req.delayMessage() != null) payload.put("delayMessage", req.delayMessage());
        if (trimToNull(req.messageId()) != null) payload.put("messageId", req.messageId().trim());

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-document/%s".formatted(
                encode(company.zapiInstanceId()),
                encode(company.zapiInstanceToken()),
                encode(extension)
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", company.zapiClientToken())
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_REQUEST_ERROR", "Erro ao montar requisicao de envio");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_SEND_INTERRUPTED", "Envio interrompido");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_SEND_FAILED", "Falha na comunicacao com a Z-API");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException(
                    "ATENDIMENTO_SEND_FAILED",
                    "Falha ao enviar documento pela Z-API (status " + response.statusCode() + "): " + extractErrorMessage(response.body())
            );
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String zaapId = asString(zapiData.get("zaapId"));
            String messageId = asString(zapiData.get("messageId"));
            String id = asString(zapiData.get("id"));

            Map<String, Object> outgoingDocument = new LinkedHashMap<>();
            outgoingDocument.put("documentUrl", document);
            if (normalizedFileName != null) {
                outgoingDocument.put("fileName", normalizedFileName);
                outgoingDocument.put("title", normalizedFileName);
            }
            if (normalizedCaption != null) outgoingDocument.put("caption", normalizedCaption);

            String storedText = normalizedCaption != null ? normalizedCaption : normalizedFileName != null ? normalizedFileName : "[Documento]";
            String outgoingPayload = safeJson(Map.of("document", outgoingDocument));
            UUID conversationId = persistMessage(
                    company.id(),
                    phone,
                    null,
                    null,
                    null,
                    storedText,
                    "document",
                    true,
                    messageId,
                    "SENT",
                    null,
                    outgoingPayload
            );
            sessionLifecycleService.markFirstHumanResponse(company.id(), conversationId, currentUser.userId(), Instant.now());

            return ResponseEntity.ok(new SendTextHttpResponse(conversationId, zaapId, messageId, id));
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_INVALID_RESPONSE", "Resposta invalida da Z-API");
        }
    }

    @PostMapping("/webhooks/zapi/{instanceId}/received")
    public ResponseEntity<Void> receiveWebhook(@PathVariable String instanceId, @RequestBody JsonNode body) {
        if (whatsappChannelRemoved()) {
            return ResponseEntity.status(HttpStatus.GONE).build();
        }
        try {
            var company = companies.findByZapiInstanceId(instanceId)
                    .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

            boolean isGroup = body.path("isGroup").asBoolean(false);
            boolean isNewsletter = body.path("isNewsletter").asBoolean(false);
            if (isGroup || isNewsletter) return ResponseEntity.status(HttpStatus.NO_CONTENT).build();

            String rawPhone = firstNonBlank(
                    body.path("phone").asText(null),
                    body.path("chat").path("phone").asText(null),
                    body.path("sender").path("phone").asText(null),
                    body.path("chat").path("id").asText(null),
                    body.path("chatId").asText(null)
            );
            String phone = normalizePhone(rawPhone);
            if (phone.isBlank()) return ResponseEntity.status(HttpStatus.NO_CONTENT).build();

            boolean fromMe = body.path("fromMe").asBoolean(false);
            String messageId = trimToNull(body.path("messageId").asText(null));
            if (messageId != null && messages.findByCompanyIdAndZapiMessageId(company.id(), messageId).isPresent()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }

            String text = extractWebhookText(body);
            String contactName = firstNonBlank(
                    body.path("chatName").asText(null),
                    body.path("senderName").asText(null),
                    body.path("contact").path("displayName").asText(null)
            );
            String contactPhotoUrl = firstNonBlank(
                    body.path("photo").asText(null),
                    body.path("photo").path("url").asText(null),
                    body.path("senderPhoto").asText(null),
                    body.path("senderPhoto").path("url").asText(null),
                    body.path("chat").path("photo").asText(null),
                    body.path("chat").path("image").asText(null),
                    body.path("chat").path("image").path("url").asText(null)
            );
            String contactLid = normalizeLid(firstNonBlank(
                    body.path("chatLid").asText(null),
                    body.path("senderLid").asText(null),
                    body.path("participantLid").asText(null),
                    body.path("chat").path("lid").asText(null),
                    body.path("sender").path("lid").asText(null),
                    body.path("chat").path("id").asText(null),
                    body.path("chatId").asText(null),
                    rawPhone
            ));
            ResolvedContactDetails resolvedContact = resolveWebhookContactDetails(
                    company,
                    phone,
                    contactLid,
                    contactName,
                    contactPhotoUrl,
                    fromMe
            );
            contactName = resolvedContact.name();
            contactPhotoUrl = resolvedContact.photoUrl();
            String messageType = detectMessageType(body, text);
            if ("unknown".equalsIgnoreCase(messageType) && trimToNull(text) == null) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }
            String payloadJson = safeJson(body);
            String status = trimToNull(body.path("status").asText(null));
            Long moment = body.hasNonNull("momment") ? body.path("momment").asLong() : null;

            PersistedMessage persisted = persistMessageDetailed(company.id(), phone, contactLid, contactName, contactPhotoUrl, text, messageType, fromMe, messageId, status, moment, payloadJson);
            if (!fromMe) {
                conversations.findByIdAndCompanyId(persisted.conversationId(), company.id())
                        .ifPresent(conversation -> sessionLifecycleService.touchInboundMessage(company.id(), conversation, toInstant(moment)));
                dispatchAutomaticAgentReplyAsync(
                        company.id(),
                        company.zapiInstanceId(),
                        company.zapiInstanceToken(),
                        company.zapiClientToken(),
                        phone,
                        persisted.conversationId(),
                        persisted.messageId()
                );
            }
            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_WEBHOOK_PROCESS_ERROR", "Falha ao processar webhook: " + rootCauseMessage(ex));
        }
    }

    @PostMapping("/webhooks/zapi/{instanceId}/status")
    public ResponseEntity<Void> receiveMessageStatusWebhook(@PathVariable String instanceId, @RequestBody JsonNode body) {
        if (whatsappChannelRemoved()) {
            return ResponseEntity.status(HttpStatus.GONE).build();
        }
        try {
            var company = companies.findByZapiInstanceId(instanceId)
                    .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

            String status = trimToNull(body.path("status").asText(null));
            Long moment = body.hasNonNull("momment") ? body.path("momment").asLong() : null;
            JsonNode idsNode = body.path("ids");
            if (status == null || !idsNode.isArray()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }

            List<String> ids = new java.util.ArrayList<>();
            for (JsonNode node : idsNode) {
                String id = trimToNull(node.asText(null));
                if (id != null) ids.add(id);
            }
            if (ids.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }

            var mappedMessages = messages.findAllByCompanyIdAndZapiMessageIdIn(company.id(), ids);
            if (mappedMessages.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }

            for (JpaAtendimentoMessageEntity message : mappedMessages) {
                if (shouldUpdateMessageStatus(message.getStatus(), status)) {
                    message.setStatus(status);
                }
                if (moment != null && moment > 0) {
                    message.setMoment(moment);
                }
            }
            messages.saveAllAndFlush(mappedMessages);
            for (JpaAtendimentoMessageEntity message : mappedMessages) {
                realtime.messageChanged(company.id(), message.getConversationId());
            }
            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_STATUS_WEBHOOK_PROCESS_ERROR", "Falha ao processar status webhook: " + rootCauseMessage(ex));
        }
    }

    @PostMapping("/webhooks/zapi/{instanceId}/chat-presence")
    public ResponseEntity<Void> receiveChatPresenceWebhook(@PathVariable String instanceId, @RequestBody JsonNode body) {
        if (whatsappChannelRemoved()) {
            return ResponseEntity.status(HttpStatus.GONE).build();
        }
        try {
            var company = companies.findByZapiInstanceId(instanceId)
                    .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada"));

            String rawPhone = firstNonBlank(
                    body.path("phone").asText(null),
                    body.path("chatId").asText(null),
                    body.path("chat").path("id").asText(null),
                    body.path("chat").path("phone").asText(null),
                    body.path("sender").path("phone").asText(null),
                    body.path("senderPhone").asText(null),
                    body.path("jid").asText(null),
                    body.path("from").asText(null),
                    body.path("to").asText(null)
            );
            String phone = normalizePhone(rawPhone);
            String lid = normalizeLid(firstNonBlank(
                    body.path("chatLid").asText(null),
                    body.path("senderLid").asText(null),
                    body.path("participantLid").asText(null),
                    body.path("lid").asText(null),
                    body.path("chat").path("lid").asText(null),
                    body.path("sender").path("lid").asText(null),
                    body.path("presence").path("lid").asText(null),
                    body.path("chat").path("id").asText(null),
                    body.path("chatId").asText(null),
                    rawPhone
            ));
            if (phone.isBlank() && lid == null) return ResponseEntity.status(HttpStatus.NO_CONTENT).build();

            String status = normalizePresenceStatus(firstNonBlank(
                    body.path("status").asText(null),
                    body.path("chatPresence").path("status").asText(null),
                    body.path("presence").path("status").asText(null),
                    body.path("presenceStatus").asText(null),
                    body.path("type").asText(null),
                    body.path("event").asText(null)
            ));
            JsonNode lastSeenNode = firstPresentNode(
                    body.path("lastSeen"),
                    body.path("lastseen"),
                    body.path("presence").path("lastSeen"),
                    body.path("presence").path("lastseen"),
                    body.path("timestamp"),
                    body.path("ts"),
                    body.path("momment"),
                    body.path("moment")
            );
            Instant lastSeen = parseLastSeen(lastSeenNode);
            if (status == null && lastSeen == null) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }
            Instant now = Instant.now();

            List<JpaAtendimentoConversationEntity> targets = List.of();
            if (!phone.isBlank()) {
                targets = conversations.findAllByCompanyIdAndPhoneIn(company.id(), equivalentPhones(phone));
            }
            if (targets.isEmpty() && lid != null) {
                targets = conversations.findAllByCompanyIdAndContactLid(company.id(), lid);
            }

            if (targets.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
            }

            for (JpaAtendimentoConversationEntity conversation : targets) {
                if (status != null) {
                    conversation.setPresenceStatus(status);
                }
                if (lastSeenNode != null) {
                    conversation.setPresenceLastSeen(lastSeen);
                }
                conversation.setPresenceUpdatedAt(now);
                conversation.setUpdatedAt(now);
            }
            conversations.saveAllAndFlush(targets);
            for (JpaAtendimentoConversationEntity conversation : targets) {
                realtime.conversationChanged(company.id(), conversation.getId());
            }

            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_PRESENCE_WEBHOOK_PROCESS_ERROR", "Falha ao processar presence webhook: " + rootCauseMessage(ex));
        }
    }

    private void triggerAutomaticAgentReply(
            UUID companyId,
            String zapiInstanceId,
            String zapiInstanceToken,
            String zapiClientToken,
            String phone,
            UUID conversationId,
            UUID inboundMessageId
    ) {
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId).orElse(null);
        if (conversation == null) {
            log.debug("Auto-reply skipped: conversation not found companyId={} conversationId={}", companyId, conversationId);
            return;
        }
        if ((conversation.getAssignedUserId() != null || conversation.getAssignedTeamId() != null) && !"NEW".equalsIgnoreCase(trimToNull(conversation.getStatus()))) {
            log.info(
                    "Auto-reply skipped: conversation already routed to human team conversationId={} assignedTeamId={} assignedUserId={}",
                    conversationId,
                    conversation.getAssignedTeamId(),
                    conversation.getAssignedUserId()
            );
            return;
        }

        if (conversation.isHumanHandoffRequested()) {
            log.info("Auto-reply skipped: human handoff already requested conversationId={} queue={}", conversationId, trimToNull(conversation.getHumanHandoffQueue()));
            return;
        }

        String agentIdToUse = trimToNull(conversation.getAssignedAgentId());
        if (agentIdToUse == null) {
            UUID supervisorId = supervisorRoutingService.findDefaultSupervisorId(companyId);
            if (supervisorId != null) {
                var routing = supervisorRoutingService.routeOrTriageLead(companyId, supervisorId, conversationId, inboundMessageId);
                if (routing.humanHandoff()) {
                    log.info("Auto-reply stopped after human handoff conversationId={} evaluationKey={}", conversationId, routing.evaluationKey());
                    return;
                }
                if (routing.askedClarification()) {
                    log.info("Auto-reply stopped after supervisor clarification question conversationId={} evaluationKey={}", conversationId, routing.evaluationKey());
                    return;
                }
                if (routing.assignedAgent()) {
                    agentIdToUse = trimToNull(routing.targetAgentId());
                }
                conversation = conversations.findByIdAndCompanyId(conversationId, companyId).orElse(conversation);
                if (agentIdToUse == null) {
                    agentIdToUse = trimToNull(conversation.getAssignedAgentId());
                }
            }
        }

        var resolvedAgentConfig = trimToNull(agentIdToUse) != null
                ? aiAgentOrchestration.findAgentExecutionConfig(companyId, agentIdToUse)
                : aiAgentOrchestration.findFirstActiveAgentConfig(companyId);
        if (resolvedAgentConfig == null || trimToNull(resolvedAgentConfig.agentId()) == null) {
            log.debug("Auto-reply skipped: no target AI agent found for company={}", companyId);
            return;
        }
        agentIdToUse = resolvedAgentConfig.agentId();
        int delayTypingSeconds = Math.max(0, resolvedAgentConfig.delayTypingSeconds());

        String customerMessage = buildConsolidatedCustomerMessage(companyId, conversationId);
        if (trimToNull(customerMessage) == null) {
            log.debug("Auto-reply skipped: no pending inbound message after debounce conversationId={}", conversationId);
            return;
        }

        evaluateKanbanMoveSafely(companyId, conversationId, agentIdToUse, List.of(), false);

        var result = aiAgentOrchestration.orchestrateForCompany(companyId, new AiAgentOrchestrateHttpRequest(
                conversationId,
                customerMessage,
                agentIdToUse,
                "whatsapp",
                OBJECT_MAPPER.createObjectNode()
        ));
        if (result.toolLogs() != null && !result.toolLogs().isEmpty()) {
            for (var toolLog : result.toolLogs()) {
                if (!"ok".equalsIgnoreCase(trimToNull(toolLog.status()))) {
                    log.warn(
                            "Auto-reply tool failure conversationId={} traceId={} tool={} status={} errorCode={} latencyMs={} retries={}",
                            conversationId,
                            result.traceId(),
                            trimToNull(toolLog.toolName()),
                            trimToNull(toolLog.status()),
                            trimToNull(toolLog.errorCode()),
                            toolLog.latencyMs(),
                            toolLog.retries()
                    );
                } else if ("crm_update_contact_data".equalsIgnoreCase(trimToNull(toolLog.toolName()))) {
                    log.info(
                            "Auto-reply CRM tool success conversationId={} traceId={} latencyMs={} retries={}",
                            conversationId,
                            result.traceId(),
                            toolLog.latencyMs(),
                            toolLog.retries()
                    );
                }
            }
        }

        if (result.handoff()) {
            log.info("Auto-reply handoff requested by customer conversationId={} traceId={}", conversationId, result.traceId());
            return;
        }

        List<String> structuredEvents = extractStructuredKanbanEvents(result.finalText());
        if (!structuredEvents.isEmpty()) {
            evaluateKanbanMoveSafely(companyId, conversationId, agentIdToUse, structuredEvents, true);
        }

        String responseText = trimToNull(result.finalText());
        if (responseText == null) {
            log.debug("Auto-reply skipped: empty final text conversationId={} traceId={}", conversationId, result.traceId());
            return;
        }
        sendAutomaticText(companyId, zapiInstanceId, zapiInstanceToken, zapiClientToken, phone, responseText, delayTypingSeconds);
        log.info("Auto-reply sent conversationId={} traceId={}", conversationId, result.traceId());
    }

    private void dispatchAutomaticAgentReplyAsync(
            UUID companyId,
            String zapiInstanceId,
            String zapiInstanceToken,
        String zapiClientToken,
        String phone,
        UUID conversationId,
        UUID inboundMessageId
    ) {
        var conversation = conversations.findByIdAndCompanyId(conversationId, companyId).orElse(null);
        String preAssignedAgentId = conversation == null ? null : trimToNull(conversation.getAssignedAgentId());
        var agentConfig = preAssignedAgentId != null
                ? aiAgentOrchestration.findAgentExecutionConfig(companyId, preAssignedAgentId)
                : aiAgentOrchestration.findFirstActiveAgentConfig(companyId);
        UUID supervisorId = supervisorRoutingService.findDefaultSupervisorId(companyId);
        if ((agentConfig == null || trimToNull(agentConfig.agentId()) == null) && supervisorId == null) {
            log.debug("Auto-reply skipped: no active AI agent and no supervisor found for company={}", companyId);
            return;
        }
        int delayMessageSeconds = Math.max(0, agentConfig == null ? 2 : agentConfig.delayMessageSeconds());
        String tokenKey = companyId + ":" + conversationId;
        String token = UUID.randomUUID().toString();
        autoReplyDebounceTokens.put(tokenKey, token);

        CompletableFuture.runAsync(() -> {
            try {
                if (delayMessageSeconds > 0) {
                    Thread.sleep(delayMessageSeconds * 1000L);
                }
                String currentToken = autoReplyDebounceTokens.get(tokenKey);
                if (!token.equals(currentToken)) {
                    log.debug("Auto-reply skipped by debounce superseded token conversationId={}", conversationId);
                    return;
                }
                triggerAutomaticAgentReply(
                        companyId,
                        zapiInstanceId,
                        zapiInstanceToken,
                        zapiClientToken,
                        phone,
                        conversationId,
                        inboundMessageId
                );
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("Auto-reply debounce interrupted companyId={} conversationId={}", companyId, conversationId);
            } catch (Exception ex) {
                log.error("Auto-reply failed companyId={} conversationId={} reason={}", companyId, conversationId, rootCauseMessage(ex), ex);
            } finally {
                autoReplyDebounceTokens.remove(tokenKey, token);
            }
        });
    }

    private void evaluateKanbanMoveSafely(
            UUID companyId,
            UUID conversationId,
            String agentId,
            List<String> events,
            boolean force
    ) {
        try {
            var evaluation = kanbanMoveDecisionService.evaluateAndMaybeMoveCard(
                    companyId,
                    conversationId,
                    conversationId.toString(),
                    agentId,
                    events == null ? List.of() : events,
                    force
            );
            if ("ERROR".equalsIgnoreCase(trimToNull(evaluation.decision()))) {
                log.warn(
                        "Kanban move evaluation error conversationId={} decision={} errorCode={} reason={}",
                        conversationId,
                        evaluation.decision(),
                        trimToNull(evaluation.errorCode()),
                        trimToNull(evaluation.reason())
                );
            } else if ("MOVE".equalsIgnoreCase(trimToNull(evaluation.decision()))) {
                log.info(
                        "Kanban move evaluation moved conversationId={} targetStageId={} evaluationKey={}",
                        conversationId,
                        trimToNull(evaluation.targetStageId()),
                        trimToNull(evaluation.evaluationKey())
                );
            }
        } catch (Exception ex) {
            log.error("Kanban move evaluation failed conversationId={} reason={}", conversationId, rootCauseMessage(ex), ex);
        }
    }

    private List<String> extractStructuredKanbanEvents(String finalText) {
        String normalized = normalizeIncomingText(finalText, "text");
        if (normalized == null) return List.of();
        String lowered = normalized.toLowerCase();
        if (lowered.contains("agendado para") || lowered.contains("google meet") || lowered.contains("link do google meet")) {
            return List.of("meetingScheduled");
        }
        return List.of();
    }

    private void sendAutomaticText(
            UUID companyId,
            String zapiInstanceId,
            String zapiInstanceToken,
            String zapiClientToken,
            String phone,
            String message,
            int delayTypingSeconds
    ) {
        String normalizedPhone = normalizePhone(phone);
        if (normalizedPhone.isBlank()) return;
        if (trimToNull(message) == null) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phone", normalizedPhone);
        payload.put("message", message.trim());
        payload.put("delayTyping", Math.max(0, delayTypingSeconds));

        String endpoint = "https://api.z-api.io/instances/%s/token/%s/send-text".formatted(
                encode(zapiInstanceId),
                encode(zapiInstanceToken)
        );

        HttpRequest request;
        try {
            request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Client-Token", zapiClientToken)
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_AUTO_REPLY_REQUEST_ERROR", "Erro ao montar requisicao de resposta automatica");
        }

        HttpResponse<String> response;
        try {
            response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("ATENDIMENTO_AUTO_REPLY_INTERRUPTED", "Resposta automatica interrompida");
        } catch (IOException ex) {
            throw new BusinessException("ATENDIMENTO_AUTO_REPLY_SEND_FAILED", "Falha ao enviar resposta automatica");
        }

        if (response.statusCode() < 200 || response.statusCode() > 299) {
            throw new BusinessException("ATENDIMENTO_AUTO_REPLY_SEND_FAILED", "Falha ao enviar resposta automatica (status " + response.statusCode() + ")");
        }

        try {
            Map<String, Object> zapiData = OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {});
            String messageId = asString(zapiData.get("messageId"));
            persistMessage(
                    companyId,
                    normalizedPhone,
                    null,
                    null,
                    null,
                    message,
                    "text",
                    true,
                    messageId,
                    "SENT",
                    null,
                    null
            );
        } catch (Exception ex) {
            throw new BusinessException("ATENDIMENTO_AUTO_REPLY_INVALID_RESPONSE", "Resposta invalida no envio automatico");
        }
    }

    private String buildConsolidatedCustomerMessage(UUID companyId, UUID conversationId) {
        List<JpaAtendimentoMessageEntity> timeline = messages.findAllByConversationIdAndCompanyIdOrderByCreatedAtAsc(conversationId, companyId);
        if (timeline.isEmpty()) return null;

        int lastOutgoingIndex = -1;
        for (int i = 0; i < timeline.size(); i++) {
            if (timeline.get(i).isFromMe()) lastOutgoingIndex = i;
        }

        List<String> chunks = new java.util.ArrayList<>();
        for (int i = lastOutgoingIndex + 1; i < timeline.size(); i++) {
            JpaAtendimentoMessageEntity message = timeline.get(i);
            if (message.isFromMe()) continue;
            String normalized = normalizeIncomingText(message.getMessageText(), message.getMessageType());
            if (trimToNull(normalized) != null) {
                chunks.add(normalized.trim());
            }
        }
        if (chunks.isEmpty()) return null;
        return String.join("\n", chunks);
    }

    private String normalizeIncomingText(String text, String messageType) {
        String normalizedText = trimToNull(text);
        if (normalizedText != null) return normalizedText;
        String type = trimToNull(messageType);
        if (type == null) return null;
        return switch (type.toLowerCase()) {
            case "audio" -> "[Audio recebido]";
            case "image" -> "[Imagem recebida]";
            case "video" -> "[Video recebido]";
            case "document" -> "[Documento recebido]";
            case "location" -> "[Localizacao recebida]";
            case "sticker" -> "[Sticker recebido]";
            default -> null;
        };
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private UUID persistMessage(
            UUID companyId,
            String phone,
            String contactLid,
            String displayName,
            String contactPhotoUrl,
            String text,
            String messageType,
            boolean fromMe,
            String zapiMessageId,
            String status,
            Long moment,
            String payloadJson
    ) {
        return persistMessageDetailed(
                companyId,
                phone,
                contactLid,
                displayName,
                contactPhotoUrl,
                text,
                messageType,
                fromMe,
                zapiMessageId,
                status,
                moment,
                payloadJson
        ).conversationId();
    }

    private PersistedMessage persistMessageDetailed(
            UUID companyId,
            String phone,
            String contactLid,
            String displayName,
            String contactPhotoUrl,
            String text,
            String messageType,
            boolean fromMe,
            String zapiMessageId,
            String status,
            Long moment,
            String payloadJson
    ) {
        String normalizedPhone = normalizePhone(phone);
        var conversation = resolveConversation(companyId, normalizedPhone, contactLid, displayName);

        Instant eventAt = toInstant(moment);
        String normalizedText = trimToNull(text);
        String normalizedDisplayName = trimToNull(displayName);
        String currentDisplayName = trimToNull(conversation.getDisplayName());
        String normalizedDisplayNameDigits = normalizePhone(normalizedDisplayName);
        boolean incomingDisplayLooksLikePhone =
                normalizedDisplayName != null &&
                !normalizedDisplayNameDigits.isBlank() &&
                normalizedDisplayNameDigits.equals(normalizedPhone);

        if (normalizedDisplayName != null && (!incomingDisplayLooksLikePhone || currentDisplayName == null)) {
            conversation.setDisplayName(normalizedDisplayName);
        }
        if (trimToNull(contactLid) != null) {
            conversation.setContactLid(trimToNull(contactLid));
        }
        if (trimToNull(contactPhotoUrl) != null) {
            conversation.setContactPhotoUrl(trimToNull(contactPhotoUrl));
        }
        conversation.setLastMessageText(normalizedText);
        conversation.setLastMessageAt(eventAt);
        if (trimToNull(conversation.getStatus()) == null) {
            conversation.setStatus("NEW");
        }
        conversation.setUpdatedAt(Instant.now());
        conversations.saveAndFlush(conversation);

        JpaAtendimentoMessageEntity message = new JpaAtendimentoMessageEntity();
        message.setId(UUID.randomUUID());
        message.setConversationId(conversation.getId());
        message.setCompanyId(companyId);
        message.setPhone(conversation.getPhone());
        message.setMessageText(normalizedText);
        message.setMessageType(normalizePersistedMessageType(messageType, normalizedText));
        message.setFromMe(fromMe);
        message.setZapiMessageId(trimToNull(zapiMessageId));
        message.setStatus(trimToNull(status));
        message.setMoment(moment);
        message.setPayloadJson(trimToNull(payloadJson));
        message.setCreatedAt(eventAt);
        try {
            messages.saveAndFlush(message);
        } catch (DataIntegrityViolationException ex) {
            if (isDuplicateMessageViolation(ex)) {
                realtime.conversationChanged(companyId, conversation.getId());
                JpaAtendimentoMessageEntity existing = trimToNull(zapiMessageId) == null
                        ? null
                        : messages.findByCompanyIdAndZapiMessageId(companyId, trimToNull(zapiMessageId)).orElse(null);
                return new PersistedMessage(conversation.getId(), existing == null ? null : existing.getId());
            }
            throw ex;
        }

        realtime.messageChanged(companyId, conversation.getId());
        realtime.conversationChanged(companyId, conversation.getId());

        return new PersistedMessage(conversation.getId(), message.getId());
    }

    private JpaAtendimentoConversationEntity resolveConversation(UUID companyId, String phone, String displayName) {
        return resolveConversation(companyId, phone, null, displayName);
    }

    private JpaAtendimentoConversationEntity resolveConversation(UUID companyId, String phone, String contactLid, String displayName) {
        String normalizedLid = normalizeLid(contactLid);
        if (normalizedLid != null) {
            List<JpaAtendimentoConversationEntity> byLid = conversations.findAllByCompanyIdAndContactLid(companyId, normalizedLid);
            if (!byLid.isEmpty()) {
                return byLid.stream().max(this::compareConversationRecency).orElse(byLid.get(0));
            }
        }

        List<String> variants = equivalentPhones(phone);
        List<JpaAtendimentoConversationEntity> existing = conversations.findAllByCompanyIdAndPhoneIn(companyId, variants);
        if (!existing.isEmpty()) {
            return existing.stream()
                    .max(this::compareConversationRecency)
                    .orElse(existing.get(0));
        }

        JpaAtendimentoConversationEntity created = createConversation(companyId, phone, displayName);
        created.setContactLid(normalizedLid);
        try {
            return conversations.saveAndFlush(created);
        } catch (DataIntegrityViolationException ex) {
            if (isDuplicateConversationViolation(ex)) {
                if (normalizedLid != null) {
                    List<JpaAtendimentoConversationEntity> byLidAfterRace = conversations.findAllByCompanyIdAndContactLid(companyId, normalizedLid);
                    if (!byLidAfterRace.isEmpty()) {
                        return byLidAfterRace.stream().max(this::compareConversationRecency).orElse(byLidAfterRace.get(0));
                    }
                }
                List<JpaAtendimentoConversationEntity> afterRace = conversations.findAllByCompanyIdAndPhoneIn(companyId, variants);
                if (!afterRace.isEmpty()) {
                    return afterRace.stream()
                            .max(this::compareConversationRecency)
                            .orElse(afterRace.get(0));
                }
                throw ex;
            }
            throw ex;
        }
    }

    private List<JpaAtendimentoConversationEntity> resolveConversationDeletionTargets(UUID companyId, JpaAtendimentoConversationEntity conversation) {
        LinkedHashMap<UUID, JpaAtendimentoConversationEntity> related = new LinkedHashMap<>();
        related.put(conversation.getId(), conversation);

        List<String> phones = equivalentPhones(conversation.getPhone());
        if (!phones.isEmpty()) {
            for (JpaAtendimentoConversationEntity item : conversations.findAllByCompanyIdAndPhoneIn(companyId, phones)) {
                related.put(item.getId(), item);
            }
        }

        LinkedHashSet<String> lids = related.values().stream()
                .map(item -> normalizeLid(item.getContactLid()))
                .filter(lid -> lid != null && !lid.isBlank())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        for (String lid : lids) {
            for (JpaAtendimentoConversationEntity item : conversations.findAllByCompanyIdAndContactLid(companyId, lid)) {
                related.put(item.getId(), item);
            }
        }

        return List.copyOf(related.values());
    }

    private JpaAtendimentoConversationEntity createConversation(UUID companyId, String phone, String displayName) {
        JpaAtendimentoConversationEntity entity = new JpaAtendimentoConversationEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setPhone(phone);
        entity.setDisplayName(trimToNull(displayName) != null ? trimToNull(displayName) : phone);
        entity.setSourcePlatform("WHATSAPP");
        entity.setSourceReference(null);
        entity.setStatus("NEW");
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }

    private static Instant toInstant(Long moment) {
        if (moment == null || moment <= 0) return Instant.now();
        if (moment > 100000000000L) return Instant.ofEpochMilli(moment);
        return Instant.ofEpochSecond(moment);
    }

    private static Instant parseLastSeen(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isNumber()) return toInstant(node.asLong());
        String raw = trimToNull(node.asText(null));
        if (raw == null) return null;
        try {
            long value = Long.parseLong(raw);
            return toInstant(value);
        } catch (NumberFormatException ignored) {
            // Tenta ISO-8601
        }
        try {
            return Instant.parse(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String normalizePresenceStatus(String rawStatus) {
        String normalized = trimToNull(rawStatus);
        if (normalized == null) return null;
        String value = normalized.toUpperCase().replace("-", "_").replace(" ", "_");
        return switch (value) {
            case "COMPOSING", "TYPING", "DIGITANDO", "IS_COMPOSING" -> "COMPOSING";
            case "RECORDING", "RECORDING_AUDIO", "GRAVANDO", "IS_RECORDING" -> "RECORDING";
            case "PAUSED", "PAUSE", "IDLE" -> "PAUSED";
            case "AVAILABLE", "ONLINE", "CONNECTED" -> "AVAILABLE";
            default -> value;
        };
    }

    private static String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    private static String normalizeLid(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) return null;
        String normalized = trimmed.toLowerCase().replace("@lid", "").replaceAll("\\s+", "");
        String digits = normalized.replaceAll("\\D", "");
        if (digits.isBlank()) return null;
        return digits;
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

    private static List<String> equivalentPhones(String phone) {
        String normalized = normalizePhone(phone);
        if (normalized.isBlank()) return List.of();

        LinkedHashSet<String> set = new LinkedHashSet<>();
        set.add(normalized);

        if (normalized.startsWith("55")) {
            String national = normalized.substring(2);
            if (!national.isBlank()) set.add(national);

            if (normalized.length() == 13 && normalized.charAt(4) == '9') {
                set.add(normalized.substring(0, 4) + normalized.substring(5));
                if (national.length() == 11 && national.charAt(2) == '9') {
                    set.add(national.substring(0, 2) + national.substring(3));
                }
            } else if (normalized.length() == 12) {
                set.add(normalized.substring(0, 4) + "9" + normalized.substring(4));
                if (national.length() == 10) {
                    set.add(national.substring(0, 2) + "9" + national.substring(2));
                }
            }
        } else if (normalized.length() == 10 || normalized.length() == 11) {
            String withCountry = "55" + normalized;
            set.add(withCountry);
            if (normalized.length() == 11 && normalized.charAt(2) == '9') {
                set.add("55" + normalized.substring(0, 2) + normalized.substring(3));
            } else if (normalized.length() == 10) {
                set.add("55" + normalized.substring(0, 2) + "9" + normalized.substring(2));
            }
        }
        return List.copyOf(set);
    }

    private AtendimentoClassificationResult parseClassificationResult(String rawValue) {
        String normalized = trimToNull(rawValue);
        if (normalized == null) {
            throw new BusinessException("ATENDIMENTO_CLASSIFICATION_INVALID", "Classificacao invalida");
        }
        String value = normalized.toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        return switch (value) {
            case "OBJECTIVE_ACHIEVED", "OBJETIVO_ATINGIDO", "ACHIEVED" -> AtendimentoClassificationResult.OBJECTIVE_ACHIEVED;
            case "OBJECTIVE_LOST", "OBJETIVO_PERDIDO", "LOST" -> AtendimentoClassificationResult.OBJECTIVE_LOST;
            case "QUESTION", "QUESTIONS", "DUVIDA", "DUVIDAS" -> AtendimentoClassificationResult.QUESTION;
            case "OTHER", "OUTRO" -> AtendimentoClassificationResult.OTHER;
            default -> throw new BusinessException("ATENDIMENTO_CLASSIFICATION_INVALID", "Classificacao invalida");
        };
    }

    private String conversationDedupKey(JpaAtendimentoConversationEntity conversation) {
        String lid = normalizeLid(conversation.getContactLid());
        if (lid != null) return "lid:" + lid;
        return "phone:" + canonicalPhone(conversation.getPhone());
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) return normalized;
        }
        return null;
    }

    private static JsonNode firstPresentNode(JsonNode... nodes) {
        if (nodes == null) return null;
        for (JsonNode node : nodes) {
            if (node == null || node.isMissingNode() || node.isNull()) continue;
            return node;
        }
        return null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean shouldUpdateMessageStatus(String currentStatus, String incomingStatus) {
        int currentRank = statusRank(currentStatus);
        int incomingRank = statusRank(incomingStatus);
        if (incomingRank < 0) return false;
        if (currentRank < 0) return true;
        return incomingRank >= currentRank;
    }

    private static int statusRank(String status) {
        String normalized = trimToNull(status);
        if (normalized == null) return -1;
        return switch (normalized.toUpperCase()) {
            case "SENT" -> 1;
            case "RECEIVED" -> 2;
            case "READ", "READ_BY_ME", "PLAYED" -> 3;
            default -> -1;
        };
    }

    private String extractWebhookText(JsonNode body) {
        return firstNonBlank(
                nodeTextValue(body.path("text")),
                nodeTextValue(body.path("text").path("message")),
                nodeTextValue(body.path("text").path("text")),
                nodeTextValue(body.path("text").path("body")),
                nodeTextValue(body.path("message")),
                nodeTextValue(body.path("message").path("text")),
                nodeTextValue(body.path("message").path("conversation")),
                nodeTextValue(body.path("conversation")),
                nodeTextValue(body.path("extendedTextMessage").path("text")),
                nodeTextValue(body.path("extendedText").path("text")),
                nodeTextValue(body.path("image").path("caption")),
                nodeTextValue(body.path("video").path("caption")),
                nodeTextValue(body.path("document").path("title")),
                nodeTextValue(body.path("document").path("fileName")),
                nodeTextValue(body.path("location").path("name")),
                nodeTextValue(body.path("contact").path("displayName"))
        );
    }

    private String detectMessageType(JsonNode body, String extractedText) {
        String declaredType = firstNonBlank(
                nodeTextValue(body.path("type")),
                nodeTextValue(body.path("messageType")),
                nodeTextValue(body.path("message").path("type"))
        );
        if (declaredType != null) {
            String normalizedDeclaredType = declaredType.toLowerCase(Locale.ROOT).replace('-', '_').trim();
            switch (normalizedDeclaredType) {
                case "text", "chat", "conversation", "extended_text":
                    return "text";
                case "image":
                    return "image";
                case "audio", "ptt", "voice":
                    return "audio";
                case "video":
                    return "video";
                case "document", "file":
                    return "document";
                case "location":
                    return "location";
                case "sticker":
                    return "sticker";
                case "contact", "contacts":
                    return "contact";
                default:
                    break;
            }
        }

        if (trimToNull(extractedText) != null) return "text";
        if (hasNodeContent(body.path("image"), "imageUrl", "url", "caption")) return "image";
        if (hasNodeContent(body.path("audio"), "audioUrl", "url")) return "audio";
        if (hasNodeContent(body.path("video"), "videoUrl", "url", "caption")) return "video";
        if (hasNodeContent(body.path("document"), "documentUrl", "url", "title", "fileName")) return "document";
        if (hasNodeContent(body.path("location"), "latitude", "name")) return "location";
        if (hasNodeContent(body.path("sticker"), "stickerUrl", "url")) return "sticker";
        if (hasNodeContent(body.path("contact"), "vCard", "displayName")) return "contact";
        return "unknown";
    }

    private String normalizePersistedMessageType(String messageType, String messageText) {
        if (trimToNull(messageText) != null) return "text";
        String normalizedType = trimToNull(messageType);
        return normalizedType == null ? "text" : normalizedType;
    }

    private boolean hasNodeContent(JsonNode node, String... fieldNames) {
        if (node == null || node.isMissingNode() || node.isNull()) return false;
        if (node.isValueNode()) return trimToNull(node.asText(null)) != null;
        for (String fieldName : fieldNames) {
            if (trimToNull(nodeTextValue(node.path(fieldName))) != null) {
                return true;
            }
        }
        return false;
    }

    private String nodeTextValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.isTextual() || node.isNumber() || node.isBoolean()) {
            return trimToNull(node.asText(null));
        }
        return null;
    }

    private String safeJson(JsonNode body) {
        try {
            return OBJECT_MAPPER.writeValueAsString(body);
        } catch (Exception ex) {
            return null;
        }
    }

    private String safeJson(Object body) {
        try {
            return OBJECT_MAPPER.writeValueAsString(body);
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractImageUrl(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("image").path("imageUrl").asText(null)),
                    trimToNull(root.path("image").path("url").asText(null)),
                    trimToNull(root.path("imageUrl").asText(null)),
                    trimToNull(root.path("image").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractVideoUrl(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("video").path("videoUrl").asText(null)),
                    trimToNull(root.path("video").path("url").asText(null)),
                    trimToNull(root.path("videoUrl").asText(null)),
                    trimToNull(root.path("video").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractStickerUrl(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("sticker").path("stickerUrl").asText(null)),
                    trimToNull(root.path("sticker").path("url").asText(null)),
                    trimToNull(root.path("stickerUrl").asText(null)),
                    trimToNull(root.path("sticker").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractAudioUrl(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("audio").path("audioUrl").asText(null)),
                    trimToNull(root.path("audio").path("url").asText(null)),
                    trimToNull(root.path("audioUrl").asText(null)),
                    trimToNull(root.path("audio").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractDocumentUrl(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("document").path("documentUrl").asText(null)),
                    trimToNull(root.path("document").path("url").asText(null)),
                    trimToNull(root.path("documentUrl").asText(null)),
                    trimToNull(root.path("document").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractDocumentName(String payloadJson) {
        String payload = trimToNull(payloadJson);
        if (payload == null) return null;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            return firstNonBlank(
                    trimToNull(root.path("document").path("fileName").asText(null)),
                    trimToNull(root.path("document").path("title").asText(null)),
                    trimToNull(root.path("document").path("name").asText(null)),
                    trimToNull(root.path("fileName").asText(null)),
                    trimToNull(root.path("title").asText(null))
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeDocumentExtension(String extension) {
        String normalized = trimToNull(extension);
        if (normalized == null) return null;
        normalized = normalized.toLowerCase(Locale.ROOT).replaceFirst("^\\.+", "");
        normalized = normalized.replaceAll("[^a-z0-9]+", "");
        return normalized.isBlank() ? null : normalized;
    }

    private String extractErrorMessage(String body) {
        if (body == null || body.isBlank()) return "sem detalhes";
        try {
            Map<String, Object> map = OBJECT_MAPPER.readValue(body, new TypeReference<>() {});
            Object message = map.get("message");
            if (message != null) return String.valueOf(message);
            Object error = map.get("error");
            if (error != null) return String.valueOf(error);
        } catch (Exception ignored) {
            // Fallback para corpo cru se nao vier em JSON.
        }
        return body;
    }

    private static String rootCauseMessage(Throwable throwable) {
        Throwable root = throwable;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage();
        return message == null || message.isBlank() ? root.getClass().getSimpleName() : message;
    }

    private User requireCurrentOperator(UUID companyId) {
        return users.findByIdAndCompanyId(currentUser.userId(), companyId)
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuario nao encontrado"));
    }

    private Map<UUID, Team> listTeamsById(UUID companyId) {
        return teams.findAllByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(Team::id, team -> team));
    }

    private Team resolveTeam(UUID companyId, UUID teamId) {
        return teams.findByIdAndCompanyId(teamId, companyId)
                .orElseThrow(() -> new BusinessException("TEAM_NOT_FOUND", "Equipe nao encontrada"));
    }

    private ResolvedConversationAssignment resolveConversationAssignment(UUID companyId, UUID requestedTeamId, UUID requestedUserId, User actor) {
        Team resolvedTeam;
        User resolvedUser = null;

        if (requestedUserId != null) {
            resolvedUser = users.findByIdAndCompanyId(requestedUserId, companyId)
                    .orElseThrow(() -> new BusinessException("ATENDIMENTO_TARGET_NOT_FOUND", "Usuario destino nao encontrado"));
            resolvedTeam = resolveTeam(companyId, resolvedUser.teamId());
            if (requestedTeamId != null && !requestedTeamId.equals(resolvedTeam.id())) {
                throw new BusinessException("ATENDIMENTO_TEAM_USER_MISMATCH", "Usuario destino nao pertence a equipe selecionada");
            }
        } else if (requestedTeamId != null) {
            resolvedTeam = resolveTeam(companyId, requestedTeamId);
        } else {
            resolvedTeam = resolveTeam(companyId, actor.teamId());
        }

        return new ResolvedConversationAssignment(resolvedTeam, resolvedUser);
    }

    private void assignConversation(JpaAtendimentoConversationEntity conversation, ResolvedConversationAssignment assignment, Instant now) {
        conversation.setStatus("IN_PROGRESS");
        conversation.setAssignedTeamId(assignment.team().id());
        conversation.setAssignedUserId(assignment.user() == null ? null : assignment.user().id());
        conversation.setAssignedUserName(assignment.user() == null ? null : assignment.user().fullName());
        conversation.setAssignedAgentId(null);
        conversation.setHumanHandoffRequested(false);
        conversation.setHumanHandoffQueue(null);
        conversation.setHumanHandoffRequestedAt(null);
        conversation.setHumanUserChoiceRequired(false);
        conversation.setHumanChoiceOptionsJson("[]");
        if (assignment.user() != null && conversation.getStartedAt() == null) {
            conversation.setStartedAt(now);
        }
        if (assignment.user() == null) {
            conversation.setStartedAt(null);
        }
        conversation.setUpdatedAt(now);
    }

    private boolean isSupportedConversationSource(String sourcePlatform) {
        String normalized = trimToNull(sourcePlatform);
        if (normalized == null) return true;
        String upper = normalized.toUpperCase(Locale.ROOT);
        return !"ZAPI".equals(upper) && !"WHATSAPP".equals(upper) && !"SYSTEM_SALE".equals(upper);
    }

    private boolean whatsappChannelRemoved() {
        return true;
    }

    private BusinessException removedWhatsAppChannelException() {
        return new BusinessException(
                "ATENDIMENTO_CHANNEL_REMOVED",
                "O canal de atendimento via WhatsApp/Z-API foi removido desta operação."
        );
    }

    private boolean canAccessConversation(User actor, JpaAtendimentoConversationEntity conversation) {
        return true;
    }

    private void assertConversationAccessible(User actor, JpaAtendimentoConversationEntity conversation) {
        if (!canAccessConversation(actor, conversation)) {
            throw new BusinessException("ATENDIMENTO_TEAM_FORBIDDEN", "Conversa indisponivel para sua equipe");
        }
    }

    private int compareConversationRecency(JpaAtendimentoConversationEntity a, JpaAtendimentoConversationEntity b) {
        Instant aLast = a.getLastMessageAt();
        Instant bLast = b.getLastMessageAt();
        if (aLast != null && bLast != null) {
            int byLast = aLast.compareTo(bLast);
            if (byLast != 0) return byLast;
        } else if (aLast != null) {
            return 1;
        } else if (bLast != null) {
            return -1;
        }
        Instant aUpdated = a.getUpdatedAt();
        Instant bUpdated = b.getUpdatedAt();
        if (aUpdated != null && bUpdated != null) return aUpdated.compareTo(bUpdated);
        if (aUpdated != null) return 1;
        if (bUpdated != null) return -1;
        return 0;
    }

    private static boolean isDuplicateMessageViolation(Throwable throwable) {
        String message = rootCauseMessage(throwable).toLowerCase();
        return message.contains("uq_atendimento_messages_company_zapi_message_id")
                || message.contains("atendimento_messages")
                || message.contains("duplicate");
    }

    private static boolean isDuplicateConversationViolation(Throwable throwable) {
        String message = rootCauseMessage(throwable).toLowerCase();
        return message.contains("atendimento_conversations")
                || message.contains("duplicate")
                || message.contains("unique");
    }

    private ResolvedContactDetails resolveWebhookContactDetails(
            Company company,
            String phone,
            String contactLid,
            String incomingName,
            String incomingPhotoUrl,
            boolean fromMe
    ) {
        JpaAtendimentoConversationEntity existingConversation = findExistingConversation(company.id(), phone, contactLid);
        String storedName = existingConversation == null ? null : trimToNull(existingConversation.getDisplayName());
        String storedPhotoUrl = existingConversation == null ? null : trimToNull(existingConversation.getContactPhotoUrl());

        String resolvedName = selectBestKnownContactName(company, phone, incomingName, storedName, fromMe);
        String resolvedPhotoUrl = firstNonBlank(incomingPhotoUrl, storedPhotoUrl);
        if (isUsableContactName(company, phone, resolvedName, fromMe)) {
            return new ResolvedContactDetails(resolvedName, resolvedPhotoUrl);
        }

        ZapiContactMetadata metadata = fetchZapiContactMetadata(company, phone);
        if (metadata == null) {
            return new ResolvedContactDetails(resolvedName, resolvedPhotoUrl);
        }

        String metadataName = firstNonBlank(
                sanitizeMetadataContactName(company, phone, metadata.shortName(), fromMe),
                sanitizeMetadataContactName(company, phone, metadata.fullName(), fromMe),
                sanitizeMetadataContactName(company, phone, metadata.notifyName(), fromMe)
        );
        String finalName = firstNonBlank(metadataName, resolvedName);
        String finalPhotoUrl = firstNonBlank(incomingPhotoUrl, metadata.photoUrl(), storedPhotoUrl);
        return new ResolvedContactDetails(finalName, finalPhotoUrl);
    }

    private JpaAtendimentoConversationEntity findExistingConversation(UUID companyId, String phone, String contactLid) {
        String normalizedLid = normalizeLid(contactLid);
        if (normalizedLid != null) {
            List<JpaAtendimentoConversationEntity> byLid = conversations.findAllByCompanyIdAndContactLid(companyId, normalizedLid);
            if (!byLid.isEmpty()) {
                return byLid.stream()
                        .max(this::compareConversationRecency)
                        .orElse(byLid.get(0));
            }
        }

        List<String> variants = equivalentPhones(phone);
        if (variants.isEmpty()) {
            return null;
        }
        List<JpaAtendimentoConversationEntity> byPhone = conversations.findAllByCompanyIdAndPhoneIn(companyId, variants);
        if (byPhone.isEmpty()) {
            return null;
        }
        return byPhone.stream()
                .max(this::compareConversationRecency)
                .orElse(byPhone.get(0));
    }

    private String selectBestKnownContactName(
            Company company,
            String phone,
            String incomingName,
            String storedName,
            boolean fromMe
    ) {
        if (isUsableContactName(company, phone, incomingName, fromMe)) {
            return trimToNull(incomingName);
        }
        if (isUsableContactName(company, phone, storedName, fromMe)) {
            return trimToNull(storedName);
        }
        return firstNonBlank(incomingName, storedName);
    }

    private String sanitizeMetadataContactName(Company company, String phone, String candidate, boolean fromMe) {
        return isUsableContactName(company, phone, candidate, fromMe) ? trimToNull(candidate) : null;
    }

    private boolean isUsableContactName(Company company, String phone, String candidate, boolean fromMe) {
        String normalized = trimToNull(candidate);
        if (normalized == null) return false;
        if (looksLikePhoneValue(phone, normalized)) return false;
        if (fromMe && looksLikeOwnCompanyName(company, normalized)) return false;
        if (fromMe) {
            String candidateDigits = normalizePhone(normalized);
            String companyPhone = company == null ? "" : normalizePhone(company.whatsappNumber());
            if (!candidateDigits.isBlank() && !companyPhone.isBlank() && canonicalPhone(candidateDigits).equals(canonicalPhone(companyPhone))) {
                return false;
            }
        }
        return true;
    }

    private boolean looksLikePhoneValue(String phone, String candidate) {
        String candidateDigits = normalizePhone(candidate);
        if (candidateDigits.isBlank()) return false;
        String candidateCanonical = canonicalPhone(candidateDigits);
        String phoneCanonical = canonicalPhone(phone);
        if (candidateCanonical.equals(phoneCanonical)) return true;
        return equivalentPhones(phone).stream()
                .map(AtendimentosController::canonicalPhone)
                .anyMatch(candidateCanonical::equals);
    }

    private boolean looksLikeOwnCompanyName(Company company, String candidate) {
        if (company == null) return false;
        String companyName = normalizeComparableName(company.name());
        String candidateName = normalizeComparableName(candidate);
        if (companyName == null || candidateName == null) return false;
        if (candidateName.equals(companyName)) return true;
        if (companyName.length() < 6 || candidateName.length() < 6) return false;
        return candidateName.contains(companyName) || companyName.contains(candidateName);
    }

    private String normalizeComparableName(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) return null;
        normalized = normalized.toLowerCase(Locale.ROOT)
                .replace('|', ' ')
                .replace('-', ' ')
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit} ]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeSaleOriginPlatform(String raw, String fallbackSourcePlatform) {
        String source = trimToNull(raw);
        if (source == null) {
            source = trimToNull(fallbackSourcePlatform);
        }
        if (source == null) {
            return null;
        }
        String normalized = source.toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        return switch (normalized) {
            case "CATALOG", "PUBLIC_CATALOG" -> "CATALOG";
            case "MERCADO_LIVRE", "MERCADOLIVRE", "MELI" -> "MERCADO_LIVRE";
            case "OLX" -> "OLX";
            case "WEBMOTORS", "WEB_MOTORS" -> "WEBMOTORS";
            case "WHATSAPP" -> "WHATSAPP";
            case "MANUAL" -> "MANUAL";
            case "OTHER", "OUTRA", "OUTRO" -> "OTHER";
            default -> "OTHER";
        };
    }

    private ResolvedSaleSeller resolveSaleSeller(UUID companyId, UUID sellerUserId) {
        if (sellerUserId == null) {
            throw new BusinessException("ATENDIMENTO_SALE_SELLER_REQUIRED", "Selecione o vendedor responsavel para concluir a venda.");
        }

        User seller = users.findByIdAndCompanyId(sellerUserId, companyId)
                .filter(User::isActive)
                .orElseThrow(() -> new BusinessException("ATENDIMENTO_SALE_SELLER_NOT_FOUND", "Vendedor nao encontrado para concluir a venda."));
        Team sellerTeam = seller.teamId() == null ? null : teams.findByIdAndCompanyId(seller.teamId(), companyId).orElse(null);
        return new ResolvedSaleSeller(seller, sellerTeam);
    }

    private ZapiContactMetadata fetchZapiContactMetadata(Company company, String phone) {
        String instanceId = company == null ? null : trimToNull(company.zapiInstanceId());
        String instanceToken = company == null ? null : trimToNull(company.zapiInstanceToken());
        String clientToken = company == null ? null : trimToNull(company.zapiClientToken());
        String normalizedPhone = normalizePhone(phone);
        if (instanceId == null || instanceToken == null || clientToken == null || normalizedPhone.isBlank()) {
            return null;
        }

        String endpoint = "%s/instances/%s/token/%s/contacts/%s".formatted(
                zapiBaseUrl(),
                encode(instanceId),
                encode(instanceToken),
                encode(normalizedPhone)
        );

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .GET()
                    .header("Client-Token", clientToken)
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Falha ao consultar metadata do contato {} na Z-API (status {}): {}", normalizedPhone, response.statusCode(), extractErrorMessage(response.body()));
                return null;
            }

            JsonNode root = OBJECT_MAPPER.readTree(response.body());
            return new ZapiContactMetadata(
                    trimToNull(root.path("name").asText(null)),
                    trimToNull(root.path("short").asText(null)),
                    trimToNull(root.path("notify").asText(null)),
                    trimToNull(root.path("imgUrl").asText(null))
            );
        } catch (Exception ex) {
            log.warn("Falha ao consultar metadata do contato {} na Z-API: {}", normalizedPhone, rootCauseMessage(ex));
            return null;
        }
    }

    private String zapiBaseUrl() {
        String configured = trimToNull(System.getProperty("zapi.base-url"));
        if (configured == null) return "https://api.z-api.io";
        return configured.endsWith("/") ? configured.substring(0, configured.length() - 1) : configured;
    }

    private record PersistedMessage(UUID conversationId, UUID messageId) {
    }

    private record ResolvedContactDetails(String name, String photoUrl) {
    }

    private record ZapiContactMetadata(String fullName, String shortName, String notifyName, String photoUrl) {
    }

    private record ResolvedConversationAssignment(Team team, User user) {
    }

    private record ResolvedSaleSeller(User user, Team team) {
    }
}
