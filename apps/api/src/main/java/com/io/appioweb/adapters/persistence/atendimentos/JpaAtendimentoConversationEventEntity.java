package com.io.appioweb.adapters.persistence.atendimentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "atendimento_conversation_events")
public class JpaAtendimentoConversationEventEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "event_text", nullable = false, length = 500)
    private String eventText;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "actor_user_name", length = 180)
    private String actorUserName;

    @Column(name = "event_at", nullable = false)
    private Instant eventAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public UUID getConversationId() { return conversationId; }
    public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getEventText() { return eventText; }
    public void setEventText(String eventText) { this.eventText = eventText; }
    public UUID getActorUserId() { return actorUserId; }
    public void setActorUserId(UUID actorUserId) { this.actorUserId = actorUserId; }
    public String getActorUserName() { return actorUserName; }
    public void setActorUserName(String actorUserName) { this.actorUserName = actorUserName; }
    public Instant getEventAt() { return eventAt; }
    public void setEventAt(Instant eventAt) { this.eventAt = eventAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
