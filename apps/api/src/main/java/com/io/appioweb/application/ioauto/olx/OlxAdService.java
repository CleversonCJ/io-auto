package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.integrations.olx.OlxResponseParser;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.OlxAdRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class OlxAdService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("America/Sao_Paulo");

    private final IoAutoVehicleRepositoryJpa vehicles;
    private final OlxAdRepositoryJpa ads;
    private final OlxAccountService accountService;
    private final OlxAdMapper mapper;
    private final OlxApiClient apiClient;
    private final OlxResponseParser responseParser;
    private final OlxPublicationStatusService publicationStatusService;

    public OlxAdService(
            IoAutoVehicleRepositoryJpa vehicles,
            OlxAdRepositoryJpa ads,
            OlxAccountService accountService,
            OlxAdMapper mapper,
            OlxApiClient apiClient,
            OlxResponseParser responseParser,
            OlxPublicationStatusService publicationStatusService
    ) {
        this.vehicles = vehicles;
        this.ads = ads;
        this.accountService = accountService;
        this.mapper = mapper;
        this.apiClient = apiClient;
        this.responseParser = responseParser;
        this.publicationStatusService = publicationStatusService;
    }

    @Transactional
    public OlxAdSnapshot publishVehicle(UUID companyId, UUID vehicleId) {
        return sendInsert(companyId, vehicleId, "insert");
    }

    @Transactional
    public OlxAdSnapshot updateVehicleAd(UUID companyId, UUID vehicleId) {
        return sendInsert(companyId, vehicleId, "insert");
    }

    @Transactional
    public OlxAdSnapshot unpublishVehicle(UUID companyId, UUID vehicleId) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaOlxAdEntity existing = ads.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null);
        String accessToken = accountService.requireAccessToken(companyId);
        OlxAdMapper.OlxPayload payload = mapper.buildDeletePayload(
                companyId,
                vehicleId,
                accessToken,
                existing == null ? null : existing.getLocalAdId()
        );

        String rawResponse = apiClient.importAds(payload.payloadJson()).toString();
        OlxResponseParser.ImportResponse response = responseParser.parseImportResponse(rawResponse);
        JpaOlxAdEntity ad = upsertAd(companyId, vehicle.getId(), existing, payload.localAdId(), "delete", payload.payloadJson(), rawResponse);
        if (response.statusCode() != 0) {
            ad.setStatus("ERROR");
            ad.setLastStatusMessage(buildImportErrorMessage(response));
            ads.save(ad);
            publicationStatusService.sync(ad);
            throw new BusinessException("OLX_DELETE_FAILED", ad.getLastStatusMessage());
        }
        ad.setImportToken(nullable(response.token()));
        ad.setStatus("DELETE_PENDING");
        ad.setLastStatusMessage(null);
        ad.setUpdatedAt(Instant.now());
        ads.save(ad);
        publicationStatusService.sync(ad);
        return toSnapshot(ad);
    }

    @Transactional
    public OlxAdSnapshot checkImportStatus(UUID companyId, UUID olxAdId) {
        JpaOlxAdEntity ad = ads.findByIdAndCompanyId(olxAdId, companyId)
                .orElseThrow(() -> new BusinessException("OLX_AD_NOT_FOUND", "Anuncio OLX nao encontrado."));
        syncImportStatus(ad, true);
        return toSnapshot(ad);
    }

    @Transactional
    public OlxAdSnapshot checkImportStatusByToken(UUID companyId, String importToken) {
        JpaOlxAdEntity ad = ads.findByCompanyIdAndImportToken(companyId, importToken)
                .orElseThrow(() -> new BusinessException("OLX_AD_NOT_FOUND", "Nao foi encontrado anuncio OLX para o token informado."));
        syncImportStatus(ad, true);
        return toSnapshot(ad);
    }

    @Transactional(readOnly = true)
    public OlxAdSnapshot getVehicleAd(UUID companyId, UUID vehicleId) {
        return ads.findByCompanyIdAndVehicleId(companyId, vehicleId)
                .map(this::toSnapshot)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<OlxAdSnapshot> listLocalAds(UUID companyId, String status, UUID vehicleId, LocalDate fromDate, LocalDate toDate) {
        Instant from = fromDate == null ? null : fromDate.atStartOfDay(DEFAULT_ZONE).toInstant();
        Instant to = toDate == null ? null : toDate.plusDays(1).atStartOfDay(DEFAULT_ZONE).toInstant();
        return ads.findAllByCompanyIdOrderByUpdatedAtDesc(companyId).stream()
                .filter(item -> vehicleId == null || item.getVehicleId().equals(vehicleId))
                .filter(item -> safe(status).isBlank() || safe(item.getStatus()).equalsIgnoreCase(safe(status)))
                .filter(item -> from == null || !item.getUpdatedAt().isBefore(from))
                .filter(item -> to == null || item.getUpdatedAt().isBefore(to))
                .map(this::toSnapshot)
                .toList();
    }

    @Transactional
    public PublishedAdsPage listPublishedAds(UUID companyId, String adsStatus, String pageToken, Integer fetchSize) {
        String accessToken = accountService.requireAccessToken(companyId);
        OlxResponseParser.PublishedAdsPageResponse response = responseParser.parsePublishedAdsPage(
                apiClient.listPublishedAds(accessToken, adsStatus, pageToken, fetchSize).toString()
        );

        List<PublishedAdItem> items = new ArrayList<>();
        for (OlxResponseParser.PublishedAdItem item : response.data()) {
            items.add(new PublishedAdItem(item.id(), item.listId(), normalizePublishedStatus(item.status()), null));
            ads.findByCompanyIdAndLocalAdId(companyId, item.id()).ifPresent(localAd -> {
                if (!safe(item.listId()).isBlank()) {
                    localAd.setOlxListId(item.listId());
                }
                localAd.setStatus(normalizePublishedStatus(item.status()));
                localAd.setUpdatedAt(Instant.now());
                ads.save(localAd);
                publicationStatusService.sync(localAd);
            });
        }
        return new PublishedAdsPage(items, response.currentToken(), response.nextToken());
    }

    @Transactional(readOnly = true)
    public BalanceSnapshot getBalance(UUID companyId) {
        String accessToken = accountService.requireAccessToken(companyId);
        OlxApiClient.HttpJsonResponse response = apiClient.getBalance(accessToken);
        OlxResponseParser.BalanceResponse parsed = responseParser.parseBalance(response.rawBody(), response.httpStatus());
        return new BalanceSnapshot(
                parsed.available(),
                parsed.id(),
                parsed.name(),
                parsed.ads() == null ? null : new CounterSnapshot(parsed.ads().performed(), parsed.ads().available(), parsed.ads().total()),
                parsed.bumps() == null ? null : new BumpsSnapshot(
                        parsed.bumps().plan() == null ? null : new CounterSnapshot(parsed.bumps().plan().performed(), parsed.bumps().plan().available(), parsed.bumps().plan().total()),
                        parsed.bumps().additional() == null ? null : new CounterSnapshot(parsed.bumps().additional().performed(), parsed.bumps().additional().available(), parsed.bumps().additional().total())
                ),
                parsed.lastRenewDate(),
                parsed.nextRenewDate(),
                parsed.reason(),
                parsed.message()
        );
    }

    @Transactional
    public OlxAdSnapshot refreshPublishedAdStatus(UUID companyId, String listId) {
        String accessToken = accountService.requireAccessToken(companyId);
        JpaOlxAdEntity ad = ads.findByCompanyIdAndOlxListId(companyId, listId)
                .orElseThrow(() -> new BusinessException("OLX_AD_NOT_FOUND", "Nao foi encontrado anuncio local para o list_id informado."));
        syncPublishedStatus(ad, accessToken);
        return toSnapshot(ad);
    }

    @Transactional
    public void syncPendingAdsBatch(int batchSize) {
        List<String> statuses = List.of("IMPORT_PENDING", "QUEUED", "DELETE_PENDING", "PENDING_REVIEW", "ACCEPTED");
        List<JpaOlxAdEntity> pending = ads.findTop20ByStatusInAndImportTokenIsNotNullOrderByUpdatedAtAsc(statuses).stream()
                .sorted(Comparator.comparing(JpaOlxAdEntity::getUpdatedAt))
                .limit(Math.max(1, batchSize))
                .toList();
        for (JpaOlxAdEntity ad : pending) {
            syncImportStatus(ad, false);
        }
    }

    private OlxAdSnapshot sendInsert(UUID companyId, UUID vehicleId, String operation) {
        JpaIoAutoVehicleEntity vehicle = requireVehicle(companyId, vehicleId);
        JpaOlxAdEntity existing = ads.findByCompanyIdAndVehicleId(companyId, vehicleId).orElse(null);
        String accessToken = accountService.requireAccessToken(companyId);
        OlxAdMapper.OlxPayload payload = mapper.buildInsertPayload(
                companyId,
                vehicle,
                accessToken,
                existing == null ? null : existing.getLocalAdId(),
                operation
        );

        String rawResponse = apiClient.importAds(payload.payloadJson()).toString();
        OlxResponseParser.ImportResponse response = responseParser.parseImportResponse(rawResponse);
        JpaOlxAdEntity ad = upsertAd(companyId, vehicle.getId(), existing, payload.localAdId(), operation, payload.payloadJson(), rawResponse);
        if (response.statusCode() != 0) {
            ad.setStatus("ERROR");
            ad.setLastStatusMessage(buildImportErrorMessage(response));
            ads.save(ad);
            publicationStatusService.sync(ad);
            throw new BusinessException("OLX_PUBLISH_FAILED", ad.getLastStatusMessage());
        }

        ad.setImportToken(nullable(response.token()));
        ad.setStatus("IMPORT_PENDING");
        ad.setLastStatusMessage(null);
        ad.setDeletedAt(null);
        ad.setUpdatedAt(Instant.now());
        ads.save(ad);
        publicationStatusService.sync(ad);
        return toSnapshot(ad);
    }

    private void syncImportStatus(JpaOlxAdEntity ad, boolean refreshPublishedStatus) {
        String accessToken = accountService.requireAccessToken(ad.getCompanyId());
        if (safe(ad.getImportToken()).isBlank()) {
            if (!safe(ad.getOlxListId()).isBlank() && refreshPublishedStatus) {
                syncPublishedStatus(ad, accessToken);
            }
            return;
        }

        String rawResponse = apiClient.getImportStatus(ad.getImportToken(), accessToken).toString();
        OlxResponseParser.ImportStatusResponse response = responseParser.parseImportStatusResponse(rawResponse);
        OlxResponseParser.ImportAdStatus entry = response.ads().stream()
                .filter(item -> safe(item.id()).equalsIgnoreCase(safe(ad.getLocalAdId())))
                .findFirst()
                .orElse(response.ads().isEmpty() ? null : response.ads().get(0));

        ad.setLastResponse(rawResponse);
        if (entry != null) {
            applyImportStatus(ad, entry);
        } else {
            ad.setStatus(mapImportProcessingStatus(response.autouploadStatus(), ad.getOperation()));
        }
        ad.setUpdatedAt(Instant.now());
        ads.save(ad);

        if (refreshPublishedStatus && !safe(ad.getOlxListId()).isBlank() && !"DELETED".equals(ad.getStatus())) {
            syncPublishedStatus(ad, accessToken);
        } else {
            publicationStatusService.sync(ad);
        }
    }

    private void applyImportStatus(JpaOlxAdEntity ad, OlxResponseParser.ImportAdStatus entry) {
        if (!safe(entry.listId()).isBlank()) {
            ad.setOlxListId(entry.listId());
        }
        if (!safe(entry.url()).isBlank()) {
            ad.setOlxUrl(entry.url());
        }

        String mapped = mapImportItemStatus(entry.status(), entry.operation());
        ad.setStatus(mapped);
        ad.setLastStatusMessage(joinMessages(entry.messages()));
        if ("DELETED".equals(mapped)) {
            ad.setDeletedAt(Instant.now());
        } else if ("ACCEPTED".equals(mapped) || "PUBLISHED".equals(mapped)) {
            if (ad.getPublishedAt() == null) {
                ad.setPublishedAt(Instant.now());
            }
        }
    }

    private void syncPublishedStatus(JpaOlxAdEntity ad, String accessToken) {
        String rawResponse = apiClient.getPublishedAd(ad.getOlxListId(), accessToken).toString();
        OlxResponseParser.PublishedAdStatusResponse response = responseParser.parsePublishedAdStatus(rawResponse);
        ad.setLastResponse(rawResponse);
        if (!safe(response.listId()).isBlank()) {
            ad.setOlxListId(response.listId());
        }
        if (!safe(response.url()).isBlank()) {
            ad.setOlxUrl(response.url());
        }
        ad.setStatus(normalizePublishedStatus(response.status()));
        ad.setLastStatusMessage(buildPublishedStatusMessage(response.message(), response.imageErrors()));
        if ("PUBLISHED".equals(ad.getStatus()) && ad.getPublishedAt() == null) {
            ad.setPublishedAt(Instant.now());
        }
        if ("DELETED".equals(ad.getStatus())) {
            ad.setDeletedAt(Instant.now());
        }
        ad.setUpdatedAt(Instant.now());
        ads.save(ad);
        publicationStatusService.sync(ad);
    }

    private String buildPublishedStatusMessage(String message, List<OlxResponseParser.ImageError> imageErrors) {
        List<String> parts = new ArrayList<>();
        if (!safe(message).isBlank()) {
            parts.add(translateMessage(message));
        }
        for (OlxResponseParser.ImageError imageError : imageErrors) {
            String translated = translateMessage(firstNonBlank(imageError.status(), imageError.errorMessage()));
            if (!safe(translated).isBlank()) {
                parts.add(translated);
            }
        }
        return parts.isEmpty() ? null : String.join(" | ", parts);
    }

    private JpaOlxAdEntity upsertAd(
            UUID companyId,
            UUID vehicleId,
            JpaOlxAdEntity existing,
            String localAdId,
            String operation,
            String payloadJson,
            String rawResponse
    ) {
        Instant now = Instant.now();
        JpaOlxAdEntity ad = existing == null ? new JpaOlxAdEntity() : existing;
        if (ad.getId() == null) {
            ad.setId(UUID.randomUUID());
            ad.setCompanyId(companyId);
            ad.setVehicleId(vehicleId);
            ad.setCreatedAt(now);
        }
        ad.setLocalAdId(localAdId);
        ad.setOperation(safe(operation).toLowerCase(Locale.ROOT));
        ad.setLastPayload(payloadJson);
        ad.setLastResponse(rawResponse);
        ad.setUpdatedAt(now);
        return ad;
    }

    private JpaIoAutoVehicleEntity requireVehicle(UUID companyId, UUID vehicleId) {
        return vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
    }

    private String buildImportErrorMessage(OlxResponseParser.ImportResponse response) {
        String prefix = switch (response.statusCode()) {
            case -1 -> "A OLX retornou um erro inesperado ao processar o anuncio.";
            case -2 -> "A OLX bloqueou temporariamente a requisicao por excesso de chamadas. Tente novamente em instantes.";
            case -3 -> "Nenhum anuncio foi enviado para a OLX.";
            case -4 -> "A OLX recusou o anuncio por erro de validacao.";
            case -5 -> "O servico de importacao da OLX esta indisponivel no momento.";
            case -6 -> "A conta OLX precisa ter plano profissional empresa habilitado para integracao.";
            case -7 -> "A conta OLX nao possui saldo suficiente de anuncios.";
            case -8 -> "Parte dos anuncios foi ignorada pelo limite de vagas da OLX.";
            default -> safe(response.statusMessage()).isBlank() ? "Nao foi possivel concluir a publicacao na OLX." : response.statusMessage();
        };

        List<String> details = new ArrayList<>();
        for (OlxResponseParser.ImportItemError error : response.errors()) {
            for (String message : error.messages()) {
                String translated = translateMessage(message);
                if (!safe(translated).isBlank()) {
                    details.add(translated);
                }
            }
        }
        if (details.isEmpty() && !safe(response.statusMessage()).isBlank()) {
            details.add(translateMessage(response.statusMessage()));
        }
        return details.isEmpty() ? prefix : prefix + " Detalhes: " + String.join("; ", details);
    }

    private String translateMessage(String raw) {
        String normalized = safe(raw).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NO_IMAGE" -> "O anuncio precisa ter pelo menos uma imagem.";
            case "NO_REGION" -> "O CEP informado e invalido ou nao pertence a uma regiao aceita pela OLX.";
            case "ERROR_VEHICLE_TAG_INVALID" -> "A placa do veiculo esta invalida.";
            case "ERROR_VEHICLE_BRAND_INVALID" -> "A marca informada nao existe no catalogo OLX.";
            case "ERROR_VEHICLE_MODEL_INVALID" -> "O modelo informado nao existe no catalogo OLX.";
            case "ERROR_VEHICLE_VERSION_INVALID" -> "A versao informada nao existe no catalogo OLX.";
            case "ERROR_VEHICLE_BRAND_MODEL_VERSION_INVALID" -> "A combinacao de marca, modelo e versao nao corresponde ao catalogo OLX.";
            case "INVALID_PLATE" -> "A placa esta invalida, nao foi encontrada ou a validacao da OLX esta temporariamente indisponivel.";
            case "NOT_ENOUGH_AD_SLOTS", "ERROR_NOT_ENOUGH_AD_SLOTS" -> "A conta OLX nao possui saldo suficiente de anuncios.";
            case "REFUSED_SUSPECT_PRICE" -> "A OLX recusou o anuncio por preco suspeito.";
            case "ERROR_DOWNLOADING_IMAGE" -> "A OLX nao conseguiu baixar uma das imagens informadas.";
            case "ERROR_UPLOADING_IMAGE" -> "A OLX nao conseguiu processar o upload de uma das imagens.";
            case "ERROR_IMAGE_TOO_SMALL" -> "Uma das imagens do anuncio e muito pequena para a OLX.";
            case "WITHOUT PERMISSION" -> "A conta OLX precisa ter plano profissional empresa habilitado para integracao.";
            default -> safe(raw);
        };
    }

    private String mapImportProcessingStatus(String autouploadStatus, String operation) {
        String normalizedStatus = safe(autouploadStatus).toLowerCase(Locale.ROOT);
        String normalizedOperation = safe(operation).toLowerCase(Locale.ROOT);
        if ("delete".equals(normalizedOperation)) {
            return switch (normalizedStatus) {
                case "queued" -> "DELETE_PENDING";
                case "accepted" -> "DELETED";
                case "refused", "rejected" -> "REFUSED";
                case "error" -> "ERROR";
                default -> "DELETE_PENDING";
            };
        }
        return switch (normalizedStatus) {
            case "queued" -> "QUEUED";
            case "accepted" -> "ACCEPTED";
            case "refused", "rejected" -> "REFUSED";
            case "error" -> "ERROR";
            default -> "IMPORT_PENDING";
        };
    }

    private String mapImportItemStatus(String status, String operation) {
        String normalizedStatus = safe(status).toLowerCase(Locale.ROOT);
        String normalizedOperation = safe(operation).toLowerCase(Locale.ROOT);
        if ("delete".equals(normalizedOperation)) {
            return switch (normalizedStatus) {
                case "pending", "queued" -> "DELETE_PENDING";
                case "accepted" -> "DELETED";
                case "refused", "rejected" -> "REFUSED";
                case "error" -> "ERROR";
                default -> normalizedStatus.isBlank() ? "DELETE_PENDING" : normalizedStatus.toUpperCase(Locale.ROOT);
            };
        }
        return switch (normalizedStatus) {
            case "pending" -> "IMPORT_PENDING";
            case "queued" -> "QUEUED";
            case "accepted" -> "ACCEPTED";
            case "refused", "rejected" -> "REFUSED";
            case "error" -> "ERROR";
            default -> normalizedStatus.isBlank() ? "IMPORT_PENDING" : normalizedStatus.toUpperCase(Locale.ROOT);
        };
    }

    private String normalizePublishedStatus(String status) {
        String normalized = safe(status).toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "active", "published", "online" -> "PUBLISHED";
            case "accepted" -> "ACCEPTED";
            case "pending_review", "under_review" -> "PENDING_REVIEW";
            case "queued" -> "QUEUED";
            case "pending" -> "IMPORT_PENDING";
            case "refused", "rejected" -> "REFUSED";
            case "deleted", "removed", "inactive" -> "DELETED";
            case "error" -> "ERROR";
            default -> normalized.isBlank() ? "IMPORT_PENDING" : normalized.toUpperCase(Locale.ROOT);
        };
    }

    private String joinMessages(List<String> messages) {
        List<String> translated = new ArrayList<>();
        for (String message : messages) {
            String value = translateMessage(message);
            if (!safe(value).isBlank()) {
                translated.add(value);
            }
        }
        return translated.isEmpty() ? null : String.join("; ", translated);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String nullable(String value) {
        String normalized = safe(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private OlxAdSnapshot toSnapshot(JpaOlxAdEntity ad) {
        return new OlxAdSnapshot(
                ad.getId(),
                ad.getVehicleId(),
                ad.getLocalAdId(),
                ad.getOlxListId(),
                ad.getOlxUrl(),
                ad.getImportToken(),
                ad.getOperation(),
                ad.getStatus(),
                ad.getLastStatusMessage(),
                ad.getPublishedAt(),
                ad.getDeletedAt(),
                ad.getCreatedAt(),
                ad.getUpdatedAt()
        );
    }

    public record OlxAdSnapshot(
            UUID id,
            UUID vehicleId,
            String localAdId,
            String olxListId,
            String olxUrl,
            String importToken,
            String operation,
            String status,
            String lastStatusMessage,
            Instant publishedAt,
            Instant deletedAt,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record PublishedAdsPage(List<PublishedAdItem> data, String currentToken, String nextToken) {
    }

    public record PublishedAdItem(String id, String listId, String status, String url) {
    }

    public record BalanceSnapshot(
            boolean available,
            String id,
            String name,
            CounterSnapshot ads,
            BumpsSnapshot bumps,
            Instant lastRenewDate,
            Instant nextRenewDate,
            String reason,
            String message
    ) {
    }

    public record CounterSnapshot(Integer performed, Integer available, Integer total) {
    }

    public record BumpsSnapshot(CounterSnapshot plan, CounterSnapshot additional) {
    }
}
