package com.io.appioweb.adapters.persistence.atendimentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "atendimento_sessions")
public class JpaAtendimentoSessionEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "channel_id", length = 180)
    private String channelId;

    @Column(name = "channel_name", length = 180)
    private String channelName;

    @Column(name = "responsible_user_id")
    private UUID responsibleUserId;

    @Column(name = "responsible_user_name", length = 180)
    private String responsibleUserName;

    @Column(name = "responsible_team_id")
    private UUID responsibleTeamId;

    @Column(name = "responsible_team_name", length = 180)
    private String responsibleTeamName;

    @Column(name = "arrived_at", nullable = false)
    private Instant arrivedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "first_response_at")
    private Instant firstResponseAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification_result", length = 40)
    private AtendimentoClassificationResult classificationResult;

    @Column(name = "classification_label", length = 180)
    private String classificationLabel;

    @Column(name = "sale_completed", nullable = false)
    private boolean saleCompleted;

    @Column(name = "sold_vehicle_id")
    private UUID soldVehicleId;

    @Column(name = "sold_vehicle_title", length = 200)
    private String soldVehicleTitle;

    @Column(name = "sale_completed_at")
    private Instant saleCompletedAt;

    @Column(name = "sale_origin_platform", length = 40)
    private String saleOriginPlatform;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AtendimentoSessionStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public UUID getConversationId() { return conversationId; }
    public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }

    public String getChannelId() { return channelId; }
    public void setChannelId(String channelId) { this.channelId = channelId; }

    public String getChannelName() { return channelName; }
    public void setChannelName(String channelName) { this.channelName = channelName; }

    public UUID getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(UUID responsibleUserId) { this.responsibleUserId = responsibleUserId; }

    public String getResponsibleUserName() { return responsibleUserName; }
    public void setResponsibleUserName(String responsibleUserName) { this.responsibleUserName = responsibleUserName; }

    public UUID getResponsibleTeamId() { return responsibleTeamId; }
    public void setResponsibleTeamId(UUID responsibleTeamId) { this.responsibleTeamId = responsibleTeamId; }

    public String getResponsibleTeamName() { return responsibleTeamName; }
    public void setResponsibleTeamName(String responsibleTeamName) { this.responsibleTeamName = responsibleTeamName; }

    public Instant getArrivedAt() { return arrivedAt; }
    public void setArrivedAt(Instant arrivedAt) { this.arrivedAt = arrivedAt; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getFirstResponseAt() { return firstResponseAt; }
    public void setFirstResponseAt(Instant firstResponseAt) { this.firstResponseAt = firstResponseAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public AtendimentoClassificationResult getClassificationResult() { return classificationResult; }
    public void setClassificationResult(AtendimentoClassificationResult classificationResult) { this.classificationResult = classificationResult; }

    public String getClassificationLabel() { return classificationLabel; }
    public void setClassificationLabel(String classificationLabel) { this.classificationLabel = classificationLabel; }

    public boolean isSaleCompleted() { return saleCompleted; }
    public void setSaleCompleted(boolean saleCompleted) { this.saleCompleted = saleCompleted; }

    public UUID getSoldVehicleId() { return soldVehicleId; }
    public void setSoldVehicleId(UUID soldVehicleId) { this.soldVehicleId = soldVehicleId; }

    public String getSoldVehicleTitle() { return soldVehicleTitle; }
    public void setSoldVehicleTitle(String soldVehicleTitle) { this.soldVehicleTitle = soldVehicleTitle; }

    public Instant getSaleCompletedAt() { return saleCompletedAt; }
    public void setSaleCompletedAt(Instant saleCompletedAt) { this.saleCompletedAt = saleCompletedAt; }

    public String getSaleOriginPlatform() { return saleOriginPlatform; }
    public void setSaleOriginPlatform(String saleOriginPlatform) { this.saleOriginPlatform = saleOriginPlatform; }

    public AtendimentoSessionStatus getStatus() { return status; }
    public void setStatus(AtendimentoSessionStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
