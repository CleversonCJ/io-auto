package com.io.appioweb.adapters.persistence.superadmin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ioauto_subscription_plans")
public class JpaSubscriptionPlanEntity {

    @Id
    private UUID id;

    @Column(name = "plan_key", nullable = false, length = 80)
    private String planKey;

    @Column(name = "plan_name", nullable = false, length = 160)
    private String planName;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "billing_recurrence", length = 20)
    private String billingRecurrence;

    @Column(name = "price_cents")
    private Long priceCents;

    @Column(name = "is_custom", nullable = false)
    private boolean customPlan;

    @Column(name = "is_system", nullable = false)
    private boolean systemPlan;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "users_limit")
    private Integer usersLimit;

    @Column(name = "vehicles_limit")
    private Integer vehiclesLimit;

    @Column(name = "active_ads_limit")
    private Integer activeAdsLimit;

    @Column(name = "feature_catalog_bio_link", nullable = false)
    private boolean featureCatalogBioLink;

    @Column(name = "feature_whatsapp_sharing", nullable = false)
    private boolean featureWhatsappSharing;

    @Column(name = "feature_storefront_page", nullable = false)
    private boolean featureStorefrontPage;

    @Column(name = "feature_webmotors", nullable = false)
    private boolean featureWebmotors;

    @Column(name = "feature_olx", nullable = false)
    private boolean featureOlx;

    @Column(name = "feature_icarros", nullable = false)
    private boolean featureIcarros;

    @Column(name = "feature_crm_kanban", nullable = false)
    private boolean featureCrmKanban;

    @Column(name = "feature_lead_management", nullable = false)
    private boolean featureLeadManagement;

    @Column(name = "feature_finance", nullable = false)
    private boolean featureFinance;

    @Column(name = "feature_reports", nullable = false)
    private boolean featureReports;

    @Column(name = "feature_trackable_links", nullable = false)
    private boolean featureTrackableLinks;

    @Column(name = "feature_multiunits", nullable = false)
    private boolean featureMultiunits;

    @Column(name = "feature_advanced_multiuser", nullable = false)
    private boolean featureAdvancedMultiuser;

    @Column(name = "feature_executive_dashboard", nullable = false)
    private boolean featureExecutiveDashboard;

    @Column(name = "feature_integrations_api", nullable = false)
    private boolean featureIntegrationsApi;

    @Column(name = "feature_assisted_onboarding", nullable = false)
    private boolean featureAssistedOnboarding;

    @Column(name = "feature_priority_support", nullable = false)
    private boolean featurePrioritySupport;

    @Column(name = "feature_customizations", nullable = false)
    private boolean featureCustomizations;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getPlanKey() { return planKey; }
    public void setPlanKey(String planKey) { this.planKey = planKey; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getBillingRecurrence() { return billingRecurrence; }
    public void setBillingRecurrence(String billingRecurrence) { this.billingRecurrence = billingRecurrence; }

    public Long getPriceCents() { return priceCents; }
    public void setPriceCents(Long priceCents) { this.priceCents = priceCents; }

    public boolean isCustomPlan() { return customPlan; }
    public void setCustomPlan(boolean customPlan) { this.customPlan = customPlan; }

    public boolean isSystemPlan() { return systemPlan; }
    public void setSystemPlan(boolean systemPlan) { this.systemPlan = systemPlan; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public Integer getUsersLimit() { return usersLimit; }
    public void setUsersLimit(Integer usersLimit) { this.usersLimit = usersLimit; }

    public Integer getVehiclesLimit() { return vehiclesLimit; }
    public void setVehiclesLimit(Integer vehiclesLimit) { this.vehiclesLimit = vehiclesLimit; }

    public Integer getActiveAdsLimit() { return activeAdsLimit; }
    public void setActiveAdsLimit(Integer activeAdsLimit) { this.activeAdsLimit = activeAdsLimit; }

    public boolean isFeatureCatalogBioLink() { return featureCatalogBioLink; }
    public void setFeatureCatalogBioLink(boolean featureCatalogBioLink) { this.featureCatalogBioLink = featureCatalogBioLink; }

    public boolean isFeatureWhatsappSharing() { return featureWhatsappSharing; }
    public void setFeatureWhatsappSharing(boolean featureWhatsappSharing) { this.featureWhatsappSharing = featureWhatsappSharing; }

    public boolean isFeatureStorefrontPage() { return featureStorefrontPage; }
    public void setFeatureStorefrontPage(boolean featureStorefrontPage) { this.featureStorefrontPage = featureStorefrontPage; }

    public boolean isFeatureWebmotors() { return featureWebmotors; }
    public void setFeatureWebmotors(boolean featureWebmotors) { this.featureWebmotors = featureWebmotors; }

    public boolean isFeatureOlx() { return featureOlx; }
    public void setFeatureOlx(boolean featureOlx) { this.featureOlx = featureOlx; }

    public boolean isFeatureIcarros() { return featureIcarros; }
    public void setFeatureIcarros(boolean featureIcarros) { this.featureIcarros = featureIcarros; }

    public boolean isFeatureCrmKanban() { return featureCrmKanban; }
    public void setFeatureCrmKanban(boolean featureCrmKanban) { this.featureCrmKanban = featureCrmKanban; }

    public boolean isFeatureLeadManagement() { return featureLeadManagement; }
    public void setFeatureLeadManagement(boolean featureLeadManagement) { this.featureLeadManagement = featureLeadManagement; }

    public boolean isFeatureFinance() { return featureFinance; }
    public void setFeatureFinance(boolean featureFinance) { this.featureFinance = featureFinance; }

    public boolean isFeatureReports() { return featureReports; }
    public void setFeatureReports(boolean featureReports) { this.featureReports = featureReports; }

    public boolean isFeatureTrackableLinks() { return featureTrackableLinks; }
    public void setFeatureTrackableLinks(boolean featureTrackableLinks) { this.featureTrackableLinks = featureTrackableLinks; }

    public boolean isFeatureMultiunits() { return featureMultiunits; }
    public void setFeatureMultiunits(boolean featureMultiunits) { this.featureMultiunits = featureMultiunits; }

    public boolean isFeatureAdvancedMultiuser() { return featureAdvancedMultiuser; }
    public void setFeatureAdvancedMultiuser(boolean featureAdvancedMultiuser) { this.featureAdvancedMultiuser = featureAdvancedMultiuser; }

    public boolean isFeatureExecutiveDashboard() { return featureExecutiveDashboard; }
    public void setFeatureExecutiveDashboard(boolean featureExecutiveDashboard) { this.featureExecutiveDashboard = featureExecutiveDashboard; }

    public boolean isFeatureIntegrationsApi() { return featureIntegrationsApi; }
    public void setFeatureIntegrationsApi(boolean featureIntegrationsApi) { this.featureIntegrationsApi = featureIntegrationsApi; }

    public boolean isFeatureAssistedOnboarding() { return featureAssistedOnboarding; }
    public void setFeatureAssistedOnboarding(boolean featureAssistedOnboarding) { this.featureAssistedOnboarding = featureAssistedOnboarding; }

    public boolean isFeaturePrioritySupport() { return featurePrioritySupport; }
    public void setFeaturePrioritySupport(boolean featurePrioritySupport) { this.featurePrioritySupport = featurePrioritySupport; }

    public boolean isFeatureCustomizations() { return featureCustomizations; }
    public void setFeatureCustomizations(boolean featureCustomizations) { this.featureCustomizations = featureCustomizations; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
