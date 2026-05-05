package com.io.appioweb.application.ioauto.webmotors.modules.stock;

import com.io.appioweb.adapters.integrations.webmotors.rest.WebmotorsInventoryApiClient;
import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapAuthClient;
import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapInventoryClient;
import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapSessionCache;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsSyncLogEntity;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsSyncLogRepositoryJpa;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsCatalogService;
import com.io.appioweb.application.ioauto.webmotors.modules.auth.WmAuthService;
import com.io.appioweb.application.ioauto.webmotors.modules.publication.WmPublicationStatusService;
import com.io.appioweb.application.ioauto.webmotors.modules.tenant.WmTenantCredentialsService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCatalogEntry;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsInventoryItem;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsInventoryPage;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsRestAccessToken;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsSoapAuthResult;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class WmStockService {

    private final WmTenantCredentialsService tenantCredentialsService;
    private final WmAuthService authService;
    private final WmPublicationStatusService publicationStatusService;
    private final WebmotorsCatalogService catalogService;
    private final WebmotorsAdRepositoryJpa adRepository;
    private final WebmotorsSyncLogRepositoryJpa logRepository;
    private final WebmotorsInventoryApiClient inventoryApiClient;
    private final WebmotorsSoapAuthClient soapAuthClient;
    private final WebmotorsSoapInventoryClient soapInventoryClient;
    private final WebmotorsSoapSessionCache sessionCache;

    public WmStockService(
            WmTenantCredentialsService tenantCredentialsService,
            WmAuthService authService,
            WmPublicationStatusService publicationStatusService,
            WebmotorsCatalogService catalogService,
            WebmotorsAdRepositoryJpa adRepository,
            WebmotorsSyncLogRepositoryJpa logRepository,
            WebmotorsInventoryApiClient inventoryApiClient,
            WebmotorsSoapAuthClient soapAuthClient,
            WebmotorsSoapInventoryClient soapInventoryClient,
            WebmotorsSoapSessionCache sessionCache
    ) {
        this.tenantCredentialsService = tenantCredentialsService;
        this.authService = authService;
        this.publicationStatusService = publicationStatusService;
        this.catalogService = catalogService;
        this.adRepository = adRepository;
        this.logRepository = logRepository;
        this.inventoryApiClient = inventoryApiClient;
        this.soapAuthClient = soapAuthClient;
        this.soapInventoryClient = soapInventoryClient;
        this.sessionCache = sessionCache;
    }

    @Transactional(readOnly = true)
    public List<JpaWebmotorsAdEntity> listAds(UUID companyId) {
        return adRepository.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
    }

    @Transactional(readOnly = true)
    public JpaWebmotorsAdEntity getAd(UUID companyId, UUID vehicleId) {
        return adRepository.findByCompanyIdAndVehicleId(companyId, vehicleId)
                .orElseThrow(() -> new BusinessException("WEBMOTORS_AD_NOT_FOUND", "Anuncio Webmotors nao encontrado para este veiculo."));
    }

    @Transactional
    public int reconcileRemoteInventory(UUID companyId, String storeKey, int pageSize) {
        WebmotorsCredentialSnapshot credentials = tenantCredentialsService.getOrCreate(companyId, normalizeStoreKey(storeKey));
        if (canUseRestInventory(credentials)) {
            WebmotorsTransportResult<WebmotorsRestAccessToken> tokenTransport = authService.issueAccessToken(credentials);
            logRest(companyId, "login", tokenTransport.statusCode(), tokenTransport.sanitizedRequest(), tokenTransport.sanitizedResponse());
            WebmotorsTransportResult<WebmotorsInventoryPage> inventoryTransport = inventoryApiClient.fetchInventory(credentials, tokenTransport.payload());
            logRest(companyId, "estoque", inventoryTransport.statusCode(), inventoryTransport.sanitizedRequest(), inventoryTransport.sanitizedResponse());
            int processed = 0;
            for (WebmotorsInventoryItem item : inventoryTransport.payload().anuncios()) {
                upsertReplicaFromRemote(companyId, normalizeStoreKey(storeKey), item);
                processed++;
            }
            tenantCredentialsService.markStockSync(companyId, normalizeStoreKey(storeKey), Instant.now(), null);
            return processed;
        }

        assertSoapAdsEnabled(credentials);
        String hash = resolveSoapHash(credentials);
        int page = 1;
        int processed = 0;
        while (true) {
            WebmotorsTransportResult<WebmotorsInventoryPage> transport = soapInventoryClient.listCurrentInventoryPage(credentials, hash, page, Math.max(1, pageSize));
            logSoap(companyId, "ObterEstoqueAtualPaginado", transport.statusCode(), transport.payload().codigoRetorno(), transport.payload().requestId(), transport.sanitizedRequest(), transport.sanitizedResponse());
            ensureReturnCodeOk(transport.payload().codigoRetorno(), "listagem paginada do estoque");
            for (WebmotorsInventoryItem item : transport.payload().anuncios()) {
                upsertReplicaFromRemote(companyId, normalizeStoreKey(storeKey), item);
                processed++;
            }
            if (transport.payload().anuncios().isEmpty() || transport.payload().pagina() * Math.max(1, transport.payload().anunciosPorPagina()) >= Math.max(1, transport.payload().totalAnuncios())) {
                break;
            }
            page++;
        }
        tenantCredentialsService.markStockSync(companyId, normalizeStoreKey(storeKey), Instant.now(), null);
        return processed;
    }

    @Transactional
    public List<WebmotorsCatalogEntry> refreshCatalog(UUID companyId, String storeKey, String type) {
        return catalogService.refreshCatalog(companyId, normalizeStoreKey(storeKey), type);
    }

    private void upsertReplicaFromRemote(UUID companyId, String storeKey, WebmotorsInventoryItem item) {
        JpaWebmotorsAdEntity entity = adRepository.findByCompanyIdAndRemoteAdCode(companyId, item.codigoAnuncio())
                .orElseGet(JpaWebmotorsAdEntity::new);
        Instant now = Instant.now();
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setStoreKey(storeKey);
            entity.setCreatedAt(now);
        }
        if (entity.getPublicationId() == null) {
            publicationStatusService.findByRemoteListingId(companyId, item.codigoAnuncio())
                    .ifPresent(publication -> {
                        entity.setPublicationId(publication.getId());
                        entity.setVehicleId(publication.getVehicleId());
                    });
        }
        entity.setRemoteAdCode(item.codigoAnuncio());
        entity.setRemoteStatus(item.status());
        entity.setTitle(item.titulo());
        entity.setPriceCents(item.precoVenda());
        entity.setMileage(item.quilometragem());
        entity.setRemotePayloadJson(item.rawPayloadJson());
        entity.setLastSyncAt(now);
        entity.setRemoteUpdatedAt(now);
        entity.setUpdatedAt(now);
        adRepository.save(entity);
    }

    private String resolveSoapHash(WebmotorsCredentialSnapshot credentials) {
        String cached = sessionCache.get(credentials.companyId(), credentials.storeKey());
        if (cached != null && !cached.isBlank()) {
            return cached;
        }
        WebmotorsTransportResult<WebmotorsSoapAuthResult> transport = soapAuthClient.authenticate(credentials);
        logSoap(credentials.companyId(), "Autenticar", transport.statusCode(), transport.payload().codigoRetorno(), transport.payload().requestId(), transport.sanitizedRequest(), transport.sanitizedResponse());
        ensureReturnCodeOk(transport.payload().codigoRetorno(), "autenticacao SOAP");
        if (safe(transport.payload().hashAutenticacao()).isBlank()) {
            throw new BusinessException("WEBMOTORS_SOAP_HASH_MISSING", "A Webmotors nao retornou o HashAutenticacao.");
        }
        sessionCache.put(credentials.companyId(), credentials.storeKey(), transport.payload().hashAutenticacao(), Instant.now().plusSeconds(20 * 60));
        return transport.payload().hashAutenticacao();
    }

    private void logSoap(UUID companyId, String operation, int statusCode, String returnCode, String requestId, String requestPayload, String responsePayload) {
        saveLog(companyId, "SOAP", "REQUEST", operation, null, null, requestId, requestPayload);
        saveLog(companyId, "SOAP", "RESPONSE", operation, statusCode, returnCode, requestId, responsePayload);
    }

    private void logRest(UUID companyId, String operation, int statusCode, String requestPayload, String responsePayload) {
        if (safe(requestPayload).isBlank() == false) {
            saveLog(companyId, "REST", "REQUEST", operation, null, null, null, requestPayload);
        }
        saveLog(companyId, "REST", "RESPONSE", operation, statusCode, null, null, responsePayload);
    }

    private void saveLog(UUID companyId, String channel, String direction, String operation, Integer statusCode, String returnCode, String requestId, String payload) {
        JpaWebmotorsSyncLogEntity log = new JpaWebmotorsSyncLogEntity();
        log.setId(UUID.randomUUID());
        log.setCompanyId(companyId);
        log.setChannel(channel);
        log.setDirection(direction);
        log.setOperation(operation);
        log.setStatusCode(statusCode);
        log.setReturnCode(nullable(returnCode));
        log.setRequestId(nullable(requestId));
        log.setSanitizedPayload(nullable(payload));
        log.setCreatedAt(Instant.now());
        logRepository.save(log);
    }

    private void ensureReturnCodeOk(String codigoRetorno, String context) {
        String code = safe(codigoRetorno);
        if (code.isBlank() || "0".equals(code) || "00".equals(code)) {
            return;
        }
        throw new BusinessException("WEBMOTORS_SOAP_RETURN_CODE_" + code, "A Webmotors retornou CodigoRetorno " + code + " durante " + context + ".");
    }

    private void assertSoapAdsEnabled(WebmotorsCredentialSnapshot credentials) {
        if (!credentials.featureFlags().soapAdsEnabled()) {
            throw new BusinessException("WEBMOTORS_SOAP_ADS_DISABLED", "A publicacao SOAP da Webmotors esta desativada para esta loja.");
        }
    }

    private boolean canUseRestInventory(WebmotorsCredentialSnapshot credentials) {
        return safe(credentials.restClientId()).isBlank() == false
                && safe(credentials.restUsername()).isBlank() == false
                && safe(credentials.restPassword()).isBlank() == false
                && safe(credentials.restApiBaseUrl()).isBlank() == false;
    }

    private String normalizeStoreKey(String storeKey) {
        String normalized = safe(storeKey).toLowerCase(java.util.Locale.ROOT);
        return normalized.isBlank() ? "default" : normalized;
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
