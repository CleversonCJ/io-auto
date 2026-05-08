package com.io.appioweb.adapters.persistence.onboarding;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "onboarding_subscriptions")
public class JpaOnboardingSubscriptionEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "asaas_subscription_id", unique = true, length = 100)
    private String asaasSubscriptionId;

    @Column(name = "asaas_payment_id", length = 100)
    private String asaasPaymentId;

    @Column(name = "valor", nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;

    @Column(name = "recorrencia", nullable = false, length = 50)
    private String recorrencia;

    @Column(name = "data_assinatura")
    private LocalDate dataAssinatura;

    @Column(name = "origem", length = 255)
    private String origem;

    @Column(name = "status", nullable = false, length = 40)
    private String status;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "asaas_description_synced", nullable = false)
    private boolean asaasDescriptionSynced;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // --- Getters & Setters ---

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public String getAsaasSubscriptionId() { return asaasSubscriptionId; }
    public void setAsaasSubscriptionId(String asaasSubscriptionId) { this.asaasSubscriptionId = asaasSubscriptionId; }

    public String getAsaasPaymentId() { return asaasPaymentId; }
    public void setAsaasPaymentId(String asaasPaymentId) { this.asaasPaymentId = asaasPaymentId; }

    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }

    public String getRecorrencia() { return recorrencia; }
    public void setRecorrencia(String recorrencia) { this.recorrencia = recorrencia; }

    public LocalDate getDataAssinatura() { return dataAssinatura; }
    public void setDataAssinatura(LocalDate dataAssinatura) { this.dataAssinatura = dataAssinatura; }

    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isAsaasDescriptionSynced() { return asaasDescriptionSynced; }
    public void setAsaasDescriptionSynced(boolean asaasDescriptionSynced) { this.asaasDescriptionSynced = asaasDescriptionSynced; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
