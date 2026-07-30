package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ioauto_public_links")
public class JpaIoAutoPublicLinkEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "vehicle_id")
    private UUID vehicleId;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "link_kind", nullable = false, length = 30)
    private String linkKind;

    @Column(name = "scope_type", nullable = false, length = 30)
    private String scopeType;

    @Column(name = "source_type", length = 40)
    private String sourceType;

    @Column(name = "source_reference", length = 160)
    private String sourceReference;

    @Column(name = "use_company_whatsapp", nullable = false)
    private boolean useCompanyWhatsapp = true;

    @Column(name = "whatsapp_number", length = 20)
    private String whatsappNumber;

    @Column(name = "responsible_user_id")
    private UUID responsibleUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public UUID getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(UUID vehicleId) {
        this.vehicleId = vehicleId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLinkKind() {
        return linkKind;
    }

    public void setLinkKind(String linkKind) {
        this.linkKind = linkKind;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public void setSourceReference(String sourceReference) {
        this.sourceReference = sourceReference;
    }

    public boolean isUseCompanyWhatsapp() {
        return useCompanyWhatsapp;
    }

    public void setUseCompanyWhatsapp(boolean useCompanyWhatsapp) {
        this.useCompanyWhatsapp = useCompanyWhatsapp;
    }

    public String getWhatsappNumber() {
        return whatsappNumber;
    }

    public void setWhatsappNumber(String whatsappNumber) {
        this.whatsappNumber = whatsappNumber;
    }

    public UUID getResponsibleUserId() {
        return responsibleUserId;
    }

    public void setResponsibleUserId(UUID responsibleUserId) {
        this.responsibleUserId = responsibleUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
