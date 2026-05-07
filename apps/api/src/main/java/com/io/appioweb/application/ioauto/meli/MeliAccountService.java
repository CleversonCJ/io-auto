package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAccountRepositoryJpa;
import com.io.appioweb.adapters.security.SensitiveDataCrypto;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class MeliAccountService {

    public static final String PROVIDER_KEY = "mercadolivre";

    private final MeliAccountRepositoryJpa accounts;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final SensitiveDataCrypto crypto;

    public MeliAccountService(
            MeliAccountRepositoryJpa accounts,
            IoAutoIntegrationRepositoryJpa integrations,
            SensitiveDataCrypto crypto
    ) {
        this.accounts = accounts;
        this.integrations = integrations;
        this.crypto = crypto;
    }

    @Transactional(readOnly = true)
    public MeliConnectionSnapshot getStatus(UUID companyId) {
        JpaMeliAccountEntity account = accounts.findByCompanyId(companyId).orElse(null);
        JpaIoAutoIntegrationEntity integration = integrations.findByCompanyIdAndProviderKey(companyId, PROVIDER_KEY).orElse(null);
        boolean connected = account != null && account.isActive()
                && !safe(account.getAccessToken()).isBlank()
                && !safe(account.getRefreshToken()).isBlank();
        return new MeliConnectionSnapshot(
                companyId,
                connected,
                integration == null ? "CONFIGURATION_REQUIRED" : safe(integration.getStatus(), "CONFIGURATION_REQUIRED"),
                account == null ? null : account.getMeliUserId(),
                account == null ? null : nullable(account.getNickname()),
                account == null ? null : nullable(account.getSiteId()),
                account == null ? null : account.getConnectedAt(),
                account == null ? null : account.getUpdatedAt(),
                account != null && account.isActive()
        );
    }

    @Transactional
    public JpaMeliAccountEntity saveConnection(
            UUID companyId,
            Long meliUserId,
            String nickname,
            String siteId,
            String accessToken,
            String refreshToken,
            String tokenType,
            Integer expiresIn,
            Instant tokenExpiresAt,
            String scope
    ) {
        Instant now = Instant.now();
        JpaMeliAccountEntity account = accounts.findByCompanyId(companyId).orElseGet(JpaMeliAccountEntity::new);
        if (account.getId() == null) {
            account.setId(UUID.randomUUID());
            account.setCompanyId(companyId);
        }
        account.setMeliUserId(requireUserId(meliUserId));
        account.setNickname(nullable(nickname));
        account.setSiteId(safe(siteId, "MLB"));
        account.setAccessToken(crypto.encrypt(require(accessToken, "O Mercado Livre nao retornou um access token valido.")));
        account.setRefreshToken(crypto.encrypt(require(refreshToken, "O Mercado Livre nao retornou um refresh token valido.")));
        account.setTokenType(nullable(tokenType));
        account.setExpiresIn(expiresIn);
        account.setTokenExpiresAt(tokenExpiresAt);
        account.setScope(nullable(scope));
        account.setConnectedAt(account.getConnectedAt() == null ? now : account.getConnectedAt());
        account.setDisconnectedAt(null);
        account.setActive(true);
        account.setUpdatedAt(now);
        accounts.save(account);

        upsertIntegration(companyId, "CONNECTED", nullable(nickname), String.valueOf(account.getMeliUserId()), null, now);
        return account;
    }

    @Transactional
    public void disconnect(UUID companyId) {
        Instant now = Instant.now();
        accounts.findByCompanyId(companyId).ifPresent(account -> {
            account.setAccessToken("");
            account.setRefreshToken("");
            account.setActive(false);
            account.setDisconnectedAt(now);
            account.setUpdatedAt(now);
            accounts.save(account);
        });
        upsertIntegration(companyId, "CONFIGURATION_REQUIRED", null, null, null, now);
    }

    @Transactional(readOnly = true)
    public JpaMeliAccountEntity requireActiveAccount(UUID companyId) {
        JpaMeliAccountEntity account = accounts.findByCompanyId(companyId)
                .orElseThrow(() -> new BusinessException("MELI_NOT_CONNECTED", "Conecte a conta Mercado Livre da empresa antes de continuar."));
        if (!account.isActive() || safe(account.getRefreshToken()).isBlank()) {
            throw new BusinessException("MELI_NOT_CONNECTED", "Conecte a conta Mercado Livre da empresa antes de continuar.");
        }
        return account;
    }

    @Transactional(readOnly = true)
    public String decryptAccessToken(JpaMeliAccountEntity account) {
        return crypto.decrypt(account.getAccessToken());
    }

    @Transactional(readOnly = true)
    public String decryptRefreshToken(JpaMeliAccountEntity account) {
        return crypto.decrypt(account.getRefreshToken());
    }

    @Transactional
    public void markIntegrationError(UUID companyId, String message) {
        upsertIntegration(companyId, "ERROR", null, null, nullable(message), Instant.now());
    }

    @Transactional
    public void markConnected(UUID companyId, String nickname, Long userId) {
        upsertIntegration(companyId, "CONNECTED", nullable(nickname), userId == null ? null : String.valueOf(userId), null, Instant.now());
    }

    private void upsertIntegration(
            UUID companyId,
            String status,
            String accountName,
            String username,
            String lastError,
            Instant now
    ) {
        JpaIoAutoIntegrationEntity integration = integrations.findByCompanyIdAndProviderKey(companyId, PROVIDER_KEY)
                .orElseGet(JpaIoAutoIntegrationEntity::new);
        if (integration.getId() == null) {
            integration.setId(UUID.randomUUID());
            integration.setCompanyId(companyId);
            integration.setProviderKey(PROVIDER_KEY);
            integration.setCreatedAt(now);
            integration.setSettingsJson("{}");
        }
        integration.setDisplayName("Mercado Livre");
        integration.setStatus(safe(status, "CONFIGURATION_REQUIRED"));
        integration.setAccountName(nullable(accountName));
        integration.setUsername(nullable(username));
        integration.setLastError(nullable(lastError));
        integration.setLastSyncAt(now);
        integration.setUpdatedAt(now);
        integrations.save(integration);
    }

    private Long requireUserId(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException("MELI_INVALID_RESPONSE", "O Mercado Livre nao retornou um user_id valido.");
        }
        return userId;
    }

    private String require(String value, String message) {
        String normalized = safe(value);
        if (normalized.isBlank()) {
            throw new BusinessException("MELI_INVALID_RESPONSE", message);
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

    public record MeliConnectionSnapshot(
            UUID companyId,
            boolean connected,
            String integrationStatus,
            Long userId,
            String nickname,
            String siteId,
            Instant connectedAt,
            Instant updatedAt,
            boolean active
    ) {
    }
}
