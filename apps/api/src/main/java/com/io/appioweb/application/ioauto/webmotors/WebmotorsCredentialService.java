package com.io.appioweb.application.ioauto.webmotors;

import com.io.appioweb.application.ioauto.webmotors.modules.tenant.WmTenantCredentialsService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class WebmotorsCredentialService {

    private final WmTenantCredentialsService tenantCredentialsService;

    public WebmotorsCredentialService(WmTenantCredentialsService tenantCredentialsService) {
        this.tenantCredentialsService = tenantCredentialsService;
    }

    public WebmotorsCredentialSnapshot getOrCreate(UUID companyId, String requestedStoreKey) {
        return tenantCredentialsService.getOrCreate(companyId, requestedStoreKey);
    }

    public WebmotorsCredentialSnapshot save(UUID companyId, WebmotorsCredentialUpdateRequest request) {
        return tenantCredentialsService.save(companyId, new WmTenantCredentialsService.WmTenantCredentialUpdateRequest(
                request.storeKey(),
                request.storeName(),
                request.soapAdsEnabled(),
                request.restLeadsEnabled(),
                request.catalogSyncEnabled(),
                request.leadPullEnabled(),
                request.callbackEnabled(),
                request.soapBaseUrl(),
                request.soapAuthPath(),
                request.soapInventoryPath(),
                request.soapCatalogPath(),
                request.soapCnpj(),
                request.soapEmail(),
                request.soapPassword(),
                request.restTokenUrl(),
                request.restApiBaseUrl(),
                request.restUsername(),
                request.restPassword(),
                request.restClientId(),
                request.restClientSecret(),
                request.callbackSecret()
        ));
    }

    public void markSoapSync(UUID companyId, String storeKey, Instant when, String lastError) {
        tenantCredentialsService.markStockSync(companyId, storeKey, when, lastError);
    }

    public void markLeadPull(UUID companyId, String storeKey, Instant when, String lastError) {
        tenantCredentialsService.markLeadPull(companyId, storeKey, when, lastError);
    }

    public record WebmotorsCredentialUpdateRequest(
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
