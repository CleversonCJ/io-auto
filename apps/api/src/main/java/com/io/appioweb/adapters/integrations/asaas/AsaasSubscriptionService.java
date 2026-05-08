package com.io.appioweb.adapters.integrations.asaas;

import com.io.appioweb.adapters.persistence.onboarding.JpaOnboardingSubscriptionEntity;
import com.io.appioweb.adapters.persistence.onboarding.OnboardingSubscriptionRepositoryJpa;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Service that orchestrates Asaas subscription description syncing.
 * Wraps the AsaasClient and persists the sync status in the local subscription record.
 */
@Service
public class AsaasSubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(AsaasSubscriptionService.class);

    private final AsaasClient asaasClient;
    private final OnboardingSubscriptionRepositoryJpa subscriptionRepo;

    public AsaasSubscriptionService(AsaasClient asaasClient, OnboardingSubscriptionRepositoryJpa subscriptionRepo) {
        this.asaasClient = asaasClient;
        this.subscriptionRepo = subscriptionRepo;
    }

    /**
     * Syncs the subscription description in Asaas.
     * Updates asaas_description_synced flag on the local subscription record.
     *
     * @param subscription      Local subscription entity
     * @param planName          Plan name to set as description
     * @param externalReference External reference (company or subscription UUID)
     */
    public void syncDescription(JpaOnboardingSubscriptionEntity subscription, String planName, String externalReference) {
        String asaasSubId = subscription.getAsaasSubscriptionId();
        if (asaasSubId == null || asaasSubId.isBlank()) {
            log.info("[AsaasSubscriptionService] No Asaas subscriptionId – skipping description sync for subscription {}", subscription.getId());
            return;
        }

        try {
            boolean success = asaasClient.updateSubscriptionDescription(asaasSubId, planName, externalReference);
            subscription.setAsaasDescriptionSynced(success);
            if (!success) {
                log.warn("[AsaasSubscriptionService] Description sync failed for Asaas subscription {} – will retry later", asaasSubId);
            }
        } catch (Exception e) {
            log.error("[AsaasSubscriptionService] Error syncing description for Asaas subscription {}: {}", asaasSubId, e.getMessage(), e);
            subscription.setAsaasDescriptionSynced(false);
        }

        subscriptionRepo.save(subscription);
    }
}
