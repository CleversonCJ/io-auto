package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAccountEntity;
import com.io.appioweb.adapters.persistence.ioauto.OlxAccountRepositoryJpa;
import com.io.appioweb.adapters.security.SensitiveDataCrypto;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class OlxAccountService {

    public static final String PROVIDER_KEY = "olx";

    private final OlxAccountRepositoryJpa accounts;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final SensitiveDataCrypto crypto;

    public OlxAccountService(
            OlxAccountRepositoryJpa accounts,
            IoAutoIntegrationRepositoryJpa integrations,
            SensitiveDataCrypto crypto
    ) {
        this.accounts = accounts;
        this.integrations = integrations;
        this.crypto = crypto;
    }

    @Transactional(readOnly = true)
    public OlxConnectionSnapshot getStatus(UUID companyId) {
        JpaOlxAccountEntity account = accounts.findByCompanyId(companyId).orElse(null);
        JpaIoAutoIntegrationEntity integration = integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, PROVIDER_KEY).orElse(null);
        boolean connected = account != null && account.isActive() && !safe(account.getAccessToken()).isBlank();
        return new OlxConnectionSnapshot(
                companyId,
                connected,
                integration == null ? "CONFIGURATION_REQUIRED" : safe(integration.getStatus(), "CONFIGURATION_REQUIRED"),
                account == null ? null : nullable(account.getOlxUserName()),
                account == null ? null : nullable(account.getOlxUserEmail()),
                account == null ? null : nullable(account.getWebhookNotificationId()),
                account == null ? null : account.getConnectedAt(),
                account == null ? null : account.getUpdatedAt(),
                account != null && account.isActive()
        );
    }

    @Transactional
    public OlxConnectionSnapshot saveConnection(
            UUID companyId,
            String accessToken,
            String tokenType,
            String scope,
            String userName,
            String userEmail
    ) {
        Instant now = Instant.now();
        JpaOlxAccountEntity account = accounts.findByCompanyId(companyId).orElseGet(JpaOlxAccountEntity::new);
        if (account.getId() == null) {
            account.setId(UUID.randomUUID());
            account.setCompanyId(companyId);
        }
        account.setAccessToken(crypto.encrypt(require(accessToken, "A OLX nao retornou um access token valido.")));
        account.setTokenType(nullable(tokenType));
        account.setScope(nullable(scope));
        account.setOlxUserName(nullable(userName));
        account.setOlxUserEmail(nullable(userEmail));
        account.setConnectedAt(account.getConnectedAt() == null ? now : account.getConnectedAt());
        account.setDisconnectedAt(null);
        account.setActive(true);
        account.setUpdatedAt(now);
        accounts.save(account);

        upsertIntegration(companyId, "CONNECTED", nullable(userName), nullable(userEmail), null, now);
        return getStatus(companyId);
    }

    @Transactional
    public void disconnect(UUID companyId) {
        Instant now = Instant.now();
        accounts.findByCompanyId(companyId).ifPresent(account -> {
            account.setAccessToken("");
            account.setActive(false);
            account.setDisconnectedAt(now);
            account.setUpdatedAt(now);
            accounts.save(account);
        });
        upsertIntegration(companyId, "CONFIGURATION_REQUIRED", null, null, null, now);
    }

    @Transactional(readOnly = true)
    public JpaOlxAccountEntity requireActiveAccount(UUID companyId) {
        JpaOlxAccountEntity account = accounts.findByCompanyId(companyId)
                .orElseThrow(() -> new BusinessException("OLX_NOT_CONNECTED", "Conecte a conta OLX da empresa antes de continuar."));
        if (!account.isActive() || safe(account.getAccessToken()).isBlank()) {
            throw new BusinessException("OLX_NOT_CONNECTED", "Conecte a conta OLX da empresa antes de continuar.");
        }
        return account;
    }

    @Transactional(readOnly = true)
    public String requireAccessToken(UUID companyId) {
        return crypto.decrypt(requireActiveAccount(companyId).getAccessToken());
    }

    @Transactional
    public void saveWebhookNotificationId(UUID companyId, String notificationId) {
        JpaOlxAccountEntity account = requireActiveAccount(companyId);
        account.setWebhookNotificationId(nullable(notificationId));
        account.setUpdatedAt(Instant.now());
        accounts.save(account);
    }

    @Transactional
    public void markIntegrationError(UUID companyId, String message) {
        upsertIntegration(companyId, "ERROR", null, null, nullable(message), Instant.now());
    }

    @Transactional
    public void markSyncSuccess(UUID companyId, String userName, String userEmail) {
        upsertIntegration(companyId, "CONNECTED", nullable(userName), nullable(userEmail), null, Instant.now());
    }

    private void upsertIntegration(
            UUID companyId,
            String status,
            String accountName,
            String username,
            String lastError,
            Instant now
    ) {
        JpaIoAutoIntegrationEntity integration = integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, PROVIDER_KEY)
                .orElseGet(JpaIoAutoIntegrationEntity::new);
        if (integration.getId() == null) {
            integration.setId(UUID.randomUUID());
            integration.setCompanyId(companyId);
            integration.setProviderKey(PROVIDER_KEY);
            integration.setCreatedAt(now);
            integration.setSettingsJson("{}");
        }
        integration.setDisplayName("OLX");
        integration.setStatus(safe(status, "CONFIGURATION_REQUIRED"));
        integration.setAccountName(nullable(accountName));
        integration.setUsername(nullable(username));
        integration.setLastError(nullable(lastError));
        integration.setLastSyncAt(now);
        integration.setUpdatedAt(now);
        integrations.save(integration);
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("OLX_INVALID_RESPONSE", message);
        }
        return normalized;
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(String value, String fallback) {
        String normalized = safe(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    public record OlxConnectionSnapshot(
            UUID companyId,
            boolean connected,
            String integrationStatus,
            String userName,
            String userEmail,
            String webhookNotificationId,
            Instant connectedAt,
            Instant updatedAt,
            boolean active
    ) {
    }
}
