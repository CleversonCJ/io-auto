package com.io.appioweb.adapters.persistence.atendimentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "atendimento_conversations")
public class JpaAtendimentoConversationEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(name = "display_name", length = 180)
    private String displayName;

    @Column(name = "contact_display_phone", length = 30)
    private String contactDisplayPhone;

    @Column(name = "contact_description", columnDefinition = "text")
    private String contactDescription;

    @Column(name = "contact_lid", length = 80)
    private String contactLid;

    @Column(name = "contact_photo_url", columnDefinition = "text")
    private String contactPhotoUrl;

    @Column(name = "source_platform", nullable = false, length = 40)
    private String sourcePlatform;

    @Column(name = "source_reference", length = 180)
    private String sourceReference;

    @Column(name = "last_message_text", columnDefinition = "text")
    private String lastMessageText;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "assigned_team_id")
    private UUID assignedTeamId;

    @Column(name = "assigned_user_id")
    private UUID assignedUserId;

    @Column(name = "assigned_user_name", length = 180)
    private String assignedUserName;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "presence_status", length = 20)
    private String presenceStatus;

    @Column(name = "presence_last_seen")
    private Instant presenceLastSeen;

    @Column(name = "presence_updated_at")
    private Instant presenceUpdatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getContactDisplayPhone() { return contactDisplayPhone; }
    public void setContactDisplayPhone(String contactDisplayPhone) { this.contactDisplayPhone = contactDisplayPhone; }

    public String getContactDescription() { return contactDescription; }
    public void setContactDescription(String contactDescription) { this.contactDescription = contactDescription; }

    public String getContactLid() { return contactLid; }
    public void setContactLid(String contactLid) { this.contactLid = contactLid; }

    public String getContactPhotoUrl() { return contactPhotoUrl; }
    public void setContactPhotoUrl(String contactPhotoUrl) { this.contactPhotoUrl = contactPhotoUrl; }

    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }

    public String getSourceReference() { return sourceReference; }
    public void setSourceReference(String sourceReference) { this.sourceReference = sourceReference; }

    public String getLastMessageText() { return lastMessageText; }
    public void setLastMessageText(String lastMessageText) { this.lastMessageText = lastMessageText; }

    public Instant getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(Instant lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getAssignedTeamId() { return assignedTeamId; }
    public void setAssignedTeamId(UUID assignedTeamId) { this.assignedTeamId = assignedTeamId; }

    public UUID getAssignedUserId() { return assignedUserId; }
    public void setAssignedUserId(UUID assignedUserId) { this.assignedUserId = assignedUserId; }

    public String getAssignedUserName() { return assignedUserName; }
    public void setAssignedUserName(String assignedUserName) { this.assignedUserName = assignedUserName; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public String getPresenceStatus() { return presenceStatus; }
    public void setPresenceStatus(String presenceStatus) { this.presenceStatus = presenceStatus; }

    public Instant getPresenceLastSeen() { return presenceLastSeen; }
    public void setPresenceLastSeen(Instant presenceLastSeen) { this.presenceLastSeen = presenceLastSeen; }

    public Instant getPresenceUpdatedAt() { return presenceUpdatedAt; }
    public void setPresenceUpdatedAt(Instant presenceUpdatedAt) { this.presenceUpdatedAt = presenceUpdatedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
