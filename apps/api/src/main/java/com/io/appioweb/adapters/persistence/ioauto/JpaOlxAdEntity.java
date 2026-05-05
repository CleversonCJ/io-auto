package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "olx_ads")
public class JpaOlxAdEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "vehicle_id", nullable = false)
    private UUID vehicleId;

    @Column(name = "local_ad_id", nullable = false, length = 19)
    private String localAdId;

    @Column(name = "olx_list_id", length = 255)
    private String olxListId;

    @Column(name = "olx_url", columnDefinition = "text")
    private String olxUrl;

    @Column(name = "import_token", length = 255)
    private String importToken;

    @Column(length = 30)
    private String operation;

    @Column(length = 80)
    private String status;

    @Column(name = "last_status_message", columnDefinition = "text")
    private String lastStatusMessage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_payload", columnDefinition = "jsonb")
    private String lastPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_response", columnDefinition = "jsonb")
    private String lastResponse;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

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

    public String getLocalAdId() {
        return localAdId;
    }

    public void setLocalAdId(String localAdId) {
        this.localAdId = localAdId;
    }

    public String getOlxListId() {
        return olxListId;
    }

    public void setOlxListId(String olxListId) {
        this.olxListId = olxListId;
    }

    public String getOlxUrl() {
        return olxUrl;
    }

    public void setOlxUrl(String olxUrl) {
        this.olxUrl = olxUrl;
    }

    public String getImportToken() {
        return importToken;
    }

    public void setImportToken(String importToken) {
        this.importToken = importToken;
    }

    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getLastStatusMessage() {
        return lastStatusMessage;
    }

    public void setLastStatusMessage(String lastStatusMessage) {
        this.lastStatusMessage = lastStatusMessage;
    }

    public String getLastPayload() {
        return lastPayload;
    }

    public void setLastPayload(String lastPayload) {
        this.lastPayload = lastPayload;
    }

    public String getLastResponse() {
        return lastResponse;
    }

    public void setLastResponse(String lastResponse) {
        this.lastResponse = lastResponse;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
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
