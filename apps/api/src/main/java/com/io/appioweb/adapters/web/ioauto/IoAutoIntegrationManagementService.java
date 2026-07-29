package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAccountRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxAccountRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsCredentialRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class IoAutoIntegrationManagementService {

    private static final String PROVIDER_MERCADO_LIVRE = "mercadolivre";
    private static final String PROVIDER_OLX = "olx";
    private static final String PROVIDER_WEBMOTORS = "webmotors";

    private final IoAutoIntegrationRepositoryJpa integrations;
    private final MeliAccountRepositoryJpa meliAccounts;
    private final OlxAccountRepositoryJpa olxAccounts;
    private final WebmotorsCredentialRepositoryJpa webmotorsCredentials;

    public IoAutoIntegrationManagementService(
            IoAutoIntegrationRepositoryJpa integrations,
            MeliAccountRepositoryJpa meliAccounts,
            OlxAccountRepositoryJpa olxAccounts,
            WebmotorsCredentialRepositoryJpa webmotorsCredentials
    ) {
        this.integrations = integrations;
        this.meliAccounts = meliAccounts;
        this.olxAccounts = olxAccounts;
        this.webmotorsCredentials = webmotorsCredentials;
    }

    @Transactional
    public void deleteDisconnectedIntegration(UUID companyId, String providerKey) {
        String normalizedProviderKey = normalizeProviderKey(providerKey);
        JpaIoAutoIntegrationEntity integration = integrations
                .findByCompanyIdAndProviderKeyIgnoreCase(companyId, normalizedProviderKey)
                .orElse(null);

        if (isConnected(companyId, normalizedProviderKey, integration)) {
            throw new BusinessException(
                    "IOAUTO_INTEGRATION_CONNECTED",
                    "Desconecte a integracao antes de exclui-la."
            );
        }

        deleteProviderCredentials(companyId, normalizedProviderKey);
        if (integration != null) {
            integrations.delete(integration);
        }
    }

    @Transactional
    public void markWebmotorsConnected(UUID companyId) {
        Instant now = Instant.now();
        JpaIoAutoIntegrationEntity integration = integrations
                .findByCompanyIdAndProviderKeyIgnoreCase(companyId, PROVIDER_WEBMOTORS)
                .orElseGet(() -> newIntegration(companyId, PROVIDER_WEBMOTORS, "Webmotors / Estoque e Leads", now));
        integration.setStatus("CONNECTED");
        integration.setLastError(null);
        integration.setLastSyncAt(now);
        integration.setUpdatedAt(now);
        integrations.save(integration);
    }

    @Transactional
    public void disconnectWebmotors(UUID companyId) {
        webmotorsCredentials.deleteAllByCompanyId(companyId);
        integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, PROVIDER_WEBMOTORS)
                .ifPresent(integration -> {
                    integration.setStatus("CONFIGURATION_REQUIRED");
                    integration.setAccountName(null);
                    integration.setUsername(null);
                    integration.setApiToken(null);
                    integration.setWebhookSecret(null);
                    integration.setLastError(null);
                    integration.setLastSyncAt(null);
                    integration.setUpdatedAt(Instant.now());
                    integrations.save(integration);
                });
    }

    private boolean isConnected(
            UUID companyId,
            String providerKey,
            JpaIoAutoIntegrationEntity integration
    ) {
        if (integration != null && isConnectedStatus(integration.getStatus())) {
            return true;
        }
        if (PROVIDER_MERCADO_LIVRE.equals(providerKey)) {
            return meliAccounts.findByCompanyId(companyId)
                    .map(account -> account.isActive()
                            && !safe(account.getAccessToken()).isBlank()
                            && !safe(account.getRefreshToken()).isBlank())
                    .orElse(false);
        }
        if (PROVIDER_OLX.equals(providerKey)) {
            return olxAccounts.findByCompanyId(companyId)
                    .map(account -> account.isActive() && !safe(account.getAccessToken()).isBlank())
                    .orElse(false);
        }
        return false;
    }

    private void deleteProviderCredentials(UUID companyId, String providerKey) {
        if (PROVIDER_MERCADO_LIVRE.equals(providerKey)) {
            meliAccounts.deleteAllByCompanyId(companyId);
        } else if (PROVIDER_OLX.equals(providerKey)) {
            olxAccounts.deleteAllByCompanyId(companyId);
        } else if (PROVIDER_WEBMOTORS.equals(providerKey)) {
            webmotorsCredentials.deleteAllByCompanyId(companyId);
        }
    }

    private JpaIoAutoIntegrationEntity newIntegration(
            UUID companyId,
            String providerKey,
            String displayName,
            Instant now
    ) {
        JpaIoAutoIntegrationEntity integration = new JpaIoAutoIntegrationEntity();
        integration.setId(UUID.randomUUID());
        integration.setCompanyId(companyId);
        integration.setProviderKey(providerKey);
        integration.setDisplayName(displayName);
        integration.setStatus("CONFIGURATION_REQUIRED");
        integration.setSettingsJson("{}");
        integration.setCreatedAt(now);
        integration.setUpdatedAt(now);
        return integration;
    }

    private boolean isConnectedStatus(String status) {
        String normalized = safe(status).toUpperCase(Locale.ROOT);
        return "CONNECTED".equals(normalized) || "ACTIVE".equals(normalized);
    }

    private String normalizeProviderKey(String value) {
        String normalized = safe(value)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9-]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        if (normalized.isBlank()) {
            throw new BusinessException("IOAUTO_INTEGRATION_INVALID", "Informe uma integracao valida.");
        }
        return switch (normalized) {
            case "mercado-livre", "meli" -> PROVIDER_MERCADO_LIVRE;
            case "olx-autos" -> PROVIDER_OLX;
            case "web-motors" -> PROVIDER_WEBMOTORS;
            default -> normalized;
        };
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
