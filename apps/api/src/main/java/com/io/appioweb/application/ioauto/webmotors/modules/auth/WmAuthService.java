package com.io.appioweb.application.ioauto.webmotors.modules.auth;

import com.io.appioweb.adapters.integrations.webmotors.rest.WebmotorsRestTokenClient;
import com.io.appioweb.application.ioauto.webmotors.modules.tenant.WmTenantCredentialsService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class WmAuthService {

    private final WmTenantCredentialsService tenantCredentialsService;
    private final WebmotorsRestTokenClient restTokenClient;

    public WmAuthService(
            WmTenantCredentialsService tenantCredentialsService,
            WebmotorsRestTokenClient restTokenClient
    ) {
        this.tenantCredentialsService = tenantCredentialsService;
        this.restTokenClient = restTokenClient;
    }

    public WebmotorsTransportResult<WebmotorsRestAccessToken> issueAccessToken(UUID companyId, String storeKey) {
        return issueAccessToken(tenantCredentialsService.getOrCreate(companyId, storeKey));
    }

    public WebmotorsTransportResult<WebmotorsRestAccessToken> issueAccessToken(WebmotorsCredentialSnapshot credentials) {
        return restTokenClient.getAccessToken(credentials);
    }

    public void invalidate(UUID companyId, String storeKey) {
        restTokenClient.invalidate(companyId, storeKey);
    }
}
