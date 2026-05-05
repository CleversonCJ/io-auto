package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "olx_accounts")
public class JpaOlxAccountEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "access_token", nullable = false, columnDefinition = "text")
    private String accessToken;

    @Column(name = "token_type", length = 50)
    private String tokenType;

    @Column(length = 255)
    private String scope;

    @Column(name = "olx_user_name", length = 255)
    private String olxUserName;

    @Column(name = "olx_user_email", length = 255)
    private String olxUserEmail;

    @Column(name = "webhook_notification_id", length = 255)
    private String webhookNotificationId;

    @Column(name = "connected_at")
    private Instant connectedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "disconnected_at")
    private Instant disconnectedAt;

    @Column(nullable = false)
    private boolean active;

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

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getOlxUserName() {
        return olxUserName;
    }

    public void setOlxUserName(String olxUserName) {
        this.olxUserName = olxUserName;
    }

    public String getOlxUserEmail() {
        return olxUserEmail;
    }

    public void setOlxUserEmail(String olxUserEmail) {
        this.olxUserEmail = olxUserEmail;
    }

    public String getWebhookNotificationId() {
        return webhookNotificationId;
    }

    public void setWebhookNotificationId(String webhookNotificationId) {
        this.webhookNotificationId = webhookNotificationId;
    }

    public Instant getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(Instant connectedAt) {
        this.connectedAt = connectedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getDisconnectedAt() {
        return disconnectedAt;
    }

    public void setDisconnectedAt(Instant disconnectedAt) {
        this.disconnectedAt = disconnectedAt;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
