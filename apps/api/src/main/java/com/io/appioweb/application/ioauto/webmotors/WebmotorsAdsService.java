package com.io.appioweb.application.ioauto.webmotors;

import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapAuthClient;
import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapInventoryClient;
import com.io.appioweb.adapters.integrations.webmotors.soap.WebmotorsSoapSessionCache;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsSyncJobEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsSyncLogEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsSyncJobRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.WebmotorsSyncLogRepositoryJpa;
import com.io.appioweb.application.ioauto.webmotors.modules.publication.WmPublicationStatusService;
import com.io.appioweb.application.ioauto.webmotors.modules.stock.WmStockService;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCatalogEntry;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsCredentialSnapshot;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsJobStatus;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsJobType;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsSoapAuthResult;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsSoapOperationResult;
import com.io.appioweb.domain.ioauto.webmotors.WebmotorsTransportResult;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class WebmotorsAdsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WebmotorsCredentialService credentialService;
    private final WebmotorsCatalogService catalogService;
    private final WebmotorsAdRepositoryJpa adRepository;
    private final WebmotorsSyncJobRepositoryJpa jobRepository;
    private final WebmotorsSyncLogRepositoryJpa logRepository;
    private final IoAutoVehicleRepositoryJpa vehicleRepository;
    private final WmPublicationStatusService publicationStatusService;
    private final WmStockService stockService;
    private final WebmotorsSoapAuthClient soapAuthClient;
    private final WebmotorsSoapInventoryClient soapInventoryClient;
    private final WebmotorsSoapSessionCache sessionCache;

    public WebmotorsAdsService(
            WebmotorsCredentialService credentialService,
            WebmotorsCatalogService catalogService,
            WebmotorsAdRepositoryJpa adRepository,
            WebmotorsSyncJobRepositoryJpa jobRepository,
            WebmotorsSyncLogRepositoryJpa logRepository,
            IoAutoVehicleRepositoryJpa vehicleRepository,
            WmPublicationStatusService publicationStatusService,
            WmStockService stockService,
            WebmotorsSoapAuthClient soapAuthClient,
            WebmotorsSoapInventoryClient soapInventoryClient,
            WebmotorsSoapSessionCache sessionCache
    ) {
        this.credentialService = credentialService;
        this.catalogService = catalogService;
        this.adRepository = adRepository;
        this.jobRepository = jobRepository;
        this.logRepository = logRepository;
        this.vehicleRepository = vehicleRepository;
        this.publicationStatusService = publicationStatusService;
        this.stockService = stockService;
        this.soapAuthClient = soapAuthClient;
        this.soapInventoryClient = soapInventoryClient;
        this.sessionCache = sessionCache;
    }

    @Transactional(readOnly = true)
    public List<JpaWebmotorsAdEntity> listAds(UUID companyId) {
        return stockService.listAds(companyId);
    }

    @Transactional(readOnly = true)
    public JpaWebmotorsAdEntity getAd(UUID companyId, UUID vehicleId) {
        return stockService.getAd(companyId, vehicleId);
    }

    @Transactional
    public JpaWebmotorsSyncJobEntity enqueuePublish(UUID companyId, UUID vehicleId, String storeKey) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaWebmotorsAdEntity existingAd = adRepository.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null);
        WebmotorsJobType jobType = existingAd != null && safe(existingAd.getRemoteAdCode()).isBlank() == false
                ? WebmotorsJobType.UPDATE_AD
                : WebmotorsJobType.PUBLISH_AD;
        return enqueueVehicleJob(companyId, normalizeStoreKey(storeKey), vehicle, existingAd, jobType);
    }

    @Transactional
    public JpaWebmotorsSyncJobEntity enqueueDelete(UUID companyId, UUID vehicleId, String storeKey) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaWebmotorsAdEntity existingAd = adRepository.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null);
        return enqueueVehicleJob(companyId, normalizeStoreKey(storeKey), vehicle, existingAd, WebmotorsJobType.DELETE_AD);
    }

    @Transactional
    public int reconcileRemoteInventory(UUID companyId, String storeKey, int pageSize) {
        return stockService.reconcileRemoteInventory(companyId, storeKey, pageSize);
    }

    @Transactional
    public List<WebmotorsCatalogEntry> refreshCatalog(UUID companyId, String storeKey, String type) {
        return stockService.refreshCatalog(companyId, storeKey, type);
    }

    @Transactional
    public List<JpaWebmotorsSyncJobEntity> processPendingJobs() {
        List<JpaWebmotorsSyncJobEntity> jobs = jobRepository.findTop20ByStatusInAndNextRetryAtLessThanEqualOrderByCreatedAtAsc(
                List.of(WebmotorsJobStatus.PENDING.name()),
                Instant.now()
        );
        for (JpaWebmotorsSyncJobEntity job : jobs) {
            processSingleJob(job);
        }
        return jobs;
    }

    private JpaWebmotorsSyncJobEntity enqueueVehicleJob(
            UUID companyId,
            String storeKey,
            JpaIoAutoVehicleEntity vehicle,
            JpaWebmotorsAdEntity existingAd,
            WebmotorsJobType jobType
    ) {
        WebmotorsCredentialSnapshot credentials = credentialService.getOrCreate(companyId, storeKey);
        assertSoapAdsEnabled(credentials);
        String idempotencyKey = buildIdempotencyKey(jobType, vehicle, existingAd);
        JpaWebmotorsSyncJobEntity existingJob = jobRepository.findByCompanyIdAndIdempotencyKey(companyId, idempotencyKey).orElse(null);
        if (existingJob != null) {
            return existingJob;
        }

        Instant now = Instant.now();
        JpaWebmotorsSyncJobEntity job = new JpaWebmotorsSyncJobEntity();
        job.setId(UUID.randomUUID());
        job.setCompanyId(companyId);
        job.setStoreKey(storeKey);
        job.setJobType(jobType.name());
        job.setAggregateId(vehicle.getId());
        job.setIdempotencyKey(idempotencyKey);
        job.setPayloadJson(writeJson(Map.of("vehicleId", vehicle.getId().toString(), "storeKey", storeKey)));
        job.setStatus(WebmotorsJobStatus.PENDING.name());
        job.setAttempts(0);
        job.setNextRetryAt(now);
        job.setCreatedAt(now);
        job.setUpdatedAt(now);
        jobRepository.save(job);
        publicationStatusService.markQueued(companyId, vehicle.getId());
        return job;
    }

    private void processSingleJob(JpaWebmotorsSyncJobEntity job) {
        try {
            job.setStatus(WebmotorsJobStatus.PROCESSING.name());
            job.setAttempts(job.getAttempts() + 1);
            job.setStartedAt(Instant.now());
            job.setLockedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            jobRepository.save(job);

            Map<String, String> payload = OBJECT_MAPPER.readValue(job.getPayloadJson(), new TypeReference<Map<String, String>>() {});
            UUID vehicleId = UUID.fromString(payload.get("vehicleId"));
            WebmotorsJobType jobType = WebmotorsJobType.valueOf(job.getJobType());
            switch (jobType) {
                case PUBLISH_AD -> executePublish(job, vehicleId, false);
                case UPDATE_AD -> executePublish(job, vehicleId, true);
                case DELETE_AD -> executeDelete(job, vehicleId);
                case SYNC_ADS -> reconcileRemoteInventory(job.getCompanyId(), job.getStoreKey(), 50);
            }

            job.setStatus(WebmotorsJobStatus.COMPLETED.name());
            job.setFinishedAt(Instant.now());
            job.setLastError(null);
            job.setUpdatedAt(Instant.now());
            jobRepository.save(job);
        } catch (BusinessException exception) {
            failJob(job, exception.code(), exception.getMessage());
        } catch (Exception exception) {
            failJob(job, "WEBMOTORS_JOB_FAILED", "Nao foi possivel processar o job da Webmotors.");
        }
    }

    private void executePublish(JpaWebmotorsSyncJobEntity job, UUID vehicleId, boolean update) {
        UUID companyId = job.getCompanyId();
        String storeKey = normalizeStoreKey(job.getStoreKey());
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaWebmotorsAdEntity existingAd = adRepository.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null);
        WebmotorsCredentialSnapshot credentials = credentialService.getOrCreate(companyId, storeKey);
        String hash = resolveSoapHash(credentials);
        Map<String, String> requestPayload = buildAdPayload(companyId, storeKey, vehicle, update, existingAd);

        publicationStatusService.markInProgress(companyId, vehicleId);
        WebmotorsTransportResult<WebmotorsSoapOperationResult> transport = update
                ? soapInventoryClient.updateAd(credentials, hash, requestPayload)
                : soapInventoryClient.publishAd(credentials, hash, requestPayload);
        logSoap(
                companyId,
                job.getId(),
                update ? "AlterarAnuncio" : "IncluirAnuncio",
                transport.statusCode(),
                transport.payload().codigoRetorno(),
                transport.payload().requestId(),
                transport.sanitizedRequest(),
                transport.sanitizedResponse()
        );
        ensureReturnCodeOk(transport.payload().codigoRetorno(), update ? "edicao do anuncio" : "publicacao do anuncio");

        Instant now = Instant.now();
        JpaWebmotorsAdEntity ad = existingAd == null ? new JpaWebmotorsAdEntity() : existingAd;
        if (ad.getId() == null) {
            ad.setId(UUID.randomUUID());
            ad.setCompanyId(companyId);
            ad.setStoreKey(storeKey);
            ad.setVehicleId(vehicleId);
            ad.setCreatedAt(now);
        }

        JpaIoAutoVehiclePublicationEntity publication = publicationStatusService.markPublished(
                companyId,
                vehicleId,
                transport.payload().remoteAdCode(),
                now
        );
        ad.setPublicationId(publication.getId());
        ad.setRemoteAdCode(firstNonBlank(transport.payload().remoteAdCode(), ad.getRemoteAdCode()));
        ad.setRemoteStatus(firstNonBlank(transport.payload().remoteStatus(), update ? "UPDATED" : "PUBLISHED"));
        ad.setTitle(vehicle.getTitle());
        ad.setBrand(vehicle.getBrand());
        ad.setModel(vehicle.getModel());
        ad.setVersion(vehicle.getVersion());
        ad.setPriceCents(vehicle.getPriceCents());
        ad.setMileage(vehicle.getMileage());
        ad.setCatalogSnapshotJson(writeJson(buildCatalogSnapshot(companyId, storeKey, vehicle)));
        ad.setRemotePayloadJson(transport.payload().rawPayloadJson());
        ad.setLastSoapReturnCode(transport.payload().codigoRetorno());
        ad.setLastSoapRequestId(transport.payload().requestId());
        ad.setLastError(null);
        ad.setLastSyncAt(now);
        ad.setRemoteUpdatedAt(now);
        ad.setUpdatedAt(now);
        if (ad.getPublishedAt() == null) {
            ad.setPublishedAt(now);
        }
        adRepository.save(ad);
        credentialService.markSoapSync(companyId, storeKey, now, null);
    }

    private void executeDelete(JpaWebmotorsSyncJobEntity job, UUID vehicleId) {
        UUID companyId = job.getCompanyId();
        String storeKey = normalizeStoreKey(job.getStoreKey());
        JpaWebmotorsAdEntity ad = adRepository.findByCompanyIdAndVehicleId(companyId, vehicleId)
                .orElseThrow(() -> new BusinessException("WEBMOTORS_AD_NOT_FOUND", "Nao existe anuncio Webmotors vinculado a este veiculo."));
        WebmotorsCredentialSnapshot credentials = credentialService.getOrCreate(companyId, storeKey);
        String hash = resolveSoapHash(credentials);
        WebmotorsTransportResult<WebmotorsSoapOperationResult> transport = soapInventoryClient.deleteAd(credentials, hash, ad.getRemoteAdCode());
        logSoap(
                companyId,
                job.getId(),
                "ExcluirAnuncio",
                transport.statusCode(),
                transport.payload().codigoRetorno(),
                transport.payload().requestId(),
                transport.sanitizedRequest(),
                transport.sanitizedResponse()
        );
        ensureReturnCodeOk(transport.payload().codigoRetorno(), "exclusao do anuncio");

        Instant now = Instant.now();
        ad.setRemoteStatus("REMOVED");
        ad.setDeletedAt(now);
        ad.setLastSoapReturnCode(transport.payload().codigoRetorno());
        ad.setLastSoapRequestId(transport.payload().requestId());
        ad.setLastSyncAt(now);
        ad.setUpdatedAt(now);
        adRepository.save(ad);
        publicationStatusService.markRemoved(companyId, vehicleId, ad.getRemoteAdCode(), now);
        credentialService.markSoapSync(companyId, storeKey, now, null);
    }

    private String resolveSoapHash(WebmotorsCredentialSnapshot credentials) {
        String cached = sessionCache.get(credentials.companyId(), credentials.storeKey());
        if (cached != null && !cached.isBlank()) {
            return cached;
        }

        WebmotorsTransportResult<WebmotorsSoapAuthResult> transport = soapAuthClient.authenticate(credentials);
        logSoap(
                credentials.companyId(),
                null,
                "Autenticar",
                transport.statusCode(),
                transport.payload().codigoRetorno(),
                transport.payload().requestId(),
                transport.sanitizedRequest(),
                transport.sanitizedResponse()
        );
        ensureReturnCodeOk(transport.payload().codigoRetorno(), "autenticacao SOAP");
        if (safe(transport.payload().hashAutenticacao()).isBlank()) {
            throw new BusinessException("WEBMOTORS_SOAP_HASH_MISSING", "A Webmotors nao retornou o HashAutenticacao.");
        }

        sessionCache.put(credentials.companyId(), credentials.storeKey(), transport.payload().hashAutenticacao(), Instant.now().plusSeconds(20 * 60));
        return transport.payload().hashAutenticacao();
    }

    private Map<String, String> buildAdPayload(
            UUID companyId,
            String storeKey,
            JpaIoAutoVehicleEntity vehicle,
            boolean update,
            JpaWebmotorsAdEntity existingAd
    ) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("pTitulo", safe(vehicle.getTitle()));
        payload.put("pDescricao", safe(vehicle.getDescription()));
        payload.put("pCodigoMarca", catalogService.resolveCode(companyId, storeKey, "brand", vehicle.getBrand()));
        payload.put("pCodigoModelo", catalogService.resolveCode(companyId, storeKey, "model", vehicle.getModel()));
        if (safe(vehicle.getVersion()).isBlank() == false) {
            payload.put("pCodigoVersao", catalogService.resolveCode(companyId, storeKey, "version", vehicle.getVersion()));
        }
        if (safe(vehicle.getFuelType()).isBlank() == false) {
            payload.put("pCodigoCombustivel", catalogService.resolveCode(companyId, storeKey, "fuel", vehicle.getFuelType()));
        }
        if (safe(vehicle.getTransmission()).isBlank() == false) {
            payload.put("pCodigoCambio", catalogService.resolveCode(companyId, storeKey, "transmission", vehicle.getTransmission()));
        }
        if (safe(vehicle.getColor()).isBlank() == false) {
            payload.put("pCodigoCor", catalogService.resolveCode(companyId, storeKey, "color", vehicle.getColor()));
        }
        if (vehicle.getPriceCents() != null) {
            payload.put("pPrecoVenda", String.valueOf(vehicle.getPriceCents()));
        }
        if (vehicle.getMileage() != null) {
            payload.put("pQuilometragem", String.valueOf(vehicle.getMileage()));
        }
        if (vehicle.getModelYear() != null) {
            payload.put("pAnoModelo", String.valueOf(vehicle.getModelYear()));
        }
        if (vehicle.getManufactureYear() != null) {
            payload.put("pAnoFabricacao", String.valueOf(vehicle.getManufactureYear()));
        }
        if (safe(vehicle.getStockNumber()).isBlank() == false) {
            payload.put("pNumeroEstoque", vehicle.getStockNumber());
        }
        if (update && existingAd != null && safe(existingAd.getRemoteAdCode()).isBlank() == false) {
            payload.put("pCodigoAnuncio", existingAd.getRemoteAdCode());
        }
        return payload;
    }

    private Map<String, String> buildCatalogSnapshot(UUID companyId, String storeKey, JpaIoAutoVehicleEntity vehicle) {
        Map<String, String> snapshot = new LinkedHashMap<>();
        snapshot.put("brand", catalogService.resolveCode(companyId, storeKey, "brand", vehicle.getBrand()));
        snapshot.put("model", catalogService.resolveCode(companyId, storeKey, "model", vehicle.getModel()));
        if (safe(vehicle.getVersion()).isBlank() == false) {
            snapshot.put("version", catalogService.resolveCode(companyId, storeKey, "version", vehicle.getVersion()));
        }
        return snapshot;
    }

    private void failJob(JpaWebmotorsSyncJobEntity job, String code, String message) {
        boolean retry = shouldRetry(code, job.getAttempts());
        job.setStatus(retry ? WebmotorsJobStatus.PENDING.name() : WebmotorsJobStatus.FAILED.name());
        job.setLastError(message);
        job.setNextRetryAt(retry ? Instant.now().plusSeconds((long) Math.min(300, Math.pow(2, job.getAttempts()) * 30)) : Instant.now());
        job.setUpdatedAt(Instant.now());
        if (job.getAggregateId() != null) {
            publicationStatusService.markError(job.getCompanyId(), job.getAggregateId(), message);
        }
        jobRepository.save(job);
        credentialService.markSoapSync(job.getCompanyId(), job.getStoreKey(), Instant.now(), message);
    }

    private void logSoap(
            UUID companyId,
            UUID jobId,
            String operation,
            int statusCode,
            String returnCode,
            String requestId,
            String requestPayload,
            String responsePayload
    ) {
        saveLog(companyId, jobId, "SOAP", "REQUEST", operation, null, null, requestId, requestPayload);
        saveLog(companyId, jobId, "SOAP", "RESPONSE", operation, statusCode, returnCode, requestId, responsePayload);
    }

    private void saveLog(
            UUID companyId,
            UUID jobId,
            String channel,
            String direction,
            String operation,
            Integer statusCode,
            String returnCode,
            String requestId,
            String payload
    ) {
        JpaWebmotorsSyncLogEntity log = new JpaWebmotorsSyncLogEntity();
        log.setId(UUID.randomUUID());
        log.setCompanyId(companyId);
        log.setJobId(jobId);
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

    private JpaIoAutoVehicleEntity requireVehicle(UUID companyId, UUID vehicleId) {
        return vehicleRepository.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
    }

    private boolean shouldRetry(String code, int attempts) {
        if (attempts >= 5) {
            return false;
        }
        String normalized = safe(code).toUpperCase(Locale.ROOT);
        return !(normalized.contains("MISSING")
                || normalized.contains("NOT_FOUND")
                || normalized.contains("DISABLED")
                || normalized.contains("INVALID"));
    }

    private String buildIdempotencyKey(WebmotorsJobType jobType, JpaIoAutoVehicleEntity vehicle, JpaWebmotorsAdEntity existingAd) {
        return sha256(
                jobType.name()
                        + ":"
                        + vehicle.getId()
                        + ":"
                        + safe(existingAd == null ? null : existingAd.getRemoteAdCode())
                        + ":"
                        + safe(vehicle.getUpdatedAt() == null ? null : vehicle.getUpdatedAt().toString())
        );
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(safe(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder buffer = new StringBuilder();
            for (byte item : digest) {
                buffer.append(String.format("%02x", item));
            }
            return buffer.toString();
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_HASH_FAILED", "Nao foi possivel calcular a assinatura do job da Webmotors.");
        }
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new BusinessException("WEBMOTORS_JSON_SERIALIZATION_FAILED", "Nao foi possivel serializar os dados da Webmotors.");
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (safe(value).isBlank() == false) {
                return value.trim();
            }
        }
        return "";
    }

    private String normalizeStoreKey(String storeKey) {
        String normalized = safe(storeKey).toLowerCase(Locale.ROOT);
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
