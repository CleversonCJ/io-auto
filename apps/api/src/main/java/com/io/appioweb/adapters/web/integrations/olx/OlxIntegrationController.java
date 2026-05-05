package com.io.appioweb.adapters.web.integrations.olx;

import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.ioauto.olx.OlxAccountService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import com.io.appioweb.application.ioauto.olx.OlxCatalogService;
import com.io.appioweb.application.ioauto.olx.OlxNotificationConfigService;
import com.io.appioweb.application.ioauto.olx.OlxOAuthService;
import com.io.appioweb.application.ioauto.olx.OlxVehicleSettingsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class OlxIntegrationController {

    private final CurrentUserPort currentUser;
    private final OlxOAuthService oauthService;
    private final OlxAccountService accountService;
    private final OlxCatalogService catalogService;
    private final OlxAdService adService;
    private final OlxNotificationConfigService notificationConfigService;
    private final OlxVehicleSettingsService vehicleSettingsService;

    public OlxIntegrationController(
            CurrentUserPort currentUser,
            OlxOAuthService oauthService,
            OlxAccountService accountService,
            OlxCatalogService catalogService,
            OlxAdService adService,
            OlxNotificationConfigService notificationConfigService,
            OlxVehicleSettingsService vehicleSettingsService
    ) {
        this.currentUser = currentUser;
        this.oauthService = oauthService;
        this.accountService = accountService;
        this.catalogService = catalogService;
        this.adService = adService;
        this.notificationConfigService = notificationConfigService;
        this.vehicleSettingsService = vehicleSettingsService;
    }

    @GetMapping("/api/integrations/olx/connect-url")
    public ResponseEntity<ConnectUrlResponse> getConnectUrl() {
        OlxOAuthService.AuthorizationUrlResponse response = oauthService.buildAuthorizationUrl(currentUser.companyId());
        return ResponseEntity.ok(new ConnectUrlResponse(response.url()));
    }

    @GetMapping("/api/integrations/olx/oauth/callback")
    @Transactional
    public ResponseEntity<Void> oauthCallback(
            @RequestParam(name = "code", required = false) String code,
            @RequestParam(name = "state", required = false) String state,
            @RequestParam(name = "error", required = false) String error
    ) {
        String redirect;
        try {
            if (error != null && !error.isBlank()) {
                redirect = oauthService.buildFrontendRedirect(false, "A conexao com a OLX foi cancelada: " + error.trim());
            } else {
                oauthService.handleCallback(code, state);
                redirect = oauthService.buildFrontendRedirect(true, "Conta OLX conectada com sucesso.");
            }
        } catch (Exception exception) {
            redirect = oauthService.buildFrontendRedirect(false, exception.getMessage());
        }
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, URI.create(redirect).toString()).build();
    }

    @GetMapping("/api/integrations/olx/status")
    public ResponseEntity<StatusResponse> getStatus() {
        OlxAccountService.OlxConnectionSnapshot account = accountService.getStatus(currentUser.companyId());
        OlxNotificationConfigService.WebhookConfigSnapshot webhook = account.connected()
                ? notificationConfigService.getWebhookConfig(currentUser.companyId())
                : new OlxNotificationConfigService.WebhookConfigSnapshot(null, false, "POST", null, "application/json", null);
        return ResponseEntity.ok(new StatusResponse(
                account.connected(),
                account.integrationStatus(),
                account.userName(),
                account.userEmail(),
                account.connectedAt(),
                account.updatedAt(),
                webhook.configured(),
                webhook.id()
        ));
    }

    @PostMapping("/api/integrations/olx/disconnect")
    @Transactional
    public ResponseEntity<Void> disconnect() {
        accountService.disconnect(currentUser.companyId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/integrations/olx/catalog/sync")
    @Transactional
    public ResponseEntity<OlxCatalogService.CatalogSyncSummary> syncCatalog() {
        return ResponseEntity.ok(catalogService.syncCatalog(currentUser.companyId()));
    }

    @GetMapping("/api/integrations/olx/catalog/brands")
    public ResponseEntity<List<OlxCatalogService.CatalogOption>> listBrands() {
        return ResponseEntity.ok(catalogService.listBrands());
    }

    @GetMapping("/api/integrations/olx/catalog/brands/{brandId}/models")
    public ResponseEntity<List<OlxCatalogService.CatalogOption>> listModels(@PathVariable String brandId) {
        return ResponseEntity.ok(catalogService.listModels(brandId));
    }

    @GetMapping("/api/integrations/olx/catalog/brands/{brandId}/models/{modelId}/versions")
    public ResponseEntity<List<OlxCatalogService.CatalogOption>> listVersions(
            @PathVariable String brandId,
            @PathVariable String modelId
    ) {
        return ResponseEntity.ok(catalogService.listVersions(brandId, modelId));
    }

    @PostMapping("/api/integrations/olx/vehicles/{vehicleId}/publish")
    @Transactional
    public ResponseEntity<OlxAdService.OlxAdSnapshot> publishVehicle(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.publishVehicle(currentUser.companyId(), vehicleId));
    }

    @GetMapping("/api/integrations/olx/vehicles/{vehicleId}/mapping")
    public ResponseEntity<OlxVehicleSettingsService.VehicleOlxSettingsSnapshot> getVehicleMapping(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(vehicleSettingsService.getSettings(currentUser.companyId(), vehicleId));
    }

    @PutMapping("/api/integrations/olx/vehicles/{vehicleId}/mapping")
    @Transactional
    public ResponseEntity<OlxVehicleSettingsService.VehicleOlxSettingsSnapshot> updateVehicleMapping(
            @PathVariable UUID vehicleId,
            @org.springframework.web.bind.annotation.RequestBody OlxVehicleSettingsService.SaveVehicleOlxSettingsRequest request
    ) {
        return ResponseEntity.ok(vehicleSettingsService.saveSettings(currentUser.companyId(), vehicleId, request));
    }

    @PutMapping("/api/integrations/olx/vehicles/{vehicleId}/ad")
    @Transactional
    public ResponseEntity<OlxAdService.OlxAdSnapshot> updateVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.updateVehicleAd(currentUser.companyId(), vehicleId));
    }

    @DeleteMapping("/api/integrations/olx/vehicles/{vehicleId}/ad")
    @Transactional
    public ResponseEntity<OlxAdService.OlxAdSnapshot> unpublishVehicle(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.unpublishVehicle(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/api/integrations/olx/ads/{olxAdIdOrToken}/sync-status")
    @Transactional
    public ResponseEntity<OlxAdService.OlxAdSnapshot> syncAdStatus(@PathVariable String olxAdIdOrToken) {
        try {
            return ResponseEntity.ok(adService.checkImportStatus(currentUser.companyId(), UUID.fromString(olxAdIdOrToken)));
        } catch (IllegalArgumentException ignored) {
            return ResponseEntity.ok(adService.checkImportStatusByToken(currentUser.companyId(), olxAdIdOrToken));
        }
    }

    @GetMapping("/api/integrations/olx/ads")
    public ResponseEntity<List<OlxAdService.OlxAdSnapshot>> listAds(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "vehicleId", required = false) UUID vehicleId,
            @RequestParam(name = "from", required = false) LocalDate from,
            @RequestParam(name = "to", required = false) LocalDate to
    ) {
        return ResponseEntity.ok(adService.listLocalAds(currentUser.companyId(), status, vehicleId, from, to));
    }

    @GetMapping("/api/integrations/olx/published")
    public ResponseEntity<OlxAdService.PublishedAdsPage> listPublished(
            @RequestParam(name = "adsStatus", required = false) String adsStatus,
            @RequestParam(name = "pageToken", required = false) String pageToken,
            @RequestParam(name = "fetchSize", required = false) Integer fetchSize
    ) {
        return ResponseEntity.ok(adService.listPublishedAds(currentUser.companyId(), adsStatus, pageToken, fetchSize));
    }

    @GetMapping("/api/integrations/olx/balance")
    public ResponseEntity<OlxAdService.BalanceSnapshot> getBalance() {
        return ResponseEntity.ok(adService.getBalance(currentUser.companyId()));
    }

    @PostMapping("/api/integrations/olx/webhook/configure")
    @Transactional
    public ResponseEntity<OlxNotificationConfigService.WebhookConfigSnapshot> configureWebhook() {
        return ResponseEntity.ok(notificationConfigService.configureWebhook(currentUser.companyId()));
    }

    @GetMapping("/api/integrations/olx/webhook")
    public ResponseEntity<OlxNotificationConfigService.WebhookConfigSnapshot> getWebhook() {
        return ResponseEntity.ok(notificationConfigService.getWebhookConfig(currentUser.companyId()));
    }

    @PutMapping("/api/integrations/olx/webhook")
    @Transactional
    public ResponseEntity<OlxNotificationConfigService.WebhookConfigSnapshot> updateWebhook() {
        return ResponseEntity.ok(notificationConfigService.updateWebhookConfig(currentUser.companyId()));
    }

    @DeleteMapping("/api/integrations/olx/webhook")
    @Transactional
    public ResponseEntity<Void> deleteWebhook() {
        notificationConfigService.deleteWebhookConfig(currentUser.companyId());
        return ResponseEntity.noContent().build();
    }

    public record ConnectUrlResponse(String url) {
    }

    public record StatusResponse(
            boolean connected,
            String integrationStatus,
            String userName,
            String userEmail,
            java.time.Instant connectedAt,
            java.time.Instant updatedAt,
            boolean webhookConfigured,
            String webhookNotificationId
    ) {
    }
}
