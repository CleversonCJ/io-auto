package com.io.appioweb.adapters.persistence.atendimentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
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

    @Column(name = "sale_original_amount_cents")
    private Long saleOriginalAmountCents;

    @Column(name = "sale_discount_percentage", precision = 7, scale = 4)
    private java.math.BigDecimal saleDiscountPercentage;

    @Column(name = "sale_discount_amount_cents")
    private Long saleDiscountAmountCents;

    @Column(name = "sale_amount_after_discount_cents")
    private Long saleAmountAfterDiscountCents;

    @Column(name = "sale_has_trade_in", nullable = false)
    private boolean saleHasTradeIn;

    @Column(name = "sale_trade_in_vehicle_id")
    private UUID saleTradeInVehicleId;

    @Column(name = "sale_trade_in_description", length = 255)
    private String saleTradeInDescription;

    @Column(name = "sale_trade_in_amount_cents")
    private Long saleTradeInAmountCents;

    @Column(name = "sale_total_real_amount_cents")
    private Long saleTotalRealAmountCents;

    @Column(name = "sale_installment_sale", nullable = false)
    private boolean saleInstallmentSale;

    @Column(name = "sale_installment_count")
    private Integer saleInstallmentCount;

    @Column(name = "sale_first_due_date")
    private LocalDate saleFirstDueDate;

    @Column(name = "sale_is_consigned", nullable = false)
    private boolean saleIsConsigned;

    @Column(name = "sale_consigned_owner_name", length = 200)
    private String saleConsignedOwnerName;

    @Column(name = "sale_consignment_commission_type", length = 20)
    private String saleConsignmentCommissionType;

    @Column(name = "sale_consignment_commission_percentage", precision = 7, scale = 4)
    private java.math.BigDecimal saleConsignmentCommissionPercentage;

    @Column(name = "sale_consignment_commission_amount_cents")
    private Long saleConsignmentCommissionAmountCents;

    @Column(name = "sale_consignment_base_amount_cents")
    private Long saleConsignmentBaseAmountCents;

    @Column(name = "sale_consignment_owner_transfer_amount_cents")
    private Long saleConsignmentOwnerTransferAmountCents;

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

    public Long getSaleOriginalAmountCents() { return saleOriginalAmountCents; }
    public void setSaleOriginalAmountCents(Long saleOriginalAmountCents) { this.saleOriginalAmountCents = saleOriginalAmountCents; }

    public java.math.BigDecimal getSaleDiscountPercentage() { return saleDiscountPercentage; }
    public void setSaleDiscountPercentage(java.math.BigDecimal saleDiscountPercentage) { this.saleDiscountPercentage = saleDiscountPercentage; }

    public Long getSaleDiscountAmountCents() { return saleDiscountAmountCents; }
    public void setSaleDiscountAmountCents(Long saleDiscountAmountCents) { this.saleDiscountAmountCents = saleDiscountAmountCents; }

    public Long getSaleAmountAfterDiscountCents() { return saleAmountAfterDiscountCents; }
    public void setSaleAmountAfterDiscountCents(Long saleAmountAfterDiscountCents) { this.saleAmountAfterDiscountCents = saleAmountAfterDiscountCents; }

    public boolean isSaleHasTradeIn() { return saleHasTradeIn; }
    public void setSaleHasTradeIn(boolean saleHasTradeIn) { this.saleHasTradeIn = saleHasTradeIn; }

    public UUID getSaleTradeInVehicleId() { return saleTradeInVehicleId; }
    public void setSaleTradeInVehicleId(UUID saleTradeInVehicleId) { this.saleTradeInVehicleId = saleTradeInVehicleId; }

    public String getSaleTradeInDescription() { return saleTradeInDescription; }
    public void setSaleTradeInDescription(String saleTradeInDescription) { this.saleTradeInDescription = saleTradeInDescription; }

    public Long getSaleTradeInAmountCents() { return saleTradeInAmountCents; }
    public void setSaleTradeInAmountCents(Long saleTradeInAmountCents) { this.saleTradeInAmountCents = saleTradeInAmountCents; }

    public Long getSaleTotalRealAmountCents() { return saleTotalRealAmountCents; }
    public void setSaleTotalRealAmountCents(Long saleTotalRealAmountCents) { this.saleTotalRealAmountCents = saleTotalRealAmountCents; }

    public boolean isSaleInstallmentSale() { return saleInstallmentSale; }
    public void setSaleInstallmentSale(boolean saleInstallmentSale) { this.saleInstallmentSale = saleInstallmentSale; }

    public Integer getSaleInstallmentCount() { return saleInstallmentCount; }
    public void setSaleInstallmentCount(Integer saleInstallmentCount) { this.saleInstallmentCount = saleInstallmentCount; }

    public LocalDate getSaleFirstDueDate() { return saleFirstDueDate; }
    public void setSaleFirstDueDate(LocalDate saleFirstDueDate) { this.saleFirstDueDate = saleFirstDueDate; }

    public boolean isSaleIsConsigned() { return saleIsConsigned; }
    public void setSaleIsConsigned(boolean saleIsConsigned) { this.saleIsConsigned = saleIsConsigned; }

    public String getSaleConsignedOwnerName() { return saleConsignedOwnerName; }
    public void setSaleConsignedOwnerName(String saleConsignedOwnerName) { this.saleConsignedOwnerName = saleConsignedOwnerName; }

    public String getSaleConsignmentCommissionType() { return saleConsignmentCommissionType; }
    public void setSaleConsignmentCommissionType(String saleConsignmentCommissionType) { this.saleConsignmentCommissionType = saleConsignmentCommissionType; }

    public java.math.BigDecimal getSaleConsignmentCommissionPercentage() { return saleConsignmentCommissionPercentage; }
    public void setSaleConsignmentCommissionPercentage(java.math.BigDecimal saleConsignmentCommissionPercentage) { this.saleConsignmentCommissionPercentage = saleConsignmentCommissionPercentage; }

    public Long getSaleConsignmentCommissionAmountCents() { return saleConsignmentCommissionAmountCents; }
    public void setSaleConsignmentCommissionAmountCents(Long saleConsignmentCommissionAmountCents) { this.saleConsignmentCommissionAmountCents = saleConsignmentCommissionAmountCents; }

    public Long getSaleConsignmentBaseAmountCents() { return saleConsignmentBaseAmountCents; }
    public void setSaleConsignmentBaseAmountCents(Long saleConsignmentBaseAmountCents) { this.saleConsignmentBaseAmountCents = saleConsignmentBaseAmountCents; }

    public Long getSaleConsignmentOwnerTransferAmountCents() { return saleConsignmentOwnerTransferAmountCents; }
    public void setSaleConsignmentOwnerTransferAmountCents(Long saleConsignmentOwnerTransferAmountCents) { this.saleConsignmentOwnerTransferAmountCents = saleConsignmentOwnerTransferAmountCents; }

    public AtendimentoSessionStatus getStatus() { return status; }
    public void setStatus(AtendimentoSessionStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
