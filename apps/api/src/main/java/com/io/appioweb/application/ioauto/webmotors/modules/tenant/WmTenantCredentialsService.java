package com.io.appioweb.application.ioauto.webmotors.modules.tenant;

import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsCredentialEntity;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsCredentialRepositoryJpa;
import com.io.appioweb.adapters.security.SensitiveDataCrypto;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsFeatureFlags;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class WmTenantCredentialsService {

    private final WebmotorsCredentialRepositoryJpa repository;
    private final SensitiveDataCrypto crypto;

    public WmTenantCredentialsService(WebmotorsCredentialRepositoryJpa repository, SensitiveDataCrypto crypto) {
        this.repository = repository;
        this.crypto = crypto;
    }

    @Transactional(readOnly = true)
    public WebmotorsCredentialSnapshot getOrCreate(UUID companyId, String requestedStoreKey) {
        String storeKey = normalize(requestedStoreKey, "default");
        JpaWebmotorsCredentialEntity entity = repository.findByCompanyIdAndStoreKey(companyId, storeKey)
                .orElseGet(() -> createDefault(companyId, storeKey));
        return toSnapshot(entity);
    }

    @Transactional
    public WebmotorsCredentialSnapshot save(UUID companyId, WmTenantCredentialUpdateRequest request) {
        String storeKey = normalize(request.storeKey(), "default");
        Instant now = Instant.now();
        JpaWebmotorsCredentialEntity entity = repository.findByCompanyIdAndStoreKey(companyId, storeKey)
                .orElseGet(() -> createDefault(companyId, storeKey));

        entity.setStoreName(normalize(request.storeName(), entity.getStoreName()));
        entity.setSoapAdsEnabled(request.soapAdsEnabled());
        entity.setRestLeadsEnabled(request.restLeadsEnabled());
        entity.setCatalogSyncEnabled(request.catalogSyncEnabled());
        entity.setLeadPullEnabled(request.leadPullEnabled());
        entity.setCallbackEnabled(request.callbackEnabled());
        entity.setSoapBaseUrl(nullable(request.soapBaseUrl()));
        entity.setSoapAuthPath(nullable(request.soapAuthPath()));
        entity.setSoapInventoryPath(nullable(request.soapInventoryPath()));
        entity.setSoapCatalogPath(nullable(request.soapCatalogPath()));
        setEncryptedIfPresent(entity::setSoapCnpjEncrypted, request.soapCnpj(), entity.getSoapCnpjEncrypted());
        setEncryptedIfPresent(entity::setSoapEmailEncrypted, request.soapEmail(), entity.getSoapEmailEncrypted());
        setEncryptedIfPresent(entity::setSoapPasswordEncrypted, request.soapPassword(), entity.getSoapPasswordEncrypted());
        entity.setRestTokenUrl(nullable(request.restTokenUrl()));
        entity.setRestApiBaseUrl(nullable(request.restApiBaseUrl()));
        setEncryptedIfPresent(entity::setRestUsernameEncrypted, request.restUsername(), entity.getRestUsernameEncrypted());
        setEncryptedIfPresent(entity::setRestPasswordEncrypted, request.restPassword(), entity.getRestPasswordEncrypted());
        setEncryptedIfPresent(entity::setRestClientIdEncrypted, request.restClientId(), entity.getRestClientIdEncrypted());
        setEncryptedIfPresent(entity::setRestClientSecretEncrypted, request.restClientSecret(), entity.getRestClientSecretEncrypted());
        setEncryptedIfPresent(entity::setCallbackSecretEncrypted, request.callbackSecret(), entity.getCallbackSecretEncrypted());
        entity.setUpdatedAt(now);
        repository.save(entity);
        return toSnapshot(entity);
    }

    @Transactional
    public void markStockSync(UUID companyId, String storeKey, Instant when, String lastError) {
        JpaWebmotorsCredentialEntity entity = repository.findByCompanyIdAndStoreKey(companyId, normalize(storeKey, "default"))
                .orElseGet(() -> createDefault(companyId, normalize(storeKey, "default")));
        entity.setLastSoapSyncAt(when);
        entity.setLastError(nullable(lastError));
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
    }

    @Transactional
    public void markLeadPull(UUID companyId, String storeKey, Instant when, String lastError) {
        JpaWebmotorsCredentialEntity entity = repository.findByCompanyIdAndStoreKey(companyId, normalize(storeKey, "default"))
                .orElseGet(() -> createDefault(companyId, normalize(storeKey, "default")));
        entity.setLastLeadPullAt(when);
        entity.setLastError(nullable(lastError));
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
    }

    private JpaWebmotorsCredentialEntity createDefault(UUID companyId, String storeKey) {
        Instant now = Instant.now();
        JpaWebmotorsCredentialEntity entity = new JpaWebmotorsCredentialEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setStoreKey(storeKey);
        entity.setStoreName("Loja principal");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return repository.save(entity);
    }

    private WebmotorsCredentialSnapshot toSnapshot(JpaWebmotorsCredentialEntity entity) {
        return new WebmotorsCredentialSnapshot(
                entity.getId(),
                entity.getCompanyId(),
                normalize(entity.getStoreKey(), "default"),
                normalize(entity.getStoreName(), "Loja principal"),
                new WebmotorsFeatureFlags(
                        entity.isSoapAdsEnabled(),
                        entity.isRestLeadsEnabled(),
                        entity.isCatalogSyncEnabled(),
                        entity.isLeadPullEnabled(),
                        entity.isCallbackEnabled()
                ),
                safe(entity.getSoapBaseUrl()),
                safe(entity.getSoapAuthPath()),
                safe(entity.getSoapInventoryPath()),
                safe(entity.getSoapCatalogPath()),
                crypto.decrypt(entity.getSoapCnpjEncrypted()),
                crypto.decrypt(entity.getSoapEmailEncrypted()),
                crypto.decrypt(entity.getSoapPasswordEncrypted()),
                safe(entity.getRestTokenUrl()),
                safe(entity.getRestApiBaseUrl()),
                crypto.decrypt(entity.getRestUsernameEncrypted()),
                crypto.decrypt(entity.getRestPasswordEncrypted()),
                crypto.decrypt(entity.getRestClientIdEncrypted()),
                crypto.decrypt(entity.getRestClientSecretEncrypted()),
                crypto.decrypt(entity.getCallbackSecretEncrypted())
        );
    }

    private void setEncryptedIfPresent(java.util.function.Consumer<String> setter, String rawValue, String currentEncrypted) {
        String normalized = safe(rawValue);
        if (normalized.isBlank()) {
            setter.accept(currentEncrypted);
            return;
        }
        setter.accept(crypto.encrypt(normalized));
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String normalize(String value, String fallback) {
        String normalized = safe(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record WmTenantCredentialUpdateRequest(
            String storeKey,
            String storeName,
            boolean soapAdsEnabled,
            boolean restLeadsEnabled,
            boolean catalogSyncEnabled,
            boolean leadPullEnabled,
            boolean callbackEnabled,
            String soapBaseUrl,
            String soapAuthPath,
            String soapInventoryPath,
            String soapCatalogPath,
            String soapCnpj,
            String soapEmail,
            String soapPassword,
            String restTokenUrl,
            String restApiBaseUrl,
            String restUsername,
            String restPassword,
            String restClientId,
            String restClientSecret,
            String callbackSecret
    ) {
    }
}
