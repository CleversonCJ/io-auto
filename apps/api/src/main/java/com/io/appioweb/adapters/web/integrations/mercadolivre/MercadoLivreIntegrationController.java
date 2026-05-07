package com.io.appioweb.adapters.web.integrations.mercadolivre;

import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.ioauto.meli.MeliAccountService;
import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.meli.MeliCategoryService;
import com.io.appioweb.application.ioauto.meli.MeliListingTypeService;
import com.io.appioweb.application.ioauto.meli.MeliOAuthService;
import com.io.appioweb.application.ioauto.meli.MeliTokenService;
import com.io.appioweb.application.ioauto.meli.MeliVehicleSettingsService;
import com.io.appioweb.shared.errors.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
public class MercadoLivreIntegrationController {

    private static final Logger log = LoggerFactory.getLogger(MercadoLivreIntegrationController.class);

    private final CurrentUserPort currentUser;
    private final MeliOAuthService oauthService;
    private final MeliAccountService accountService;
    private final MeliTokenService tokenService;
    private final MeliCategoryService categoryService;
    private final MeliListingTypeService listingTypeService;
    private final MeliVehicleSettingsService settingsService;
    private final MeliAdService adService;

    public MercadoLivreIntegrationController(
            CurrentUserPort currentUser,
            MeliOAuthService oauthService,
            MeliAccountService accountService,
            MeliTokenService tokenService,
            MeliCategoryService categoryService,
            MeliListingTypeService listingTypeService,
            MeliVehicleSettingsService settingsService,
            MeliAdService adService
    ) {
        this.currentUser = currentUser;
        this.oauthService = oauthService;
        this.accountService = accountService;
        this.tokenService = tokenService;
        this.categoryService = categoryService;
        this.listingTypeService = listingTypeService;
        this.settingsService = settingsService;
        this.adService = adService;
    }

    @GetMapping("/api/integrations/mercadolivre/connect-url")
    public ResponseEntity<ConnectUrlResponse> getConnectUrl() {
        MeliOAuthService.AuthorizationUrlResponse response = oauthService.buildAuthorizationUrl(currentUser.companyId());
        return ResponseEntity.ok(new ConnectUrlResponse(response.url()));
    }

