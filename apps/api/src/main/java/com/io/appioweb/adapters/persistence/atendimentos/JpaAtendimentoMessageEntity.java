package com.io.appioweb.adapters.persistence.atendimentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "atendimento_messages")
public class JpaAtendimentoMessageEntity {

    @Id
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(name = "message_text", columnDefinition = "text")
    private String messageText;

    @Column(name = "message_type", nullable = false, length = 40)
    private String messageType;

    @Column(name = "from_me", nullable = false)
    private boolean fromMe;

    @Column(length = 20)
    private String status;

    @Column
    private Long moment;

    @Column(name = "payload_json", columnDefinition = "text")
    private String payloadJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getConversationId() { return conversationId; }
    public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMessageText() { return messageText; }
    public void setMessageText(String messageText) { this.messageText = messageText; }

    public String getMessageType() { return messageType; }
    public void setMessageType(String messageType) { this.messageType = messageType; }

    public boolean isFromMe() { return fromMe; }
    public void setFromMe(boolean fromMe) { this.fromMe = fromMe; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getMoment() { return moment; }
    public void setMoment(Long moment) { this.moment = moment; }

    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

