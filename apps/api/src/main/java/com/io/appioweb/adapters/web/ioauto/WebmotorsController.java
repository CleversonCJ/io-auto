package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsLeadEntity;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsAdsService;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsCredentialService;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsLeadService;
import com.io.appioweb.application.ioauto.webmotors.modules.auth.WmAuthService;
import com.io.appioweb.application.superadmin.FeatureUsageService;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCatalogEntry;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class WebmotorsController {

    private final CurrentUserPort currentUser;
    private final WebmotorsCredentialService credentialService;
    private final WebmotorsAdsService adsService;
    private final WebmotorsLeadService leadService;
    private final WmAuthService authService;
    private final FeatureUsageService featureUsageService;
    private final SuperAdminPlanManagementService planManagementService;

    public WebmotorsController(
            CurrentUserPort currentUser,
            WebmotorsCredentialService credentialService,
            WebmotorsAdsService adsService,
            WebmotorsLeadService leadService,
            WmAuthService authService,
            FeatureUsageService featureUsageService,
            SuperAdminPlanManagementService planManagementService
    ) {
        this.currentUser = currentUser;
        this.credentialService = credentialService;
        this.adsService = adsService;
        this.leadService = leadService;
        this.authService = authService;
        this.featureUsageService = featureUsageService;
        this.planManagementService = planManagementService;
    }

    @GetMapping("/ioauto/webmotors/settings")
    public ResponseEntity<WebmotorsCredentialSnapshot> getSettings(@RequestParam(defaultValue = "default") String storeKey) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(credentialService.getOrCreate(currentUser.companyId(), storeKey));
    }

    @PutMapping("/ioauto/webmotors/settings")
    @Transactional
    public ResponseEntity<WebmotorsCredentialSnapshot> updateSettings(@Valid @RequestBody UpdateWebmotorsSettingsRequest request) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(credentialService.save(currentUser.companyId(), request.toServiceRequest()));
    }

    @PostMapping("/ioauto/webmotors/settings/validate")
    public ResponseEntity<ValidateWebmotorsSettingsResponse> validateSettings(
            @RequestParam(defaultValue = "default") String storeKey
    ) {
        enforceWebmotorsPlan();
        WebmotorsCredentialSnapshot credentials = credentialService.getOrCreate(currentUser.companyId(), storeKey);
        WebmotorsTransportResult<WebmotorsRestAccessToken> tokenTransport = authService.issueAccessToken(credentials);
        return ResponseEntity.ok(new ValidateWebmotorsSettingsResponse(
                true,
                tokenTransport.statusCode(),
                tokenTransport.payload().expiresInSeconds(),
                "Access token obtido com sucesso."
        ));
    }

    @GetMapping("/ioauto/webmotors/ads")
    public ResponseEntity<List<JpaWebmotorsAdEntity>> listAds() {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(adsService.listAds(currentUser.companyId()));
    }

    @GetMapping("/ioauto/webmotors/ads/{vehicleId}")
    public ResponseEntity<JpaWebmotorsAdEntity> getAd(@PathVariable UUID vehicleId) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(adsService.getAd(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/ioauto/webmotors/ads/{vehicleId}/publish")
    @Transactional
    public ResponseEntity<?> publishAd(@PathVariable UUID vehicleId, @RequestParam(defaultValue = "default") String storeKey) {
        enforceWebmotorsPlan();
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_MARKETPLACE_INTEGRATION, java.util.Map.of("provider", "WEBMOTORS", "action", "PUBLISH"));
        return ResponseEntity.ok(adsService.enqueuePublish(currentUser.companyId(), vehicleId, storeKey));
    }

    @PostMapping("/ioauto/webmotors/ads/{vehicleId}/sync")
    @Transactional
    public ResponseEntity<?> syncAd(@PathVariable UUID vehicleId, @RequestParam(defaultValue = "default") String storeKey) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(adsService.enqueuePublish(currentUser.companyId(), vehicleId, storeKey));
    }

    @DeleteMapping("/ioauto/webmotors/ads/{vehicleId}")
    @Transactional
    public ResponseEntity<?> deleteAd(@PathVariable UUID vehicleId, @RequestParam(defaultValue = "default") String storeKey) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(adsService.enqueueDelete(currentUser.companyId(), vehicleId, storeKey));
    }

    @PostMapping("/ioauto/webmotors/catalogs/refresh")
    @Transactional
    public ResponseEntity<List<WebmotorsCatalogEntry>> refreshCatalog(
            @RequestParam(defaultValue = "default") String storeKey,
            @RequestParam @NotBlank String type
    ) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(adsService.refreshCatalog(currentUser.companyId(), storeKey, type));
    }

    @GetMapping("/ioauto/webmotors/leads")
    public ResponseEntity<List<JpaWebmotorsLeadEntity>> listLeads() {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(leadService.listLeads(currentUser.companyId()));
    }

    @PostMapping("/ioauto/webmotors/leads/pull")
    @Transactional
    public ResponseEntity<List<JpaWebmotorsLeadEntity>> pullLeads(
            @RequestParam(defaultValue = "default") String storeKey,
            @RequestParam(defaultValue = "") String since
    ) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(leadService.pullLeads(currentUser.companyId(), storeKey, since));
    }

    @PostMapping("/ioauto/webmotors/reconcile")
    @Transactional
    public ResponseEntity<?> reconcile(
            @RequestParam(defaultValue = "default") String storeKey,
            @RequestParam(defaultValue = "50") int pageSize
    ) {
        enforceWebmotorsPlan();
        return ResponseEntity.ok(java.util.Map.of("processed", adsService.reconcileRemoteInventory(currentUser.companyId(), storeKey, pageSize)));
    }

    private void enforceWebmotorsPlan() {
        planManagementService.assertProviderIntegrationEnabled(currentUser.companyId(), SuperAdminPlanManagementService.PROVIDER_WEBMOTORS);
    }

    public record UpdateWebmotorsSettingsRequest(
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
        WebmotorsCredentialService.WebmotorsCredentialUpdateRequest toServiceRequest() {
            return new WebmotorsCredentialService.WebmotorsCredentialUpdateRequest(
                    storeKey,
                    storeName,
                    soapAdsEnabled,
                    restLeadsEnabled,
                    catalogSyncEnabled,
                    leadPullEnabled,
                    callbackEnabled,
                    soapBaseUrl,
                    soapAuthPath,
                    soapInventoryPath,
                    soapCatalogPath,
                    soapCnpj,
                    soapEmail,
                    soapPassword,
                    restTokenUrl,
                    restApiBaseUrl,
                    restUsername,
                    restPassword,
                    restClientId,
                    restClientSecret,
                    callbackSecret
            );
        }
    }

    public record ValidateWebmotorsSettingsResponse(
            boolean success,
            int statusCode,
            long expiresInSeconds,
            String message
    ) {
    }
}
