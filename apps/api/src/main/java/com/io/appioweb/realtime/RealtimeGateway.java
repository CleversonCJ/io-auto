package com.io.appioweb.realtime;

import java.time.Instant;
import java.util.UUID;

public interface RealtimeGateway {
    void conversationChanged(UUID companyId, UUID conversationId);
    void messageChanged(UUID companyId, UUID conversationId);
    void crmStateChanged(UUID companyId);
    void publicCatalogLeadCreated(UUID companyId);

    default RealtimeEvent event(String type, UUID companyId, UUID conversationId) {
        return new RealtimeEvent(type, companyId, conversationId, Instant.now());
    }
}
