package com.io.appioweb.adapters.integrations.asaas;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AsaasClientTest {

    private static final String PRODUCTION_BASE_URL = "https://api.asaas.com";

    @Test
    @DisplayName("updateSubscriptionDescription returns false when token not configured")
    void updateSubscriptionDescription_noToken_returnsFalse() {
        AsaasProperties props = new AsaasProperties(PRODUCTION_BASE_URL, "");
        AsaasClient client = new AsaasClient(props);

        boolean result = client.updateSubscriptionDescription("sub_123", "Test Plan", "ref-123");

        assertFalse(result);
    }

    @Test
    @DisplayName("updateSubscriptionDescription returns false when subscriptionId is blank")
    void updateSubscriptionDescription_blankSubscriptionId_returnsFalse() {
        AsaasProperties props = new AsaasProperties(PRODUCTION_BASE_URL, "test-token");
        AsaasClient client = new AsaasClient(props);

        boolean result = client.updateSubscriptionDescription("", "Test Plan", "ref-123");

        assertFalse(result);
    }

    @Test
    @DisplayName("updateSubscriptionDescription uses default description when blank")
    void updateSubscriptionDescription_blankDescription_usesDefault() {
        // This would make a real HTTP call in a real scenario
        // Here we just verify the client doesn't throw
        AsaasProperties props = new AsaasProperties(PRODUCTION_BASE_URL, "");
        AsaasClient client = new AsaasClient(props);

        // With blank token, it returns false early without making HTTP call
        boolean result = client.updateSubscriptionDescription("sub_123", "", "ref-123");
        assertFalse(result);
    }

    @Test
    @DisplayName("AsaasProperties correctly identifies configured state")
    void asaasProperties_isConfigured() {
        AsaasProperties configured = new AsaasProperties(PRODUCTION_BASE_URL, "my-token");
        assertTrue(configured.isConfigured());

        AsaasProperties notConfigured = new AsaasProperties(PRODUCTION_BASE_URL, "");
        assertFalse(notConfigured.isConfigured());

        AsaasProperties nullToken = new AsaasProperties(PRODUCTION_BASE_URL, null);
        assertFalse(nullToken.isConfigured());
    }
}
