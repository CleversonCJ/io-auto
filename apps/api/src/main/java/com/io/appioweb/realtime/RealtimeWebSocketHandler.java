package com.io.appioweb.realtime;

import tools.jackson.databind.ObjectMapper;
import com.io.appioweb.application.auth.port.out.TokenServicePort;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler implements RealtimeGateway {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String ATTR_COMPANY_ID = "companyId";
    private static final String ATTR_TOKEN = "token";

    private final JwtDecoder jwtDecoder;
    private final TokenServicePort tokenService;
    private final Map<UUID, Set<WebSocketSession>> sessionsByCompany = new ConcurrentHashMap<>();

    public RealtimeWebSocketHandler(JwtDecoder jwtDecoder, TokenServicePort tokenService) {
        this.jwtDecoder = jwtDecoder;
        this.tokenService = tokenService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractQueryParam(session.getUri(), "token");
        if (token == null || token.isBlank()) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("token ausente"));
            return;
        }
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(token);
            String jti = jwt.getId();
            if (jti != null && tokenService.isAccessBlacklisted(jti)) {
                session.close(CloseStatus.POLICY_VIOLATION.withReason("token revogado"));
                return;
            }
        } catch (Exception ex) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("token invalido"));
            return;
        }

        String companyRaw = jwt.getClaimAsString("cid");
        if (companyRaw == null || companyRaw.isBlank()) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("empresa invalida"));
            return;
        }
        UUID companyId;
        try {
            companyId = UUID.fromString(companyRaw);
        } catch (Exception ex) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("empresa invalida"));
            return;
        }

        session.getAttributes().put(ATTR_COMPANY_ID, companyId);
        session.getAttributes().put(ATTR_TOKEN, token);
        sessionsByCompany.computeIfAbsent(companyId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        removeSession(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload() == null ? "" : message.getPayload().trim();
        if (!"ping".equalsIgnoreCase(payload)) {
            return;
        }

        Object rawCompany = session.getAttributes().get(ATTR_COMPANY_ID);
        UUID companyId = rawCompany instanceof UUID uuid ? uuid : null;
        session.sendMessage(new TextMessage(OBJECT_MAPPER.writeValueAsString(
                new RealtimeEvent("realtime.pong", companyId, null, Instant.now())
        )));
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        removeSession(session);
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void conversationChanged(UUID companyId, UUID conversationId) {
        publish(companyId, new RealtimeEvent("conversation.changed", companyId, conversationId, Instant.now()));
    }

    @Override
    public void messageChanged(UUID companyId, UUID conversationId) {
        publish(companyId, new RealtimeEvent("message.changed", companyId, conversationId, Instant.now()));
    }

    @Override
    public void crmStateChanged(UUID companyId) {
        publish(companyId, new RealtimeEvent("crm.state.changed", companyId, null, Instant.now()));
    }

    @Override
    public void publicCatalogLeadCreated(UUID companyId) {
        publish(companyId, new RealtimeEvent("public.catalog.lead.created", companyId, null, Instant.now()));
    }

    private void publish(UUID companyId, RealtimeEvent event) {
        Set<WebSocketSession> sessions = sessionsByCompany.get(companyId);
        if (sessions == null || sessions.isEmpty()) return;
        final String payload;
        try {
            payload = OBJECT_MAPPER.writeValueAsString(event);
        } catch (Exception ex) {
            return;
        }
        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                removeSession(session);
                continue;
            }
            try {
                session.sendMessage(new TextMessage(payload));
            } catch (IOException ignored) {
                removeSession(session);
            }
        }
    }

    private void removeSession(WebSocketSession session) {
        Object rawCompany = session.getAttributes().get(ATTR_COMPANY_ID);
        if (!(rawCompany instanceof UUID companyId)) return;
        Set<WebSocketSession> sessions = sessionsByCompany.get(companyId);
        if (sessions == null) return;
        sessions.remove(session);
        if (sessions.isEmpty()) sessionsByCompany.remove(companyId);
    }

    private static String extractQueryParam(URI uri, String key) {
        if (uri == null || uri.getQuery() == null) return null;
        String[] pairs = uri.getQuery().split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf('=');
            if (idx <= 0) continue;
            String k = pair.substring(0, idx);
            if (!key.equals(k)) continue;
            return pair.substring(idx + 1);
        }
        return null;
    }
}
