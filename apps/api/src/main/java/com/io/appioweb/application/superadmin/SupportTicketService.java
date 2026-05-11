package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.superadmin.JpaSupportTicketEntity;
import com.io.appioweb.adapters.persistence.superadmin.JpaSupportTicketMessageEntity;
import com.io.appioweb.adapters.persistence.superadmin.SupportTicketMessageRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.SupportTicketRepositoryJpa;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class SupportTicketService {

    private static final List<String> VALID_CATEGORIES = List.of("BUG", "QUESTION", "BILLING", "INTEGRATION", "FEATURE_REQUEST", "OTHER");
    private static final List<String> VALID_URGENCIES = List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final List<String> VALID_STATUSES = List.of("OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED");

    private final SupportTicketRepositoryJpa tickets;
    private final SupportTicketMessageRepositoryJpa messages;
    private final CurrentUserPort currentUser;
    private final NamedParameterJdbcTemplate jdbc;

    public SupportTicketService(
            SupportTicketRepositoryJpa tickets,
            SupportTicketMessageRepositoryJpa messages,
            CurrentUserPort currentUser,
            NamedParameterJdbcTemplate jdbc
    ) {
        this.tickets = tickets;
        this.messages = messages;
        this.currentUser = currentUser;
        this.jdbc = jdbc;
    }

    @Transactional
    public TicketDetail createTicket(CreateTicketCommand command) {
        UUID companyId = currentUser.companyId();
        UUID userId = currentUser.userId();

        String title = requireText(command.title(), "SUPPORT_TICKET_TITLE_REQUIRED", "Informe o titulo do ticket.");
        String description = requireText(command.description(), "SUPPORT_TICKET_DESCRIPTION_REQUIRED", "Explique o problema para abrir o ticket.");
        String category = normalizeCategory(command.category());
        String bugArea = normalizeNullable(command.bugArea());
        String urgency = normalizeUrgency(command.urgency());
        if (urgency == null) {
            urgency = inferUrgency(title, description, category, bugArea, command.guidedAnswers());
        }

        Instant now = Instant.now();

        JpaSupportTicketEntity ticket = new JpaSupportTicketEntity();
        ticket.setId(UUID.randomUUID());
        ticket.setCompanyId(companyId);
        ticket.setOpenedByUserId(userId);
        ticket.setTitle(trimToMax(title, 220));
        ticket.setDescription(description);
        ticket.setCategory(category);
        ticket.setUrgency(urgency);
        ticket.setStatus("OPEN");
        ticket.setBugArea(trimToMax(bugArea, 120));
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        tickets.save(ticket);

        JpaSupportTicketMessageEntity message = new JpaSupportTicketMessageEntity();
        message.setId(UUID.randomUUID());
        message.setTicketId(ticket.getId());
        message.setSenderUserId(userId);
        message.setSenderType("CUSTOMER");
        message.setMessage(buildInitialMessage(description, command.guidedAnswers()));
        message.setCreatedAt(now);
        messages.save(message);

        return toDetail(ticket, List.of(message), resolveCompanyName(companyId), resolveUserName(userId));
    }

    @Transactional(readOnly = true)
    public List<TicketSummary> listMyTickets() {
        UUID companyId = currentUser.companyId();
        UUID userId = currentUser.userId();

        return tickets.findAllByCompanyIdAndOpenedByUserIdOrderByCreatedAtDesc(companyId, userId).stream()
                .map(ticket -> new TicketSummary(
                        ticket.getId(),
                        ticket.getCompanyId(),
                        resolveCompanyName(ticket.getCompanyId()),
                        ticket.getTitle(),
                        ticket.getCategory(),
                        ticket.getUrgency(),
                        ticket.getStatus(),
                        ticket.getBugArea(),
                        ticket.getCreatedAt(),
                        ticket.getFirstResponseAt(),
                        ticket.getResolvedAt(),
                        ticket.getClosedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketSummary> listSuperAdminTickets(SuperAdminFilter filter, String status, String category, String search) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        if (SuperAdminSqlFilterBuilder.hasText(status)) {
            where.append(" and upper(coalesce(t.status, '')) = :ticketStatus");
            params.addValue("ticketStatus", status.trim().toUpperCase(Locale.ROOT));
        }
        if (SuperAdminSqlFilterBuilder.hasText(category)) {
            where.append(" and upper(coalesce(t.category, '')) = :ticketCategory");
            params.addValue("ticketCategory", category.trim().toUpperCase(Locale.ROOT));
        }
        if (SuperAdminSqlFilterBuilder.hasText(search)) {
            where.append(" and (lower(coalesce(t.title, '')) like :ticketSearch or lower(coalesce(t.description, '')) like :ticketSearch)");
            params.addValue("ticketSearch", "%" + search.trim().toLowerCase(Locale.ROOT) + "%");
        }

        String sql = """
                select
                    t.id,
                    t.company_id,
                    c.name as company_name,
                    t.title,
                    upper(coalesce(t.category, 'OTHER')) as category,
                    upper(coalesce(t.urgency, 'MEDIUM')) as urgency,
                    upper(coalesce(t.status, 'OPEN')) as status,
                    t.bug_area,
                    t.created_at,
                    t.first_response_at,
                    t.resolved_at,
                    t.closed_at
                from support_tickets t
                join companies c on c.id = t.company_id
                %s
                order by t.created_at desc
                limit 300
                """.formatted(where);

        return jdbc.query(sql, params, (rs, rowNum) -> new TicketSummary(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("company_id")),
                rs.getString("company_name"),
                rs.getString("title"),
                rs.getString("category"),
                rs.getString("urgency"),
                rs.getString("status"),
                rs.getString("bug_area"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("first_response_at") == null ? null : rs.getTimestamp("first_response_at").toInstant(),
                rs.getTimestamp("resolved_at") == null ? null : rs.getTimestamp("resolved_at").toInstant(),
                rs.getTimestamp("closed_at") == null ? null : rs.getTimestamp("closed_at").toInstant()
        ));
    }

    @Transactional(readOnly = true)
    public TicketDetail getTicket(UUID ticketId) {
        JpaSupportTicketEntity ticket = tickets.findById(ticketId)
                .orElseThrow(() -> new BusinessException("SUPPORT_TICKET_NOT_FOUND", "Ticket de suporte nao encontrado."));

        List<JpaSupportTicketMessageEntity> ticketMessages = messages.findAllByTicketIdOrderByCreatedAtAsc(ticketId);

        return toDetail(
                ticket,
                ticketMessages,
                resolveCompanyName(ticket.getCompanyId()),
                resolveUserName(ticket.getOpenedByUserId())
        );
    }

    @Transactional
    public TicketDetail updateStatus(UUID ticketId, String nextStatus) {
        JpaSupportTicketEntity ticket = tickets.findById(ticketId)
                .orElseThrow(() -> new BusinessException("SUPPORT_TICKET_NOT_FOUND", "Ticket de suporte nao encontrado."));

        String status = normalizeStatus(nextStatus);
        Instant now = Instant.now();

        if ("RESOLVED".equals(status) && ticket.getResolvedAt() == null) {
            ticket.setResolvedAt(now);
        }
        if ("CLOSED".equals(status)) {
            if (ticket.getResolvedAt() == null) ticket.setResolvedAt(now);
            if (ticket.getClosedAt() == null) ticket.setClosedAt(now);
        }

        ticket.setStatus(status);
        ticket.setUpdatedAt(now);
        tickets.save(ticket);

        return getTicket(ticketId);
    }

    @Transactional
    public TicketMessage addSupportMessage(UUID ticketId, String body) {
        JpaSupportTicketEntity ticket = tickets.findById(ticketId)
                .orElseThrow(() -> new BusinessException("SUPPORT_TICKET_NOT_FOUND", "Ticket de suporte nao encontrado."));

        String messageBody = requireText(body, "SUPPORT_TICKET_MESSAGE_REQUIRED", "Informe a mensagem do suporte.");
        Instant now = Instant.now();

        JpaSupportTicketMessageEntity message = new JpaSupportTicketMessageEntity();
        message.setId(UUID.randomUUID());
        message.setTicketId(ticket.getId());
        message.setSenderUserId(currentUser.userId());
        message.setSenderType("SUPPORT");
        message.setMessage(messageBody);
        message.setCreatedAt(now);
        messages.save(message);

        if (ticket.getFirstResponseAt() == null) {
            ticket.setFirstResponseAt(now);
        }
        if ("OPEN".equalsIgnoreCase(ticket.getStatus())) {
            ticket.setStatus("IN_PROGRESS");
        }
        ticket.setUpdatedAt(now);
        tickets.save(ticket);

        return new TicketMessage(
                message.getId(),
                message.getTicketId(),
                message.getSenderUserId(),
                message.getSenderType(),
                message.getMessage(),
                message.getCreatedAt()
        );
    }

    private TicketDetail toDetail(
            JpaSupportTicketEntity ticket,
            List<JpaSupportTicketMessageEntity> ticketMessages,
            String companyName,
            String openedByName
    ) {
        List<TicketMessage> mappedMessages = ticketMessages.stream()
                .sorted(Comparator.comparing(JpaSupportTicketMessageEntity::getCreatedAt))
                .map(message -> new TicketMessage(
                        message.getId(),
                        message.getTicketId(),
                        message.getSenderUserId(),
                        message.getSenderType(),
                        message.getMessage(),
                        message.getCreatedAt()
                ))
                .toList();

        return new TicketDetail(
                ticket.getId(),
                ticket.getCompanyId(),
                companyName,
                ticket.getOpenedByUserId(),
                openedByName,
                ticket.getTitle(),
                ticket.getDescription(),
                ticket.getCategory(),
                ticket.getUrgency(),
                ticket.getStatus(),
                ticket.getBugArea(),
                ticket.getCreatedAt(),
                ticket.getFirstResponseAt(),
                ticket.getResolvedAt(),
                ticket.getClosedAt(),
                mappedMessages
        );
    }

    private String resolveCompanyName(UUID companyId) {
        if (companyId == null) return null;
        try {
            return jdbc.queryForObject("select name from companies where id = :id", new MapSqlParameterSource("id", companyId), String.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String resolveUserName(UUID userId) {
        if (userId == null) return null;
        try {
            return jdbc.queryForObject("select full_name from users where id = :id", new MapSqlParameterSource("id", userId), String.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalizeCategory(String raw) {
        String normalized = normalizeNullable(raw);
        String value = normalized == null ? "OTHER" : normalized.toUpperCase(Locale.ROOT);
        if (!VALID_CATEGORIES.contains(value)) {
            throw new BusinessException("SUPPORT_TICKET_CATEGORY_INVALID", "Categoria de ticket invalida.");
        }
        return value;
    }

    private String normalizeUrgency(String raw) {
        String normalized = normalizeNullable(raw);
        if (normalized == null) return null;
        String value = normalized.toUpperCase(Locale.ROOT);
        if (!VALID_URGENCIES.contains(value)) {
            throw new BusinessException("SUPPORT_TICKET_URGENCY_INVALID", "Urgencia de ticket invalida.");
        }
        return value;
    }

    private String normalizeStatus(String raw) {
        String normalized = normalizeNullable(raw);
        if (normalized == null) {
            throw new BusinessException("SUPPORT_TICKET_STATUS_INVALID", "Status de ticket obrigatorio.");
        }
        String value = normalized.toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(value)) {
            throw new BusinessException("SUPPORT_TICKET_STATUS_INVALID", "Status de ticket invalido.");
        }
        return value;
    }

    private String inferUrgency(
            String title,
            String description,
            String category,
            String bugArea,
            List<GuidedAnswer> guidedAnswers
    ) {
        String joined = (title + " " + description + " " + safe(bugArea) + " " + joinGuided(guidedAnswers)).toUpperCase(Locale.ROOT);

        boolean mentionsBlocking = containsAny(joined,
                "INDISPONIVEL", "NAO CONSIGO", "BLOQUEADO", "SEM ACESSO", "PAGAMENTO", "COBRANCA", "ERRO CRITICO"
        );

        if ("BILLING".equals(category) && mentionsBlocking) return "CRITICAL";
        if (mentionsBlocking) return "HIGH";

        boolean recurring = containsAny(joined, "SEMPRE", "TODA VEZ", "RECORRENTE");
        if ("BUG".equals(category) && recurring) return "HIGH";
        if ("BUG".equals(category)) return "MEDIUM";
        if ("QUESTION".equals(category) || "FEATURE_REQUEST".equals(category)) return "LOW";
        return "MEDIUM";
    }

    private boolean containsAny(String text, String... terms) {
        for (String term : terms) {
            if (text.contains(term)) return true;
        }
        return false;
    }

    private String buildInitialMessage(String description, List<GuidedAnswer> guidedAnswers) {
        if (guidedAnswers == null || guidedAnswers.isEmpty()) {
            return description;
        }
        StringBuilder builder = new StringBuilder(description).append("\n\nInformacoes guiadas:");
        for (GuidedAnswer answer : guidedAnswers) {
            if (answer == null) continue;
            String question = normalizeNullable(answer.question());
            String response = normalizeNullable(answer.answer());
            if (question == null && response == null) continue;
            builder.append("\n- ")
                    .append(question == null ? "Pergunta" : question)
                    .append(": ")
                    .append(response == null ? "Nao informado" : response);
        }
        return builder.toString();
    }

    private String joinGuided(List<GuidedAnswer> guidedAnswers) {
        if (guidedAnswers == null || guidedAnswers.isEmpty()) return "";
        StringBuilder builder = new StringBuilder();
        for (GuidedAnswer answer : guidedAnswers) {
            if (answer == null) continue;
            if (answer.question() != null) builder.append(' ').append(answer.question());
            if (answer.answer() != null) builder.append(' ').append(answer.answer());
        }
        return builder.toString();
    }

    private String requireText(String value, String code, String message) {
        String normalized = normalizeNullable(value);
        if (normalized == null) throw new BusinessException(code, message);
        return normalized;
    }

    private String normalizeNullable(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String trimToMax(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record CreateTicketCommand(
            String title,
            String description,
            String category,
            String urgency,
            String bugArea,
            List<GuidedAnswer> guidedAnswers
    ) {
    }

    public record GuidedAnswer(String question, String answer) {
    }

    public record TicketSummary(
            UUID ticketId,
            UUID tenantId,
            String companyName,
            String title,
            String category,
            String urgency,
            String status,
            String bugArea,
            Instant createdAt,
            Instant firstResponseAt,
            Instant resolvedAt,
            Instant closedAt
    ) {
    }

    public record TicketMessage(
            UUID id,
            UUID ticketId,
            UUID senderUserId,
            String senderType,
            String message,
            Instant createdAt
    ) {
    }

    public record TicketDetail(
            UUID ticketId,
            UUID tenantId,
            String companyName,
            UUID openedByUserId,
            String openedByName,
            String title,
            String description,
            String category,
            String urgency,
            String status,
            String bugArea,
            Instant createdAt,
            Instant firstResponseAt,
            Instant resolvedAt,
            Instant closedAt,
            List<TicketMessage> messages
    ) {
    }
}
