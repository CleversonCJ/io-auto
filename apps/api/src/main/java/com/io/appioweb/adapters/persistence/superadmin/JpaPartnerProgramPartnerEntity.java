package com.io.appioweb.adapters.persistence.superadmin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "partner_program_partners")
public class JpaPartnerProgramPartnerEntity {

    @Id
    private UUID id;

    @Column(name = "reference_code", nullable = false, unique = true, length = 40)
    private String referenceCode;

    @Column(name = "partner_name", nullable = false, length = 160)
    private String partnerName;

    @Column(name = "company_name", length = 160)
    private String companyName;

    @Column(name = "whatsapp", length = 30)
    private String whatsapp;

    @Column(name = "email", length = 180)
    private String email;

    @Column(name = "city", length = 120)
    private String city;

    @Column(name = "state", length = 2)
    private String state;

    @Column(name = "partner_type", length = 80)
    private String partnerType;

    @Column(name = "default_commission_bps", nullable = false)
    private Integer defaultCommissionBps;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

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

    public String getReferenceCode() {
        return referenceCode;
    }

    public void setReferenceCode(String referenceCode) {
        this.referenceCode = referenceCode;
    }

    public String getPartnerName() {
        return partnerName;
    }

    public void setPartnerName(String partnerName) {
        this.partnerName = partnerName;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
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

    public String getPartnerType() {
        return partnerType;
    }

    public void setPartnerType(String partnerType) {
        this.partnerType = partnerType;
    }

    public Integer getDefaultCommissionBps() {
        return defaultCommissionBps;
    }

    public void setDefaultCommissionBps(Integer defaultCommissionBps) {
        this.defaultCommissionBps = defaultCommissionBps;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
