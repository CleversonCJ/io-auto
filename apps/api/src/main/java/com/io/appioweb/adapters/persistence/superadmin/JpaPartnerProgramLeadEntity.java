package com.io.appioweb.adapters.persistence.superadmin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "partner_program_leads")
public class JpaPartnerProgramLeadEntity {

    @Id
    private UUID id;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Column(name = "shopkeeper_name", nullable = false, length = 160)
    private String shopkeeperName;

    @Column(name = "store_name", nullable = false, length = 160)
    private String storeName;

    @Column(name = "whatsapp", nullable = false, length = 30)
    private String whatsapp;

    @Column(name = "email", length = 180)
    private String email;

    @Column(name = "city", length = 120)
    private String city;

    @Column(name = "state", length = 2)
    private String state;

    @Column(name = "approximate_stock")
    private Integer approximateStock;

    @Column(name = "lead_status", nullable = false, length = 30)
    private String leadStatus;

    @Column(name = "sales_owner", length = 160)
    private String salesOwner;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "closed_plan", length = 120)
    private String closedPlan;

    @Column(name = "first_monthly_fee_cents")
    private Long firstMonthlyFeeCents;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "commission_cents")
    private Long commissionCents;

    @Column(name = "commission_status", length = 30)
    private String commissionStatus;

    @Column(name = "commission_due_date")
    private LocalDate commissionDueDate;

    @Column(name = "commission_paid_at")
    private Instant commissionPaidAt;

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

    public UUID getPartnerId() {
        return partnerId;
    }

    public void setPartnerId(UUID partnerId) {
        this.partnerId = partnerId;
    }

    public String getShopkeeperName() {
        return shopkeeperName;
    }

    public void setShopkeeperName(String shopkeeperName) {
        this.shopkeeperName = shopkeeperName;
    }

    public String getStoreName() {
        return storeName;
    }

    public void setStoreName(String storeName) {
        this.storeName = storeName;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public void setWhatsapp(String whatsapp) {
        this.whatsapp = whatsapp;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public Integer getApproximateStock() {
        return approximateStock;
    }

    public void setApproximateStock(Integer approximateStock) {
        this.approximateStock = approximateStock;
    }

    public String getLeadStatus() {
        return leadStatus;
    }

    public void setLeadStatus(String leadStatus) {
        this.leadStatus = leadStatus;
    }

    public String getSalesOwner() {
        return salesOwner;
    }

    public void setSalesOwner(String salesOwner) {
        this.salesOwner = salesOwner;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getClosedPlan() {
        return closedPlan;
    }

    public void setClosedPlan(String closedPlan) {
        this.closedPlan = closedPlan;
    }

    public Long getFirstMonthlyFeeCents() {
        return firstMonthlyFeeCents;
    }

    public void setFirstMonthlyFeeCents(Long firstMonthlyFeeCents) {
        this.firstMonthlyFeeCents = firstMonthlyFeeCents;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public Long getCommissionCents() {
        return commissionCents;
    }

    public void setCommissionCents(Long commissionCents) {
        this.commissionCents = commissionCents;
    }

    public String getCommissionStatus() {
        return commissionStatus;
    }

    public void setCommissionStatus(String commissionStatus) {
        this.commissionStatus = commissionStatus;
    }

    public LocalDate getCommissionDueDate() {
        return commissionDueDate;
    }

    public void setCommissionDueDate(LocalDate commissionDueDate) {
        this.commissionDueDate = commissionDueDate;
    }

    public Instant getCommissionPaidAt() {
        return commissionPaidAt;
    }

    public void setCommissionPaidAt(Instant commissionPaidAt) {
        this.commissionPaidAt = commissionPaidAt;
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