    @GetMapping("/api/integrations/mercadolivre/oauth/callback")
    @Transactional
    public ResponseEntity<Void> oauthCallback(
            @RequestParam(name = "code", required = false) String code,
            @RequestParam(name = "state", required = false) String state,
            @RequestParam(name = "error", required = false) String error
    ) {
        String redirect;
        try {
            if (error != null && !error.isBlank()) {
                redirect = oauthService.buildFrontendRedirect(false, "A conexao com o Mercado Livre foi cancelada: " + error.trim());
            } else {
                oauthService.handleCallback(code, state);
                redirect = oauthService.buildFrontendRedirect(true, "Conta Mercado Livre conectada com sucesso.");
            }
        } catch (Exception exception) {
            log.warn("MELI OAuth callback failed: {}", exception.getMessage(), exception);
            redirect = oauthService.buildFrontendRedirect(false, exception.getMessage());
        }
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, URI.create(redirect).toString()).build();
    }

    @GetMapping("/api/integrations/mercadolivre/status")
    public ResponseEntity<MeliAccountService.MeliConnectionSnapshot> getStatus() {
        return ResponseEntity.ok(accountService.getStatus(currentUser.companyId()));
    }

    @PostMapping("/api/integrations/mercadolivre/disconnect")
    @Transactional
    public ResponseEntity<Void> disconnect() {
        accountService.disconnect(currentUser.companyId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/integrations/mercadolivre/tokens/refresh")
    @Transactional
    public ResponseEntity<ActionMessageResponse> refreshToken() {
        enforceAdmin();
        tokenService.refreshAccessToken(currentUser.companyId());
        return ResponseEntity.ok(new ActionMessageResponse("Token do Mercado Livre renovado com sucesso."));
    }

    @PostMapping("/api/integrations/mercadolivre/categories/sync")
    @Transactional
    public ResponseEntity<MeliCategoryService.CategorySyncSummary> syncCategories() {
        return ResponseEntity.ok(categoryService.syncRootCategories(currentUser.companyId()));
    }

    @PostMapping("/api/integrations/mercadolivre/categories/{categoryId}/sync")
    @Transactional
    public ResponseEntity<MeliCategoryService.CategorySnapshot> syncCategory(@PathVariable String categoryId) {
        return ResponseEntity.ok(categoryService.syncCategory(categoryId));
    }

    @PostMapping("/api/integrations/mercadolivre/categories/{categoryId}/attributes/sync")
    @Transactional
    public ResponseEntity<MeliCategoryService.AttributeSyncSummary> syncCategoryAttributes(@PathVariable String categoryId) {
        return ResponseEntity.ok(categoryService.syncCategoryAttributes(categoryId));
    }

    @GetMapping("/api/integrations/mercadolivre/categories")
    public ResponseEntity<List<MeliCategoryService.CategorySnapshot>> listCategories(
            @RequestParam(name = "search", required = false) String search
    ) {
        return ResponseEntity.ok(categoryService.listCategories(search));
    }

    @GetMapping("/api/integrations/mercadolivre/categories/discover")
    public ResponseEntity<MeliCategoryService.CategorySuggestion> discoverCategory(
            @RequestParam(name = "title") String title
    ) {
        return ResponseEntity.ok(categoryService.discoverVehicleCategory(title));
    }

    @GetMapping("/api/integrations/mercadolivre/categories/{categoryId}/attributes")
    public ResponseEntity<List<MeliCategoryService.CategoryAttributeSnapshot>> listCategoryAttributes(@PathVariable String categoryId) {
        return ResponseEntity.ok(categoryService.listAttributes(categoryId));
    }

    @GetMapping("/api/integrations/mercadolivre/listing-types")
    public ResponseEntity<List<MeliListingTypeService.ListingTypeSnapshot>> getListingTypes(
            @RequestParam(name = "categoryId") String categoryId
    ) {
        return ResponseEntity.ok(listingTypeService.getAvailableListingTypes(currentUser.companyId(), categoryId));
    }

    @GetMapping("/api/integrations/mercadolivre/listing-prices")
    public ResponseEntity<List<MeliListingTypeService.ListingPriceSnapshot>> getListingPrices(
            @RequestParam(name = "categoryId") String categoryId,
            @RequestParam(name = "price") BigDecimal price
    ) {
        return ResponseEntity.ok(listingTypeService.getListingPrices(categoryId, price));
    }

    @GetMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/mapping")
    public ResponseEntity<MeliVehicleSettingsService.VehicleMeliSettingsSnapshot> getVehicleMapping(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(settingsService.getSettings(currentUser.companyId(), vehicleId));
    }

    @PutMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/mapping")
    @Transactional
    public ResponseEntity<MeliVehicleSettingsService.VehicleMeliSettingsSnapshot> updateVehicleMapping(
            @PathVariable UUID vehicleId,
            @RequestBody MeliVehicleSettingsService.SaveVehicleMeliSettingsRequest request
    ) {
        return ResponseEntity.ok(settingsService.saveSettings(currentUser.companyId(), vehicleId, request));
    }

    @PostMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/publish")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> publishVehicle(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.publishVehicle(currentUser.companyId(), vehicleId));
    }

    @PutMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/ad")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> updateVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.updateVehicleAd(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/ad/pause")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> pauseVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.pauseAd(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/ad/activate")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> activateVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.activateAd(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/ad/close")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> closeVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.closeAd(currentUser.companyId(), vehicleId));
    }

    @PostMapping("/api/integrations/mercadolivre/vehicles/{vehicleId}/ad/sync")
    @Transactional
    public ResponseEntity<MeliAdService.MeliAdSnapshot> syncVehicleAd(@PathVariable UUID vehicleId) {
        return ResponseEntity.ok(adService.syncVehicleAd(currentUser.companyId(), vehicleId));
    }

    @GetMapping("/api/integrations/mercadolivre/ads")
    public ResponseEntity<List<MeliAdService.MeliAdSnapshot>> listLocalAds(
            @RequestParam(name = "status", required = false) String status
    ) {
        return ResponseEntity.ok(adService.listLocalAds(currentUser.companyId(), status));
    }

    @PostMapping("/api/integrations/mercadolivre/ads/sync-all")
    @Transactional
    public ResponseEntity<MeliAdService.SyncSummary> syncAllAds() {
        return ResponseEntity.ok(adService.syncAllAds(currentUser.companyId()));
    }

    @GetMapping("/api/integrations/mercadolivre/ads/seller")
    public ResponseEntity<MeliAdService.RemoteItemsPage> listSellerAds(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "offset", required = false) Integer offset,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return ResponseEntity.ok(adService.listSellerItems(currentUser.companyId(), status, offset, limit));
    }

    @GetMapping("/api/integrations/mercadolivre/ads/{itemId}")
    public ResponseEntity<MeliAdService.RemoteItemSnapshot> getAd(@PathVariable String itemId) {
        return ResponseEntity.ok(adService.getRemoteAd(currentUser.companyId(), itemId));
    }

    private void enforceAdmin() {
        if (currentUser.roles().contains("ADMIN") || currentUser.roles().contains("SUPERADMIN")) {
            return;
        }
        throw new BusinessException("FORBIDDEN", "Somente administradores podem renovar o token do Mercado Livre.");
    }

    public record ConnectUrlResponse(String url) {
    }

    public record ActionMessageResponse(String message) {
    }
}
