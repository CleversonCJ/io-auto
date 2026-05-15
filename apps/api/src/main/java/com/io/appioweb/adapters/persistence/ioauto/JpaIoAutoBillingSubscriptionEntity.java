package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ioauto_billing_subscriptions")
public class JpaIoAutoBillingSubscriptionEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 40)
    private String provider;

    @Column(name = "provider_customer_id", length = 180)
    private String providerCustomerId;

    @Column(name = "provider_subscription_id", length = 180)
    private String providerSubscriptionId;

    @Column(name = "provider_price_id", length = 180)
    private String providerPriceId;

    @Column(name = "plan_key", nullable = false, length = 80)
    private String planKey;

    @Column(name = "plan_name", nullable = false, length = 160)
    private String planName;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "amount_cents")
    private Long amountCents;

    @Column(length = 10)
    private String currency;

    @Column(name = "billing_interval", length = 20)
    private String billingInterval;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column(name = "cancel_at_period_end", nullable = false)
    private boolean cancelAtPeriodEnd;

    @Column(name = "checkout_session_id", length = 180)
    private String checkoutSessionId;

    @Column(name = "pending_proration_credit_cents")
    private Long pendingProrationCreditCents;

    @Column(name = "pending_proration_credit_note", length = 255)
    private String pendingProrationCreditNote;

    @Column(name = "pending_proration_credit_updated_at")
    private Instant pendingProrationCreditUpdatedAt;

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

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderCustomerId() {
        return providerCustomerId;
    }

    public void setProviderCustomerId(String providerCustomerId) {
        this.providerCustomerId = providerCustomerId;
    }

    public String getProviderSubscriptionId() {
        return providerSubscriptionId;
    }

    public void setProviderSubscriptionId(String providerSubscriptionId) {
        this.providerSubscriptionId = providerSubscriptionId;
    }

    public String getProviderPriceId() {
        return providerPriceId;
    }

    public void setProviderPriceId(String providerPriceId) {
        this.providerPriceId = providerPriceId;
    }

    public String getPlanKey() {
        return planKey;
    }

    public void setPlanKey(String planKey) {
        this.planKey = planKey;
    }

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getAmountCents() {
        return amountCents;
    }

    public void setAmountCents(Long amountCents) {
        this.amountCents = amountCents;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getBillingInterval() {
        return billingInterval;
    }

    public void setBillingInterval(String billingInterval) {
        this.billingInterval = billingInterval;
    }

    public Instant getCurrentPeriodEnd() {
        return currentPeriodEnd;
    }

    public void setCurrentPeriodEnd(Instant currentPeriodEnd) {
        this.currentPeriodEnd = currentPeriodEnd;
    }

    public boolean isCancelAtPeriodEnd() {
        return cancelAtPeriodEnd;
    }

    public void setCancelAtPeriodEnd(boolean cancelAtPeriodEnd) {
        this.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    public String getCheckoutSessionId() {
        return checkoutSessionId;
    }

    public void setCheckoutSessionId(String checkoutSessionId) {
        this.checkoutSessionId = checkoutSessionId;
    }

    public Long getPendingProrationCreditCents() {
        return pendingProrationCreditCents;
    }

    public void setPendingProrationCreditCents(Long pendingProrationCreditCents) {
        this.pendingProrationCreditCents = pendingProrationCreditCents;
    }

    public String getPendingProrationCreditNote() {
        return pendingProrationCreditNote;
    }

    public void setPendingProrationCreditNote(String pendingProrationCreditNote) {
        this.pendingProrationCreditNote = pendingProrationCreditNote;
    }

    public Instant getPendingProrationCreditUpdatedAt() {
        return pendingProrationCreditUpdatedAt;
    }

    public void setPendingProrationCreditUpdatedAt(Instant pendingProrationCreditUpdatedAt) {
        this.pendingProrationCreditUpdatedAt = pendingProrationCreditUpdatedAt;
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
