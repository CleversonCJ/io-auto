package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoPublicCatalogLeadRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoIntegrationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoPublicLinkRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoPublicLeadEventRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoIntegrationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoPublicCatalogLeadEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoPublicLinkEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoPublicLeadEventEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.ioauto.VehicleAutoPublicationService;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.meli.MeliCategoryService;
import com.io.appioweb.application.ioauto.meli.MeliListingTypeService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
public class IoAutoController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final ZoneId DASHBOARD_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final int MAX_PUBLIC_CATALOG_BANNER_IMAGES = 6;
    private static final int MAX_PUBLIC_CATALOG_IMAGE_LENGTH = 2_000_000;
    private static final List<String> DEFAULT_INTEGRATION_PROVIDER_KEYS = List.of("olx", "mercadolivre", "webmotors");

    private final CurrentUserPort currentUser;
    private final CompanyRepositoryPort companies;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final IoAutoPublicLinkRepositoryJpa publicLinks;
    private final IoAutoPublicLeadEventRepositoryJpa publicLeadEvents;
    private final IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads;
    private final IoAutoBillingService billingService;
    private final VehicleAutoPublicationService vehicleAutoPublicationService;
    private final MeliAdService meliAdService;
    private final MeliCategoryService meliCategoryService;
    private final MeliListingTypeService meliListingTypeService;
    private final OlxAdService olxAdService;

    public IoAutoController(
            CurrentUserPort currentUser,
            CompanyRepositoryPort companies,
            AtendimentoConversationRepositoryJpa conversations,
            AtendimentoSessionRepositoryJpa sessions,
            IoAutoVehicleRepositoryJpa vehicles,
            IoAutoVehiclePublicationRepositoryJpa publications,
            IoAutoIntegrationRepositoryJpa integrations,
            IoAutoPublicLinkRepositoryJpa publicLinks,
            IoAutoPublicLeadEventRepositoryJpa publicLeadEvents,
            IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads,
            IoAutoBillingService billingService,
            VehicleAutoPublicationService vehicleAutoPublicationService,
            MeliAdService meliAdService,
            MeliCategoryService meliCategoryService,
            MeliListingTypeService meliListingTypeService,
            OlxAdService olxAdService
    ) {
        this.currentUser = currentUser;
        this.companies = companies;
        this.conversations = conversations;
        this.sessions = sessions;
        this.vehicles = vehicles;
        this.publications = publications;
        this.integrations = integrations;
        this.publicLinks = publicLinks;
        this.publicLeadEvents = publicLeadEvents;
        this.publicCatalogLeads = publicCatalogLeads;
        this.billingService = billingService;
        this.vehicleAutoPublicationService = vehicleAutoPublicationService;
        this.meliAdService = meliAdService;
        this.meliCategoryService = meliCategoryService;
        this.meliListingTypeService = meliListingTypeService;
        this.olxAdService = olxAdService;
    }

    @GetMapping("/ioauto/dashboard")
    public ResponseEntity<IoAutoDashboardHttpResponse> getDashboard(
            @RequestParam(name = "preset", required = false) String preset,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to
    ) {
        UUID companyId = currentUser.companyId();
        String companyName = companies.findById(companyId).map(company -> company.name()).orElse("IOAuto");
        DashboardPeriodSelection periodSelection = resolveDashboardPeriod(preset, from, to);

        List<JpaIoAutoVehicleEntity> companyVehicles = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        List<JpaIoAutoVehiclePublicationEntity> companyPublications = publications.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        List<JpaIoAutoIntegrationEntity> companyIntegrations = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .toList();
        List<JpaAtendimentoConversationEntity> companyConversations = conversations.findAllByCompanyIdOrderByLastMessageAtDescUpdatedAtDesc(companyId).stream()
                .filter(conversation -> isSupportedLeadSource(conversation.getSourcePlatform()))
                .toList();
        BillingSnapshot billing = billingService.getBillingSnapshot(companyId);
        List<JpaAtendimentoSessionEntity> periodLeadSessions = sessions.findAllByCompanyIdAndArrivedAtGreaterThanEqualAndArrivedAtLessThanOrderByArrivedAtAsc(
                companyId,
                periodSelection.fromAt(),
                periodSelection.toExclusiveAt()
        );
        List<JpaAtendimentoSessionEntity> periodSalesSessions = sessions.findAllByCompanyIdAndSaleCompletedIsTrueAndSaleCompletedAtGreaterThanEqualAndSaleCompletedAtLessThanOrderBySaleCompletedAtAsc(
                companyId,
                periodSelection.fromAt(),
                periodSelection.toExclusiveAt()
        );

        long featuredCount = companyVehicles.stream().filter(JpaIoAutoVehicleEntity::isFeatured).count();
        long connectedIntegrations = companyIntegrations.stream()
                .filter(integration -> "CONNECTED".equalsIgnoreCase(integration.getStatus()) || "ACTIVE".equalsIgnoreCase(integration.getStatus()))
                .count();
        long activePublicationCount = companyPublications.stream()
                .filter(publication -> isActivePublicationStatus(publication.getStatus()))
                .count();

        long inventoryValueCents = companyVehicles.stream()
                .filter(vehicle -> "SOLD".equalsIgnoreCase(vehicle.getStatus()) == false)
                .mapToLong(vehicle -> vehicle.getPriceCents() == null ? 0L : Math.max(vehicle.getPriceCents(), 0L))
                .sum();

        long totalSalesCount = 0L;
        long totalSalesRevenueCents = 0L;
        for (JpaAtendimentoSessionEntity session : periodSalesSessions) {
            totalSalesCount++;
            if (session.getSoldVehicleId() != null) {
                Long price = companyVehicles.stream()
                        .filter(v -> v.getId().equals(session.getSoldVehicleId()))
                        .map(JpaIoAutoVehicleEntity::getPriceCents)
                        .findFirst()
                        .orElse(null);
                if (price != null && price > 0) {
                    totalSalesRevenueCents += price;
                }
            }
        }

        Map<String, Long> sources = new LinkedHashMap<>();
        for (JpaAtendimentoConversationEntity conversation : companyConversations) {
            String key = normalizeSourcePlatform(conversation.getSourcePlatform());
            sources.put(key, sources.getOrDefault(key, 0L) + 1L);
        }

        List<IoAutoDashboardHttpResponse.SourceSummary> sourceSummaries = sources.entrySet().stream()
                .map(entry -> new IoAutoDashboardHttpResponse.SourceSummary(entry.getKey(), sourceLabel(entry.getKey()), entry.getValue()))
                .sorted(Comparator.comparing(IoAutoDashboardHttpResponse.SourceSummary::total).reversed())
                .toList();
        List<IoAutoDashboardHttpResponse.PeriodPoint> leadVsSales = buildLeadVsSalesSeries(periodSelection, periodLeadSessions, periodSalesSessions);
        List<IoAutoDashboardHttpResponse.SellerSalesSummary> salesBySeller = buildSalesBySeller(periodSalesSessions);

        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> publicationsByVehicle = groupPublicationsByVehicle(companyId, companyVehicles);

        List<IoAutoDashboardHttpResponse.RecentVehicle> recentVehicles = companyVehicles.stream()
                .limit(5)
                .map(vehicle -> new IoAutoDashboardHttpResponse.RecentVehicle(
                        vehicle.getId(),
                        vehicle.getTitle(),
                        vehicle.getPriceCents(),
                        normalizeText(vehicle.getStatus(), "DRAFT"),
                        vehicle.getUpdatedAt(),
                        publicationsByVehicle.getOrDefault(vehicle.getId(), List.of()).size()
                ))
                .toList();

        List<IoAutoDashboardHttpResponse.RecentConversation> recentConversations = companyConversations.stream()
                .limit(6)
                .map(conversation -> new IoAutoDashboardHttpResponse.RecentConversation(
                        conversation.getId(),
                        normalizeText(conversation.getDisplayName(), conversation.getPhone()),
                        normalizeText(conversation.getLastMessageText(), "Sem mensagens recentes."),
                        conversation.getLastMessageAt(),
                        normalizeSourcePlatform(conversation.getSourcePlatform())
                ))
                .toList();

        return ResponseEntity.ok(new IoAutoDashboardHttpResponse(
                companyName,
                companyVehicles.size(),
                featuredCount,
                activePublicationCount,
                companyConversations.size(),
                connectedIntegrations,
                inventoryValueCents,
                totalSalesCount,
                totalSalesRevenueCents,
                billing,
                new IoAutoDashboardHttpResponse.PeriodFilter(
                        periodSelection.preset(),
                        DATE_FORMATTER.format(periodSelection.fromDate()),
                        DATE_FORMATTER.format(periodSelection.toDate())
                ),
                leadVsSales,
                salesBySeller,
                sourceSummaries,
                recentVehicles,
                recentConversations
        ));
    }

    @GetMapping("/ioauto/vehicles")
    public ResponseEntity<List<IoAutoVehicleHttpResponse>> listVehicles() {
        UUID companyId = currentUser.companyId();
        List<JpaIoAutoVehicleEntity> companyVehicles = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> publicationsByVehicle = groupPublicationsByVehicle(companyId, companyVehicles);
        Map<String, JpaIoAutoIntegrationEntity> integrationsByKey = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoIntegrationEntity::getProviderKey, item -> item, (left, right) -> left, LinkedHashMap::new));

        List<IoAutoVehicleHttpResponse> response = companyVehicles.stream()
                .map(vehicle -> toVehicleResponse(vehicle, publicationsByVehicle.getOrDefault(vehicle.getId(), List.of()), integrationsByKey))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/public/stock/{companyIdentifier}")
    public ResponseEntity<PublicInventoryCatalogHttpResponse> getPublicInventory(@PathVariable String companyIdentifier) {
        var company = resolvePublicCompany(companyIdentifier);
        if (company == null) {
            return ResponseEntity.notFound().build();
        }

        UUID companyId = company.id();

        List<JpaIoAutoVehicleEntity> companyVehicles = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> publicationsByVehicle = groupPublicationsByVehicle(companyId, companyVehicles);

        List<JpaIoAutoVehicleEntity> publicVehicles = companyVehicles.stream()
                .filter(vehicle -> isVehiclePubliclyVisible(vehicle, publicationsByVehicle.getOrDefault(vehicle.getId(), List.of())))
                .toList();

        List<PublicInventoryVehicleHttpResponse> catalogVehicles = publicVehicles.stream()
                .map(this::toPublicVehicleResponse)
                .toList();

        return ResponseEntity.ok(new PublicInventoryCatalogHttpResponse(
                toPublicCompanySummary(company),
                buildResolvedPublicCatalogBanners(company, publicVehicles),
                catalogVehicles
        ));
    }

    @GetMapping("/public/stock/{companyIdentifier}/vehicles/{vehicleId}")
    public ResponseEntity<PublicVehicleDetailHttpResponse> getPublicVehicle(
            @PathVariable String companyIdentifier,
            @PathVariable UUID vehicleId
    ) {
        var company = resolvePublicCompany(companyIdentifier);
        if (company == null) {
            return ResponseEntity.notFound().build();
        }

        UUID companyId = company.id();

        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId).orElse(null);
        if (vehicle == null) {
            return ResponseEntity.notFound().build();
        }

        List<JpaIoAutoVehiclePublicationEntity> vehiclePublications = publications.findAllByCompanyIdAndVehicleId(companyId, vehicleId);
        if (!isVehiclePubliclyVisible(vehicle, vehiclePublications)) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(new PublicVehicleDetailHttpResponse(
                toPublicCompanySummary(company),
                toPublicVehicleResponse(vehicle)
        ));
    }

    @PostMapping("/public/stock/{companyId}/track")
    @Transactional
    public ResponseEntity<Void> trackPublicLeadEvent(
            @PathVariable UUID companyId,
            @Valid @RequestBody TrackPublicLeadEventHttpRequest request
    ) {
        var company = companies.findById(companyId).orElse(null);
        if (company == null) {
            return ResponseEntity.notFound().build();
        }

        String sourceReference = normalizeNullableText(request.sourceReference());
        if (sourceReference == null) {
            return ResponseEntity.noContent().build();
        }

        UUID trackedVehicleId = request.vehicleId();
        if (trackedVehicleId != null && vehicles.findByIdAndCompanyId(trackedVehicleId, companyId).isEmpty()) {
            trackedVehicleId = null;
        }

        JpaIoAutoPublicLeadEventEntity entity = new JpaIoAutoPublicLeadEventEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setVehicleId(trackedVehicleId);
        entity.setEventType(normalizePublicLeadEventType(request.eventType()));
        entity.setSourceType(normalizeText(request.sourceType(), "INFLUENCER").toUpperCase(Locale.ROOT));
        entity.setSourceReference(sourceReference);
        entity.setPagePath(trimToMaxLength(normalizeNullableText(request.pagePath()), 255));
        entity.setSourceUrl(normalizeNullableText(request.sourceUrl()));
        entity.setSessionId(trimToMaxLength(normalizeNullableText(request.sessionId()), 120));
        entity.setCreatedAt(Instant.now());
        publicLeadEvents.save(entity);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/public/stock/{companyId}/lead")
    @Transactional
    public ResponseEntity<Void> createPublicCatalogLead(
            @PathVariable UUID companyId,
            @Valid @RequestBody CreatePublicCatalogLeadHttpRequest request
    ) {
        var company = companies.findById(companyId).orElse(null);
        if (company == null) {
            return ResponseEntity.notFound().build();
        }

        UUID trackedVehicleId = request.vehicleId();
        if (trackedVehicleId != null && vehicles.findByIdAndCompanyId(trackedVehicleId, companyId).isEmpty()) {
            trackedVehicleId = null;
        }

        JpaIoAutoPublicCatalogLeadEntity entity = new JpaIoAutoPublicCatalogLeadEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setVehicleId(trackedVehicleId);
        entity.setCustomerName(trimToMaxLength(requireText(request.customerName(), "Informe o nome."), 160));
        entity.setCustomerPhone(normalizePublicCatalogLeadPhone(request.customerPhone()));
        entity.setSourceType(trimToMaxLength(normalizePublicCatalogLeadSourceType(request.sourceType()), 40));
        entity.setSourceReference(trimToMaxLength(normalizeNullableText(request.sourceReference()), 160));
        entity.setPagePath(trimToMaxLength(normalizeNullableText(request.pagePath()), 255));
        entity.setSourceUrl(normalizeNullableText(request.sourceUrl()));
        entity.setSessionId(trimToMaxLength(normalizeNullableText(request.sessionId()), 120));
        entity.setCreatedAt(Instant.now());
        publicCatalogLeads.save(entity);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ioauto/vehicles")
    @Transactional
    public ResponseEntity<IoAutoVehicleHttpResponse> createVehicle(@Valid @RequestBody SaveVehicleHttpRequest request) {
        return ResponseEntity.ok(saveVehicle(null, request));
    }

    @PutMapping("/ioauto/vehicles/{vehicleId}")
    @Transactional
    public ResponseEntity<IoAutoVehicleHttpResponse> updateVehicle(
            @PathVariable UUID vehicleId,
            @Valid @RequestBody SaveVehicleHttpRequest request
    ) {
        return ResponseEntity.ok(saveVehicle(vehicleId, request));
    }

    @GetMapping("/ioauto/integrations")
    @Transactional
    public ResponseEntity<List<IoAutoIntegrationHttpResponse>> listIntegrations() {
        UUID companyId = currentUser.companyId();
        List<IoAutoIntegrationHttpResponse> response = ensureDefaultIntegrations(companyId, Instant.now()).stream()
                .filter(entity -> isSupportedProvider(entity.getProviderKey()))
                .map(this::toIntegrationResponse)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/ioauto/integrations/{providerKey}")
    @Transactional
    public ResponseEntity<IoAutoIntegrationHttpResponse> updateIntegration(
            @PathVariable String providerKey,
            @Valid @RequestBody UpdateIntegrationHttpRequest request
    ) {
        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        String normalizedProviderKey = normalizeProviderKey(providerKey);
        if (!isSupportedProvider(normalizedProviderKey)) {
            throw new BusinessException("IOAUTO_INTEGRATION_UNSUPPORTED", "Esta integração não está mais disponível.");
        }

        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKey(companyId, normalizedProviderKey)
                .orElseGet(() -> {
                    JpaIoAutoIntegrationEntity created = new JpaIoAutoIntegrationEntity();
                    created.setId(UUID.randomUUID());
                    created.setCompanyId(companyId);
                    created.setProviderKey(normalizedProviderKey);
                    created.setCreatedAt(now);
                    return created;
                });

        entity.setDisplayName(normalizeText(request.displayName(), defaultIntegrationLabel(normalizedProviderKey)));
        entity.setStatus(normalizeText(request.status(), "CONFIGURATION_REQUIRED"));
        entity.setEndpointUrl(normalizeNullableText(request.endpointUrl()));
        entity.setAccountName(normalizeNullableText(request.accountName()));
        entity.setUsername(normalizeNullableText(request.username()));
        if (normalizeText(request.apiToken()).isBlank() == false) {
            entity.setApiToken(request.apiToken().trim());
        }
        if (normalizeText(request.webhookSecret()).isBlank() == false) {
            entity.setWebhookSecret(request.webhookSecret().trim());
        }
        entity.setLastError(normalizeNullableText(request.lastError()));
        entity.setSettingsJson(writeJsonObject(request.settings()));
        entity.setLastSyncAt(request.markSyncedNow() ? now : entity.getLastSyncAt());
        entity.setUpdatedAt(now);
        integrations.save(entity);

        return ResponseEntity.ok(toIntegrationResponse(entity));
    }

    @GetMapping("/ioauto/publications")
    public ResponseEntity<List<IoAutoPublicationHttpResponse>> listPublications() {
        UUID companyId = currentUser.companyId();
        Map<UUID, JpaIoAutoVehicleEntity> vehiclesById = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoVehicleEntity::getId, item -> item, (left, right) -> left, LinkedHashMap::new));
        Map<String, JpaIoAutoIntegrationEntity> integrationsByKey = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoIntegrationEntity::getProviderKey, item -> item, (left, right) -> left, LinkedHashMap::new));

        List<IoAutoPublicationHttpResponse> response = publications.findAllByCompanyIdOrderByUpdatedAtDesc(companyId).stream()
                .filter(publication -> isSupportedProvider(publication.getProviderKey()))
                .map(publication -> {
                    JpaIoAutoVehicleEntity vehicle = vehiclesById.get(publication.getVehicleId());
                    JpaIoAutoIntegrationEntity integration = integrationsByKey.get(publication.getProviderKey());
                    return new IoAutoPublicationHttpResponse(
                            publication.getId(),
                            publication.getVehicleId(),
                            vehicle == null ? "Veículo removido" : vehicle.getTitle(),
                            normalizeText(publication.getProviderKey()),
                            integration == null ? defaultIntegrationLabel(publication.getProviderKey()) : integration.getDisplayName(),
                            normalizeText(publication.getStatus(), "READY_TO_SYNC"),
                            normalizeNullableText(publication.getExternalUrl()),
                            normalizeNullableText(publication.getLastError()),
                            publication.getPublishedAt(),
                            publication.getUpdatedAt()
                    );
                })
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ioauto/public-lead-events/summary")
    public ResponseEntity<PublicLeadEventSummaryHttpResponse> getPublicLeadEventSummary() {
        UUID companyId = currentUser.companyId();
        List<JpaIoAutoPublicLeadEventEntity> events = publicLeadEvents.findAllByCompanyIdOrderByCreatedAtDesc(companyId);

        long trackedInteractions = events.size();
        long contactClicks = events.stream()
                .filter(event -> "CONTACT_CLICK".equalsIgnoreCase(event.getEventType()))
                .count();
        long interestClicks = events.stream()
                .filter(event -> "INTEREST_CLICK".equalsIgnoreCase(event.getEventType()))
                .count();

        Map<String, List<JpaIoAutoPublicLeadEventEntity>> bySource = new LinkedHashMap<>();
        for (JpaIoAutoPublicLeadEventEntity event : events) {
            String reference = normalizeNullableText(event.getSourceReference());
            if (reference == null) continue;

            String sourceType = normalizeText(event.getSourceType(), "INFLUENCER").toUpperCase(Locale.ROOT);
            String key = sourceType + "::" + reference;
            bySource.computeIfAbsent(key, ignored -> new ArrayList<>()).add(event);
        }

        List<PublicLeadEventSummaryHttpResponse.SourcePerformance> sources = bySource.entrySet().stream()
                .map(entry -> {
                    List<JpaIoAutoPublicLeadEventEntity> sourceEvents = entry.getValue();
                    JpaIoAutoPublicLeadEventEntity latest = sourceEvents.get(0);
                    long sourceContactClicks = sourceEvents.stream().filter(event -> "CONTACT_CLICK".equalsIgnoreCase(event.getEventType())).count();
                    long sourceInterestClicks = sourceEvents.stream().filter(event -> "INTEREST_CLICK".equalsIgnoreCase(event.getEventType())).count();
                    long vehicleClicks = sourceEvents.stream().filter(event -> event.getVehicleId() != null).count();
                    long stockClicks = sourceEvents.size() - vehicleClicks;

                    return new PublicLeadEventSummaryHttpResponse.SourcePerformance(
                            normalizeText(latest.getSourceType(), "INFLUENCER").toUpperCase(Locale.ROOT),
                            normalizeText(latest.getSourceReference()),
                            sourceEvents.size(),
                            stockClicks,
                            vehicleClicks,
                            sourceContactClicks,
                            sourceInterestClicks,
                            latest.getCreatedAt()
                    );
                })
                .sorted(Comparator.comparing(PublicLeadEventSummaryHttpResponse.SourcePerformance::totalInteractions).reversed()
                        .thenComparing(PublicLeadEventSummaryHttpResponse.SourcePerformance::lastEventAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(12)
                .toList();

        List<PublicLeadEventSummaryHttpResponse.RecentEvent> recentEvents = events.stream()
                .limit(15)
                .map(event -> new PublicLeadEventSummaryHttpResponse.RecentEvent(
                        normalizeText(event.getEventType()),
                        normalizeText(event.getSourceType(), "INFLUENCER").toUpperCase(Locale.ROOT),
                        normalizeNullableText(event.getSourceReference()),
                        event.getVehicleId(),
                        normalizeNullableText(event.getPagePath()),
                        event.getCreatedAt()
                ))
                .toList();

        return ResponseEntity.ok(new PublicLeadEventSummaryHttpResponse(
                trackedInteractions,
                contactClicks,
                interestClicks,
                sources,
                recentEvents
        ));
    }

    @GetMapping("/ioauto/public-catalog-leads")
    public ResponseEntity<PublicCatalogLeadListHttpResponse> listPublicCatalogLeads(
            @RequestParam(name = "preset", required = false) String preset,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to
    ) {
        UUID companyId = currentUser.companyId();
        PublicCatalogLeadPeriodSelection periodSelection = resolvePublicCatalogLeadPeriod(preset, from, to);

        List<JpaIoAutoPublicCatalogLeadEntity> leads = publicCatalogLeads
                .findAllByCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        companyId,
                        periodSelection.fromAt(),
                        periodSelection.toExclusiveAt()
                );

        Map<UUID, JpaIoAutoVehicleEntity> vehiclesById = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoVehicleEntity::getId, item -> item, (left, right) -> left, LinkedHashMap::new));

        long leadsWithVehicle = leads.stream().filter(lead -> lead.getVehicleId() != null).count();
        long leadsWithCampaign = leads.stream().filter(lead -> normalizeNullableText(lead.getSourceReference()) != null).count();

        LinkedHashSet<String> uniquePhones = new LinkedHashSet<>();
        for (JpaIoAutoPublicCatalogLeadEntity lead : leads) {
            uniquePhones.add(normalizeText(lead.getCustomerPhone()));
        }

        List<PublicCatalogLeadListHttpResponse.LeadItem> items = leads.stream()
                .map(lead -> {
                    JpaIoAutoVehicleEntity vehicle = lead.getVehicleId() == null ? null : vehiclesById.get(lead.getVehicleId());
                    return new PublicCatalogLeadListHttpResponse.LeadItem(
                            lead.getId(),
                            normalizeText(lead.getCustomerName()),
                            normalizeText(lead.getCustomerPhone()),
                            lead.getVehicleId(),
                            vehicle == null ? null : normalizeNullableText(vehicle.getTitle()),
                            normalizeNullableText(lead.getSourceType()),
                            normalizeNullableText(lead.getSourceReference()),
                            normalizeNullableText(lead.getPagePath()),
                            normalizeNullableText(lead.getSourceUrl()),
                            lead.getCreatedAt()
                    );
                })
                .toList();

        return ResponseEntity.ok(new PublicCatalogLeadListHttpResponse(
                periodSelection.preset(),
                periodSelection.fromDate(),
                periodSelection.toDate(),
                leads.size(),
                leadsWithVehicle,
                leadsWithCampaign,
                uniquePhones.size(),
                items
        ));
    }

    @GetMapping("/ioauto/public-links")
    public ResponseEntity<List<PublicLinkHttpResponse>> listPublicLinks() {
        UUID companyId = currentUser.companyId();
        var company = companies.findById(companyId).orElse(null);
        if (company == null) {
            return ResponseEntity.ok(List.of());
        }

        List<JpaIoAutoPublicLinkEntity> links = publicLinks.findAllByCompanyIdOrderByCreatedAtDesc(companyId);
        List<JpaIoAutoVehicleEntity> companyVehicles = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        Map<UUID, JpaIoAutoVehicleEntity> vehiclesById = companyVehicles.stream()
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoVehicleEntity::getId, item -> item, (left, right) -> left, LinkedHashMap::new));
        List<JpaIoAutoPublicLeadEventEntity> events = publicLeadEvents.findAllByCompanyIdOrderByCreatedAtDesc(companyId);

        List<PublicLinkHttpResponse> response = links.stream()
                .map(link -> toPublicLinkResponse(company, link, vehiclesById, events))
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/ioauto/public-catalog-settings")
    public ResponseEntity<PublicCatalogSettingsHttpResponse> getPublicCatalogSettings() {
        UUID companyId = currentUser.companyId();
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));
        return ResponseEntity.ok(toPublicCatalogSettingsResponse(company));
    }

    @PutMapping("/ioauto/public-catalog-settings")
    @Transactional
    public ResponseEntity<PublicCatalogSettingsHttpResponse> updatePublicCatalogSettings(
            @Valid @RequestBody SavePublicCatalogSettingsHttpRequest request
    ) {
        UUID companyId = currentUser.companyId();
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        String bannerMode = normalizePublicCatalogBannerMode(request.bannerMode());
        List<String> customImageUrls = sanitizePublicCatalogBannerImages(request.customImageUrls());

        var updated = new com.io.appioweb.domain.auth.entity.Company(
                company.id(),
                company.name(),
                company.profileImageUrl(),
                company.email(),
                company.contractEndDate(),
                company.cnpj(),
                company.openedAt(),
                company.whatsappNumber(),
                company.zapiInstanceId(),
                company.zapiInstanceToken(),
                company.zapiClientToken(),
                company.businessHoursStart(),
                company.businessHoursEnd(),
                company.businessHoursWeeklyJson(),
                bannerMode,
                writeStringArray(customImageUrls),
                company.createdAt()
        );
        companies.save(updated);

        return ResponseEntity.ok(toPublicCatalogSettingsResponse(updated));
    }

    @PostMapping("/ioauto/public-links")
    @Transactional
    public ResponseEntity<PublicLinkHttpResponse> createPublicLink(@Valid @RequestBody SavePublicLinkHttpRequest request) {
        UUID companyId = currentUser.companyId();
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        String linkKind = normalizePublicLinkKind(request.linkKind());
        String scopeType = normalizePublicLinkScope(request.scopeType());
        String sourceType = "PUBLIC".equals(linkKind) ? null : normalizePublicLinkSourceType(request.sourceType());
        String sourceReference = "PUBLIC".equals(linkKind) ? null : normalizePublicLinkSourceReference(request.sourceReference());

        UUID vehicleId = request.vehicleId();
        JpaIoAutoVehicleEntity vehicle = null;
        if ("VEHICLE".equals(scopeType)) {
            if (vehicleId == null) {
                throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Selecione um veiculo para este link.");
            }
            vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId)
                    .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veiculo nao encontrado."));
        }

        Instant now = Instant.now();
        JpaIoAutoPublicLinkEntity entity = new JpaIoAutoPublicLinkEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setVehicleId(vehicle == null ? null : vehicle.getId());
        entity.setName(requireText(request.name(), "Informe um nome para o link."));
        entity.setLinkKind(linkKind);
        entity.setScopeType(scopeType);
        entity.setSourceType(sourceType);
        entity.setSourceReference(sourceReference);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        publicLinks.save(entity);

        Map<UUID, JpaIoAutoVehicleEntity> vehiclesById = vehicle == null
                ? Map.of()
                : Map.of(vehicle.getId(), vehicle);
        return ResponseEntity.ok(toPublicLinkResponse(company, entity, vehiclesById, List.of()));
    }

    @DeleteMapping("/ioauto/public-links/{linkId}")
    @Transactional
    public ResponseEntity<Void> deletePublicLink(@PathVariable UUID linkId) {
        UUID companyId = currentUser.companyId();
        JpaIoAutoPublicLinkEntity entity = publicLinks.findByIdAndCompanyId(linkId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_PUBLIC_LINK_NOT_FOUND", "Link nao encontrado."));
        publicLinks.delete(entity);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ioauto/billing")
    public ResponseEntity<BillingSnapshot> getBilling() {
        return ResponseEntity.ok(billingService.getBillingSnapshot(currentUser.companyId()));
    }

    @PostMapping("/ioauto/billing/portal")
    public ResponseEntity<PortalLaunch> createBillingPortal() {
        return ResponseEntity.ok(billingService.createPortalSession(currentUser.companyId()));
    }

    private IoAutoVehicleHttpResponse saveVehicle(UUID vehicleId, SaveVehicleHttpRequest request) {
        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        JpaIoAutoVehicleEntity entity = vehicleId == null
                ? new JpaIoAutoVehicleEntity()
                : vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veículo não encontrado."));

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setCreatedAt(now);
        }

        entity.setStockNumber(normalizeNullableText(request.stockNumber()));
        entity.setTitle(requireText(request.title(), "Informe um título para o anúncio."));
        entity.setBrand(requireText(request.brand(), "Informe a marca do veículo."));
        entity.setModel(requireText(request.model(), "Informe o modelo do veículo."));
        String normalizedEngine = normalizeNullableText(request.engine());
        String normalizedVersion = normalizeNullableText(request.version());
        String normalizedState = normalizeNullableText(request.state());
        Integer resolvedYear = resolveVehicleYear(request.year(), request.modelYear(), request.manufactureYear());
        entity.setVersion(normalizedVersion != null ? normalizedVersion : normalizedEngine);
        entity.setEngine(normalizedEngine);
        entity.setModelYear(resolvedYear);
        entity.setManufactureYear(resolvedYear);
        entity.setPriceCents(request.priceCents());
        entity.setMileage(request.mileage());
        entity.setTransmission(normalizeNullableText(request.transmission()));
        entity.setFuelType(normalizeNullableText(request.fuelType()));
        entity.setBodyType(normalizeNullableText(request.bodyType()));
        entity.setColor(normalizeNullableText(request.color()));
        entity.setPlateFinal(normalizeNullableText(request.plateFinal()));
        entity.setPlate(normalizeNullableText(request.plate()));
        entity.setContactPhone(normalizeNullableText(request.contactPhone()));
        entity.setZipcode(normalizeNullableText(request.zipcode()));
        entity.setCity(normalizeNullableText(request.city()));
        entity.setState(normalizedState == null ? null : normalizedState.toUpperCase(Locale.ROOT));
        entity.setFeatured(Boolean.TRUE.equals(request.featured()));
        entity.setStatus(normalizeText(request.status(), "DRAFT"));
        entity.setDescription(normalizeNullableText(request.description()));
        entity.setCoverImageUrl(normalizeNullableText(request.coverImageUrl()));
        entity.setGalleryJson(writeStringArray(request.gallery()));
        entity.setOptionalsJson(writeStringArray(request.optionals()));
        entity.setFinancingJson(writeVehicleFinancing(request.financing()));
        
        entity.setMeliCategoryId(normalizeNullableText(request.meliCategoryId()));
        entity.setMeliListingTypeId(normalizeNullableText(request.meliListingTypeId()));
        entity.setMeliCondition(normalizeNullableText(request.meliCondition()));

        List<String> selectedIntegrations = sanitizeIntegrationKeys(request.targetIntegrations()).stream()
                .filter(this::supportsVehiclePublication)
                .toList();

        if (selectedIntegrations.contains("mercadolivre")) {
            if (entity.getMeliCategoryId() == null) {
                var suggestion = meliCategoryService.discoverVehicleCategory(entity.getTitle());
                if (suggestion != null && normalizeText(suggestion.categoryId()).isBlank() == false) {
                    entity.setMeliCategoryId(suggestion.categoryId());
                }
            }
            if (entity.getMeliListingTypeId() == null && entity.getMeliCategoryId() != null) {
                var listingTypes = meliListingTypeService.getAvailableListingTypes(companyId, entity.getMeliCategoryId());
                if (!listingTypes.isEmpty()) {
                    entity.setMeliListingTypeId(listingTypes.get(0).id());
                }
            }
        }

        entity.setUpdatedAt(now);
        vehicles.save(entity);

        List<JpaIoAutoVehiclePublicationEntity> existingPublications = publications.findAllByCompanyIdAndVehicleId(companyId, entity.getId());
        Map<String, JpaIoAutoVehiclePublicationEntity> existingByProvider = existingPublications.stream()
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoVehiclePublicationEntity::getProviderKey, item -> item, (left, right) -> left, LinkedHashMap::new));

        List<JpaIoAutoVehiclePublicationEntity> nextPublications = new ArrayList<>();
        for (String providerKey : selectedIntegrations) {
            JpaIoAutoIntegrationEntity integration = resolveOrCreateIntegration(companyId, providerKey, now);
            JpaIoAutoVehiclePublicationEntity publication = existingByProvider.getOrDefault(providerKey, new JpaIoAutoVehiclePublicationEntity());

            if (publication.getId() == null) {
                publication.setId(UUID.randomUUID());
                publication.setCompanyId(companyId);
                publication.setVehicleId(entity.getId());
                publication.setProviderKey(providerKey);
                publication.setCreatedAt(now);
            }

            boolean connectedIntegration = "CONNECTED".equalsIgnoreCase(integration.getStatus()) || "ACTIVE".equalsIgnoreCase(integration.getStatus());
            String currentPublicationStatus = normalizeText(publication.getStatus());
            if (connectedIntegration) {
                if (currentPublicationStatus.isBlank() || "WAITING_CONFIGURATION".equalsIgnoreCase(currentPublicationStatus)) {
                    publication.setStatus(determinePublicationStatus(integration));
                    publication.setLastError(null);
                }
            } else {
                publication.setStatus("WAITING_CONFIGURATION");
                publication.setLastError("Conclua a configuração desta integração para publicar.");
            }
            publication.setUpdatedAt(now);
            nextPublications.add(publication);
        }

        List<JpaIoAutoVehiclePublicationEntity> toRemove = existingPublications.stream()
                .filter(publication -> selectedIntegrations.contains(publication.getProviderKey()) == false)
                .toList();

        if (!toRemove.isEmpty()) {
            publications.deleteAll(toRemove);
        }
        if (!nextPublications.isEmpty()) {
            publications.saveAll(nextPublications);
        }

        if (!selectedIntegrations.isEmpty() && TransactionSynchronizationManager.isSynchronizationActive()) {
            UUID savedVehicleId = entity.getId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (String providerKey : selectedIntegrations) {
                        vehicleAutoPublicationService.publishAfterCommit(companyId, savedVehicleId, providerKey);
                    }
                }
            });
        }

        Map<String, JpaIoAutoIntegrationEntity> integrationsByKey = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .collect(java.util.stream.Collectors.toMap(JpaIoAutoIntegrationEntity::getProviderKey, item -> item, (left, right) -> left, LinkedHashMap::new));
        return toVehicleResponse(entity, publications.findAllByCompanyIdAndVehicleId(companyId, entity.getId()), integrationsByKey);
    }

    private Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> groupPublicationsByVehicle(UUID companyId, List<JpaIoAutoVehicleEntity> companyVehicles) {
        List<UUID> vehicleIds = companyVehicles.stream().map(JpaIoAutoVehicleEntity::getId).toList();
        if (vehicleIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> grouped = new LinkedHashMap<>();
        for (JpaIoAutoVehiclePublicationEntity publication : publications.findAllByCompanyIdAndVehicleIdIn(companyId, vehicleIds)) {
            grouped.computeIfAbsent(publication.getVehicleId(), ignored -> new ArrayList<>()).add(publication);
        }
        return grouped;
    }

    private IoAutoVehicleHttpResponse toVehicleResponse(
            JpaIoAutoVehicleEntity vehicle,
            List<JpaIoAutoVehiclePublicationEntity> vehiclePublications,
            Map<String, JpaIoAutoIntegrationEntity> integrationsByKey
    ) {
        List<IoAutoVehicleHttpResponse.PublicationSummary> publicationSummaries = vehiclePublications.stream()
                .filter(publication -> isSupportedProvider(publication.getProviderKey()))
                .sorted(Comparator.comparing(JpaIoAutoVehiclePublicationEntity::getProviderKey))
                .map(publication -> {
                    JpaIoAutoIntegrationEntity integration = integrationsByKey.get(publication.getProviderKey());
                    return new IoAutoVehicleHttpResponse.PublicationSummary(
                            publication.getId(),
                            publication.getProviderKey(),
                            integration == null ? defaultIntegrationLabel(publication.getProviderKey()) : integration.getDisplayName(),
                            normalizeText(publication.getStatus(), "READY_TO_SYNC"),
                            normalizeNullableText(publication.getExternalUrl())
                    );
                })
                .toList();

        return new IoAutoVehicleHttpResponse(
                vehicle.getId(),
                normalizeNullableText(vehicle.getStockNumber()),
                vehicle.getTitle(),
                vehicle.getBrand(),
                vehicle.getModel(),
                normalizeNullableText(vehicle.getVersion()),
                normalizeNullableText(vehicle.getEngine()),
                resolveVehicleYear(vehicle),
                vehicle.getModelYear(),
                vehicle.getManufactureYear(),
                vehicle.getPriceCents(),
                vehicle.getMileage(),
                normalizeNullableText(vehicle.getTransmission()),
                normalizeNullableText(vehicle.getFuelType()),
                normalizeNullableText(vehicle.getBodyType()),
                normalizeNullableText(vehicle.getColor()),
                normalizeNullableText(vehicle.getPlateFinal()),
                normalizeNullableText(vehicle.getPlate()),
                normalizeNullableText(vehicle.getContactPhone()),
                normalizeNullableText(vehicle.getZipcode()),
                normalizeNullableText(vehicle.getCity()),
                normalizeNullableText(vehicle.getState()),
                vehicle.isFeatured(),
                normalizeText(vehicle.getStatus(), "DRAFT"),
                normalizeNullableText(vehicle.getDescription()),
                normalizeNullableText(vehicle.getCoverImageUrl()),
                readStringArray(vehicle.getGalleryJson()),
                readStringArray(vehicle.getOptionalsJson()),
                readVehicleFinancing(vehicle.getFinancingJson()),
                normalizeNullableText(vehicle.getMeliCategoryId()),
                normalizeNullableText(vehicle.getMeliListingTypeId()),
                normalizeNullableText(vehicle.getMeliCondition()),
                publicationSummaries,
                vehicle.getUpdatedAt()
        );
    }

    private IoAutoIntegrationHttpResponse toIntegrationResponse(JpaIoAutoIntegrationEntity entity) {
        return new IoAutoIntegrationHttpResponse(
                normalizeText(entity.getProviderKey()),
                normalizeText(entity.getDisplayName(), defaultIntegrationLabel(entity.getProviderKey())),
                normalizeText(entity.getStatus(), "CONFIGURATION_REQUIRED"),
                normalizeNullableText(entity.getEndpointUrl()),
                normalizeNullableText(entity.getAccountName()),
                normalizeNullableText(entity.getUsername()),
                normalizeText(entity.getApiToken()).isBlank() == false,
                normalizeText(entity.getWebhookSecret()).isBlank() == false,
                supportsVehiclePublication(entity.getProviderKey()),
                entity.getLastSyncAt(),
                normalizeNullableText(entity.getLastError()),
                readObjectMap(entity.getSettingsJson())
        );
    }

    private PublicCompanySummary toPublicCompanySummary(com.io.appioweb.domain.auth.entity.Company company) {
        return new PublicCompanySummary(
                company.id(),
                normalizeText(company.name(), "Catalogo"),
                slugifyPublicPathSegment(company.name()),
                normalizeNullableText(company.profileImageUrl()),
                sanitizeWhatsappNumber(company.whatsappNumber())
        );
    }

    private PublicLinkHttpResponse toPublicLinkResponse(
            com.io.appioweb.domain.auth.entity.Company company,
            JpaIoAutoPublicLinkEntity link,
            Map<UUID, JpaIoAutoVehicleEntity> vehiclesById,
            List<JpaIoAutoPublicLeadEventEntity> events
    ) {
        JpaIoAutoVehicleEntity vehicle = link.getVehicleId() == null ? null : vehiclesById.get(link.getVehicleId());
        String sourceType = normalizeNullableText(link.getSourceType());
        String sourceReference = normalizeNullableText(link.getSourceReference());

        List<JpaIoAutoPublicLeadEventEntity> matchingEvents = events.stream()
                .filter(event -> normalizeText(event.getSourceType()).equalsIgnoreCase(normalizeText(sourceType)))
                .filter(event -> normalizeText(event.getSourceReference()).equalsIgnoreCase(normalizeText(sourceReference)))
                .toList();

        long totalInteractions = matchingEvents.size();
        long contactClicks = matchingEvents.stream()
                .filter(event -> "CONTACT_CLICK".equalsIgnoreCase(event.getEventType()))
                .count();
        long interestClicks = matchingEvents.stream()
                .filter(event -> "INTEREST_CLICK".equalsIgnoreCase(event.getEventType()))
                .count();
        Instant lastInteractionAt = matchingEvents.isEmpty() ? null : matchingEvents.get(0).getCreatedAt();

        return new PublicLinkHttpResponse(
                link.getId(),
                normalizeText(link.getName(), "Link publico"),
                normalizeText(link.getLinkKind(), "PUBLIC"),
                normalizeText(link.getScopeType(), "CATALOG"),
                sourceType,
                sourceReference,
                link.getVehicleId(),
                vehicle == null ? null : vehicle.getTitle(),
                buildPublicLinkPath(company, link),
                totalInteractions,
                contactClicks,
                interestClicks,
                lastInteractionAt,
                link.getCreatedAt(),
                link.getUpdatedAt()
        );
    }

    private PublicCatalogSettingsHttpResponse toPublicCatalogSettingsResponse(com.io.appioweb.domain.auth.entity.Company company) {
        return new PublicCatalogSettingsHttpResponse(
                normalizePublicCatalogBannerMode(company.publicStockBannerMode()),
                sanitizePublicCatalogBannerImages(readStringArray(company.publicStockBannerImagesJson()))
        );
    }

    private List<PublicCatalogBanner> buildResolvedPublicCatalogBanners(
            com.io.appioweb.domain.auth.entity.Company company,
            List<JpaIoAutoVehicleEntity> publicVehicles
    ) {
        if ("CUSTOM_IMAGES".equals(normalizePublicCatalogBannerMode(company.publicStockBannerMode()))) {
            List<PublicCatalogBanner> customBanners = buildCustomCatalogBanners(company);
            if (!customBanners.isEmpty()) {
                return customBanners;
            }
        }
        return buildVehicleCatalogBanners(publicVehicles);
    }

    private List<PublicCatalogBanner> buildVehicleCatalogBanners(List<JpaIoAutoVehicleEntity> publicVehicles) {
        return publicVehicles.stream()
                .sorted(Comparator.comparing(JpaIoAutoVehicleEntity::isFeatured).reversed()
                        .thenComparing(JpaIoAutoVehicleEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(vehicle -> new PublicCatalogBanner(
                        vehicle.getId().toString(),
                        "VEHICLE",
                        vehicle.getId(),
                        vehicle.getTitle(),
                        buildPublicVehicleSubtitle(vehicle),
                        resolveVehicleImage(vehicle),
                        vehicle.getPriceCents(),
                        normalizeNullableText(vehicle.getCity()),
                        normalizeNullableText(vehicle.getState()),
                        vehicle.getModelYear(),
                        vehicle.isFeatured()
                ))
                .toList();
    }

    private List<PublicCatalogBanner> buildCustomCatalogBanners(com.io.appioweb.domain.auth.entity.Company company) {
        List<String> images = sanitizePublicCatalogBannerImages(readStringArray(company.publicStockBannerImagesJson()));
        if (images.isEmpty()) {
            return List.of();
        }

        String companyName = normalizeText(company.name(), "Catalogo");
        return java.util.stream.IntStream.range(0, images.size())
                .mapToObj(index -> new PublicCatalogBanner(
                        "custom-image-" + (index + 1),
                        "CUSTOM_IMAGE",
                        null,
                        companyName,
                        "Confira os carros disponiveis e fale com a loja para receber mais detalhes.",
                        images.get(index),
                        null,
                        null,
                        null,
                        null,
                        true
                ))
                .toList();
    }

    private PublicInventoryVehicleHttpResponse toPublicVehicleResponse(JpaIoAutoVehicleEntity vehicle) {
        return new PublicInventoryVehicleHttpResponse(
                vehicle.getId(),
                normalizeNullableText(vehicle.getStockNumber()),
                vehicle.getTitle(),
                vehicle.getBrand(),
                vehicle.getModel(),
                normalizeNullableText(vehicle.getVersion()),
                normalizeNullableText(vehicle.getEngine()),
                resolveVehicleYear(vehicle),
                vehicle.getModelYear(),
                vehicle.getManufactureYear(),
                vehicle.getPriceCents(),
                vehicle.getMileage(),
                normalizeNullableText(vehicle.getTransmission()),
                normalizeNullableText(vehicle.getFuelType()),
                normalizeNullableText(vehicle.getBodyType()),
                normalizeNullableText(vehicle.getColor()),
                normalizeNullableText(vehicle.getPlateFinal()),
                normalizeNullableText(vehicle.getCity()),
                normalizeNullableText(vehicle.getState()),
                vehicle.isFeatured(),
                normalizeText(vehicle.getStatus(), "READY"),
                normalizeNullableText(vehicle.getDescription()),
                normalizeNullableText(vehicle.getCoverImageUrl()),
                readStringArray(vehicle.getGalleryJson()),
                readStringArray(vehicle.getOptionalsJson()),
                readVehicleFinancing(vehicle.getFinancingJson()),
                vehicle.getUpdatedAt()
        );
    }

    private String buildPublicVehicleSubtitle(JpaIoAutoVehicleEntity vehicle) {
        List<String> parts = new ArrayList<>();
        if (normalizeText(vehicle.getEngine()).isBlank() == false) parts.add(vehicle.getEngine().trim());
        if (parts.isEmpty() && normalizeText(vehicle.getVersion()).isBlank() == false) parts.add(vehicle.getVersion().trim());
        if (normalizeText(vehicle.getFuelType()).isBlank() == false) parts.add(vehicle.getFuelType().trim());
        if (normalizeText(vehicle.getTransmission()).isBlank() == false) parts.add(vehicle.getTransmission().trim());
        if (parts.isEmpty()) return "Veiculo disponivel no estoque";
        return String.join(" • ", parts);
    }

    private String resolveVehicleImage(JpaIoAutoVehicleEntity vehicle) {
        String coverImage = normalizeNullableText(vehicle.getCoverImageUrl());
        if (coverImage != null) return coverImage;

        List<String> gallery = readStringArray(vehicle.getGalleryJson());
        return gallery.isEmpty() ? null : gallery.get(0);
    }

    private JpaIoAutoIntegrationEntity resolveOrCreateIntegration(UUID companyId, String providerKey, Instant now) {
        String normalizedProviderKey = normalizeProviderKey(providerKey);
        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKey(companyId, normalizedProviderKey)
                .orElseGet(() -> {
                    JpaIoAutoIntegrationEntity created = new JpaIoAutoIntegrationEntity();
                    created.setId(UUID.randomUUID());
                    created.setCompanyId(companyId);
                    created.setProviderKey(normalizedProviderKey);
                    created.setCreatedAt(now);
                    return created;
                });

        boolean changed = false;
        if (normalizeText(entity.getDisplayName()).isBlank()) {
            entity.setDisplayName(defaultIntegrationLabel(normalizedProviderKey));
            changed = true;
        }
        if (normalizeText(entity.getStatus()).isBlank()) {
            entity.setStatus("CONFIGURATION_REQUIRED");
            changed = true;
        }
        if (normalizeText(entity.getSettingsJson()).isBlank()) {
            entity.setSettingsJson("{}");
            changed = true;
        }
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(now);
            changed = true;
        }
        if (entity.getUpdatedAt() == null) {
            entity.setUpdatedAt(now);
            changed = true;
        }

        return changed ? integrations.save(entity) : entity;
    }

    private List<JpaIoAutoIntegrationEntity> ensureDefaultIntegrations(UUID companyId, Instant now) {
        for (String providerKey : DEFAULT_INTEGRATION_PROVIDER_KEYS) {
            resolveOrCreateIntegration(companyId, providerKey, now);
        }
        return integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId);
    }

    private String determinePublicationStatus(JpaIoAutoIntegrationEntity integration) {
        return "CONNECTED".equalsIgnoreCase(integration.getStatus()) || "ACTIVE".equalsIgnoreCase(integration.getStatus())
                ? "READY_TO_SYNC"
                : "WAITING_CONFIGURATION";
    }

    private Integer resolveVehicleYear(Integer year, Integer modelYear, Integer manufactureYear) {
        if (year != null) return year;
        if (modelYear != null) return modelYear;
        return manufactureYear;
    }

    private Integer resolveVehicleYear(JpaIoAutoVehicleEntity vehicle) {
        return resolveVehicleYear(null, vehicle.getModelYear(), vehicle.getManufactureYear());
    }

    private List<String> sanitizeIntegrationKeys(List<String> values) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values == null ? List.<String>of() : values) {
            String normalized = normalizeProviderKey(value);
            if (normalized.isBlank()) continue;
            unique.add(normalized);
        }
        return List.copyOf(unique);
    }

    private String normalizeProviderKey(String value) {
        return normalizeText(value)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9-]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
    }

    private String normalizePublicCatalogBannerMode(String value) {
        String normalized = normalizeText(value, "VEHICLES").toUpperCase(Locale.ROOT);
        if ("VEHICLES".equals(normalized) || "CUSTOM_IMAGES".equals(normalized)) {
            return normalized;
        }
        throw new BusinessException("IOAUTO_PUBLIC_CATALOG_INVALID_MODE", "Modo de banner invalido.");
    }

    private List<String> sanitizePublicCatalogBannerImages(List<String> values) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values == null ? List.<String>of() : values) {
            String normalized = normalizeText(value);
            if (normalized.isBlank()) continue;
            if (!isSupportedPublicCatalogBannerImage(normalized)) {
                throw new BusinessException("IOAUTO_PUBLIC_CATALOG_INVALID_IMAGE", "Uma das imagens do banner e invalida.");
            }
            if (normalized.length() > MAX_PUBLIC_CATALOG_IMAGE_LENGTH) {
                throw new BusinessException("IOAUTO_PUBLIC_CATALOG_IMAGE_TOO_LARGE", "Uma das imagens do banner excede o tamanho permitido.");
            }
            unique.add(normalized);
            if (unique.size() > MAX_PUBLIC_CATALOG_BANNER_IMAGES) {
                throw new BusinessException("IOAUTO_PUBLIC_CATALOG_IMAGE_LIMIT", "Voce pode salvar ate " + MAX_PUBLIC_CATALOG_BANNER_IMAGES + " imagens no banner.");
            }
        }
        return List.copyOf(unique);
    }

    private boolean isSupportedPublicCatalogBannerImage(String value) {
        String normalized = normalizeText(value).toLowerCase(Locale.ROOT);
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return true;
        }
        return normalized.startsWith("data:image/png;base64,")
                || normalized.startsWith("data:image/jpeg;base64,")
                || normalized.startsWith("data:image/jpg;base64,")
                || normalized.startsWith("data:image/webp;base64,")
                || normalized.startsWith("data:image/gif;base64,")
                || normalized.startsWith("data:image/avif;base64,");
    }

    private String writeStringArray(List<String> values) {
        try {
            List<String> normalized = (values == null ? List.<String>of() : values).stream()
                    .map(this::normalizeText)
                    .filter(item -> item.isBlank() == false)
                    .distinct()
                    .toList();
            return OBJECT_MAPPER.writeValueAsString(normalized);
        } catch (Exception exception) {
            throw new BusinessException("IOAUTO_JSON_SERIALIZATION_FAILED", "Não foi possível salvar os dados do cadastro.");
        }
    }

    private List<String> readStringArray(String raw) {
        try {
            String normalized = normalizeText(raw, "[]");
            return OBJECT_MAPPER.readValue(normalized, new TypeReference<List<String>>() {
            });
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeVehicleFinancing(VehicleFinancingHttpRequest financing) {
        try {
            VehicleFinancingHttpResponse normalized = sanitizeVehicleFinancing(
                    financing == null ? null : financing.downPaymentCents(),
                    financing == null ? null : financing.installmentCount(),
                    financing == null ? null : financing.installmentValueCents()
            );
            return OBJECT_MAPPER.writeValueAsString(normalized);
        } catch (Exception exception) {
            throw new BusinessException("IOAUTO_FINANCING_SERIALIZATION_FAILED", "NÃ£o foi possÃ­vel salvar as condiÃ§Ãµes de financiamento.");
        }
    }

    private VehicleFinancingHttpResponse readVehicleFinancing(String raw) {
        try {
            VehicleFinancingHttpResponse financing = OBJECT_MAPPER.readValue(normalizeText(raw, "{}"), VehicleFinancingHttpResponse.class);
            return sanitizeVehicleFinancing(financing.downPaymentCents(), financing.installmentCount(), financing.installmentValueCents());
        } catch (Exception ignored) {
            return sanitizeVehicleFinancing(null, null, null);
        }
    }

    private VehicleFinancingHttpResponse sanitizeVehicleFinancing(Long downPaymentCents, Integer installmentCount, Long installmentValueCents) {
        Long normalizedDownPayment = normalizeNonNegativeLong(downPaymentCents);
        Integer normalizedInstallments = normalizePositiveInteger(installmentCount);
        Long normalizedInstallmentValue = normalizeNonNegativeLong(installmentValueCents);
        if (normalizedInstallments == null || normalizedInstallmentValue == null) {
            normalizedInstallments = null;
            normalizedInstallmentValue = null;
        }
        return new VehicleFinancingHttpResponse(normalizedDownPayment, normalizedInstallments, normalizedInstallmentValue);
    }

    private String writeJsonObject(Map<String, String> values) {
        try {
            Map<String, String> normalized = new LinkedHashMap<>();
            for (Map.Entry<String, String> entry : (values == null ? Map.<String, String>of() : values).entrySet()) {
                String key = normalizeText(entry.getKey());
                if (key.isBlank()) continue;
                normalized.put(key, normalizeText(entry.getValue()));
            }
            return OBJECT_MAPPER.writeValueAsString(normalized);
        } catch (Exception exception) {
            throw new BusinessException("IOAUTO_SETTINGS_SERIALIZATION_FAILED", "Não foi possível salvar as configurações da integração.");
        }
    }

    private Map<String, String> readObjectMap(String raw) {
        try {
            return OBJECT_MAPPER.readValue(normalizeText(raw, "{}"), new TypeReference<Map<String, String>>() {
            });
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private DashboardPeriodSelection resolveDashboardPeriod(String preset, String from, String to) {
        LocalDate today = LocalDate.now(DASHBOARD_ZONE);
        String normalizedPreset = normalizeText(preset, "30d").toLowerCase(Locale.ROOT);

        LocalDate resolvedFrom;
        LocalDate resolvedTo;

        switch (normalizedPreset) {
            case "7d" -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(6);
            }
            case "90d" -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(89);
            }
            case "month" -> {
                resolvedTo = today;
                resolvedFrom = today.withDayOfMonth(1);
            }
            case "custom" -> {
                resolvedFrom = parseDashboardDate(from, today.minusDays(29));
                resolvedTo = parseDashboardDate(to, today);
            }
            case "30d" -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(29);
            }
            default -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(29);
                normalizedPreset = "30d";
            }
        }

        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new BusinessException("IOAUTO_DASHBOARD_INVALID_PERIOD", "O período informado para o dashboard é inválido.");
        }

        if (resolvedFrom.isBefore(resolvedTo.minusDays(365))) {
            resolvedFrom = resolvedTo.minusDays(365);
        }

        return new DashboardPeriodSelection(
                normalizedPreset,
                resolvedFrom,
                resolvedTo,
                resolvedFrom.atStartOfDay(DASHBOARD_ZONE).toInstant(),
                resolvedTo.plusDays(1).atStartOfDay(DASHBOARD_ZONE).toInstant()
        );
    }

    private PublicCatalogLeadPeriodSelection resolvePublicCatalogLeadPeriod(String preset, String from, String to) {
        LocalDate today = LocalDate.now(DASHBOARD_ZONE);
        String normalizedPreset = normalizeText(preset, "LAST_30_DAYS").toUpperCase(Locale.ROOT);

        LocalDate resolvedFrom;
        LocalDate resolvedTo;

        switch (normalizedPreset) {
            case "LAST_7_DAYS" -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(6);
            }
            case "LAST_MONTH" -> {
                YearMonth lastMonth = YearMonth.from(today.minusMonths(1));
                resolvedFrom = lastMonth.atDay(1);
                resolvedTo = lastMonth.atEndOfMonth();
            }
            case "CUSTOM" -> {
                resolvedFrom = parsePublicCatalogLeadDate(from, today.minusDays(29));
                resolvedTo = parsePublicCatalogLeadDate(to, today);
            }
            case "LAST_30_DAYS" -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(29);
            }
            default -> {
                resolvedTo = today;
                resolvedFrom = today.minusDays(29);
                normalizedPreset = "LAST_30_DAYS";
            }
        }

        if (resolvedFrom.isAfter(resolvedTo)) {
            LocalDate swap = resolvedFrom;
            resolvedFrom = resolvedTo;
            resolvedTo = swap;
        }

        return new PublicCatalogLeadPeriodSelection(
                normalizedPreset,
                resolvedFrom,
                resolvedTo,
                resolvedFrom.atStartOfDay(DASHBOARD_ZONE).toInstant(),
                resolvedTo.plusDays(1).atStartOfDay(DASHBOARD_ZONE).toInstant()
        );
    }

    private LocalDate parseDashboardDate(String raw, LocalDate fallback) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) {
            return fallback;
        }
        try {
            return LocalDate.parse(normalized, DATE_FORMATTER);
        } catch (Exception exception) {
            throw new BusinessException("IOAUTO_DASHBOARD_INVALID_DATE", "Não foi possível interpretar uma das datas do dashboard.");
        }
    }

    private LocalDate parsePublicCatalogLeadDate(String raw, LocalDate fallback) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) {
            return fallback;
        }
        try {
            return LocalDate.parse(normalized, DATE_FORMATTER);
        } catch (Exception exception) {
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEADS_INVALID_DATE", "NÃ£o foi possÃ­vel interpretar uma das datas dos leads.");
        }
    }

    private List<IoAutoDashboardHttpResponse.PeriodPoint> buildLeadVsSalesSeries(
            DashboardPeriodSelection periodSelection,
            List<JpaAtendimentoSessionEntity> leadSessions,
            List<JpaAtendimentoSessionEntity> salesSessions
    ) {
        Map<LocalDate, Long> leadsByDate = new LinkedHashMap<>();
        Map<LocalDate, Long> salesByDate = new LinkedHashMap<>();

        for (JpaAtendimentoSessionEntity session : leadSessions) {
            LocalDate bucket = session.getArrivedAt().atZone(DASHBOARD_ZONE).toLocalDate();
            leadsByDate.put(bucket, leadsByDate.getOrDefault(bucket, 0L) + 1L);
        }

        for (JpaAtendimentoSessionEntity session : salesSessions) {
            if (session.getSaleCompletedAt() == null) continue;
            LocalDate bucket = session.getSaleCompletedAt().atZone(DASHBOARD_ZONE).toLocalDate();
            salesByDate.put(bucket, salesByDate.getOrDefault(bucket, 0L) + 1L);
        }

        List<IoAutoDashboardHttpResponse.PeriodPoint> points = new ArrayList<>();
        LocalDate cursor = periodSelection.fromDate();
        while (cursor.isAfter(periodSelection.toDate()) == false) {
            points.add(new IoAutoDashboardHttpResponse.PeriodPoint(
                    DATE_FORMATTER.format(cursor),
                    cursor.format(DateTimeFormatter.ofPattern("dd/MM")),
                    leadsByDate.getOrDefault(cursor, 0L),
                    salesByDate.getOrDefault(cursor, 0L)
            ));
            cursor = cursor.plusDays(1);
        }
        return points;
    }

    private List<IoAutoDashboardHttpResponse.SellerSalesSummary> buildSalesBySeller(List<JpaAtendimentoSessionEntity> salesSessions) {
        Map<String, Long> totalsBySeller = new LinkedHashMap<>();
        Map<String, String> idsBySeller = new LinkedHashMap<>();

        for (JpaAtendimentoSessionEntity session : salesSessions) {
            String sellerName = normalizeText(session.getResponsibleUserName(), "Sem vendedor");
            String sellerKey = session.getResponsibleUserId() == null ? "unassigned" : session.getResponsibleUserId().toString();
            totalsBySeller.put(sellerKey, totalsBySeller.getOrDefault(sellerKey, 0L) + 1L);
            idsBySeller.put(sellerKey, sellerName);
        }

        return totalsBySeller.entrySet().stream()
                .map(entry -> new IoAutoDashboardHttpResponse.SellerSalesSummary(
                        "unassigned".equals(entry.getKey()) ? null : UUID.fromString(entry.getKey()),
                        idsBySeller.getOrDefault(entry.getKey(), "Sem vendedor"),
                        entry.getValue()
                ))
                .sorted(Comparator.comparing(IoAutoDashboardHttpResponse.SellerSalesSummary::totalSales).reversed()
                        .thenComparing(IoAutoDashboardHttpResponse.SellerSalesSummary::sellerName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private String sourceLabel(String key) {
        return switch (key) {
            case "WEBMOTORS" -> "WebMotors";
            case "MERCADOLIVRE" -> "Mercado Livre";
            default -> "Outra origem";
        };
    }

    private boolean supportsVehiclePublication(String providerKey) {
        return isSupportedProvider(providerKey);
    }

    private boolean isActivePublicationStatus(String status) {
        String normalized = normalizeText(status).toUpperCase(Locale.ROOT);
        return !"REMOVED".equals(normalized) && !"SOLD".equals(normalized) && !"ARCHIVED".equals(normalized);
    }

    private boolean isVehiclePubliclyVisible(
            JpaIoAutoVehicleEntity vehicle,
            List<JpaIoAutoVehiclePublicationEntity> vehiclePublications
    ) {
        String vehicleStatus = normalizeText(vehicle.getStatus(), "DRAFT").toUpperCase(Locale.ROOT);
        if ("DRAFT".equals(vehicleStatus) || "ARCHIVED".equals(vehicleStatus) || "SOLD".equals(vehicleStatus)) {
            return false;
        }

        return vehiclePublications.stream()
                .map(JpaIoAutoVehiclePublicationEntity::getStatus)
                .map(this::normalizeText)
                .map(status -> status.toUpperCase(Locale.ROOT))
                .noneMatch("SOLD"::equals);
    }

    private String sanitizeWhatsappNumber(String raw) {
        String digits = normalizeText(raw).replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private com.io.appioweb.domain.auth.entity.Company resolvePublicCompany(String identifier) {
        String normalized = normalizeText(identifier);
        if (normalized.isBlank()) {
            return null;
        }

        try {
            return companies.findById(UUID.fromString(normalized)).orElse(null);
        } catch (IllegalArgumentException ignored) {
            return companies.findAll().stream()
                    .filter(company -> slugifyPublicPathSegment(company.name()).equalsIgnoreCase(normalized))
                    .findFirst()
                    .orElse(null);
        }
    }

    private String buildPublicLinkPath(com.io.appioweb.domain.auth.entity.Company company, JpaIoAutoPublicLinkEntity link) {
        String basePath = "/estoque-publico/" + slugifyPublicPathSegment(company.name());
        if ("VEHICLE".equalsIgnoreCase(normalizeText(link.getScopeType())) && link.getVehicleId() != null) {
            basePath += "/veiculo/" + link.getVehicleId();
        }

        String sourceReference = normalizeNullableText(link.getSourceReference());
        if (sourceReference == null) {
            return basePath;
        }

        String sourceType = normalizeText(link.getSourceType(), "INFLUENCER").toLowerCase(Locale.ROOT);
        return basePath
                + "?source=" + URLEncoder.encode(sourceType, StandardCharsets.UTF_8)
                + "&ref=" + URLEncoder.encode(sourceReference, StandardCharsets.UTF_8);
    }

    private String normalizePublicLinkKind(String raw) {
        String normalized = normalizeText(raw, "PUBLIC").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PUBLIC", "CAMPAIGN" -> normalized;
            default -> throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Tipo de link invalido.");
        };
    }

    private String normalizePublicLinkScope(String raw) {
        String normalized = normalizeText(raw, "CATALOG").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CATALOG", "VEHICLE" -> normalized;
            default -> throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Escopo do link invalido.");
        };
    }

    private String normalizePublicLinkSourceType(String raw) {
        String normalized = normalizeText(raw, "INFLUENCER").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "INFLUENCER", "CAMPAIGN" -> normalized;
            default -> throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Origem do link invalida.");
        };
    }

    private String normalizePublicLinkSourceReference(String raw) {
        String slug = slugifyPublicPathSegment(requireText(raw, "Informe o identificador da campanha."));
        if (slug.isBlank()) {
            throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Nao foi possivel gerar o identificador do link.");
        }
        return trimToMaxLength(slug, 160);
    }

    private String slugifyPublicPathSegment(String raw) {
        String normalized = normalizeText(raw)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", "-")
                .replaceAll("^-+|-+$", "");

        String ascii = java.text.Normalizer.normalize(normalized, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^a-z0-9-]", "")
                .replaceAll("-{2,}", "-");

        return ascii.isBlank() ? "catalogo" : ascii;
    }

    private String normalizePublicLeadEventType(String raw) {
        String normalized = normalizeText(raw, "CONTACT_CLICK").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CATALOG_VIEW", "VEHICLE_VIEW", "CONTACT_CLICK", "INTEREST_CLICK" -> normalized;
            default -> "CONTACT_CLICK";
        };
    }

    private String normalizePublicCatalogLeadSourceType(String raw) {
        return normalizeText(raw, "DIRECT").toUpperCase(Locale.ROOT);
    }

    private String normalizePublicCatalogLeadPhone(String raw) {
        String digits = normalizeText(raw).replaceAll("\\D", "");
        if (digits.length() < 10 || digits.length() > 11) {
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEAD_INVALID_PHONE", "Informe um telefone valido com DDD.");
        }
        return digits;
    }

    private String normalizeSourcePlatform(String value) {
        return normalizeText(value, "OTHER").toUpperCase(Locale.ROOT);
    }

    private String requireText(String value, String message) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            throw new BusinessException("IOAUTO_INVALID_PAYLOAD", message);
        }
        return normalized;
    }

    private String normalizeNullableText(String value) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String trimToMaxLength(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private Long normalizeNonNegativeLong(Long value) {
        if (value == null || value < 0) return null;
        return value;
    }

    private Integer normalizePositiveInteger(Integer value) {
        if (value == null || value <= 0) return null;
        return value;
    }

    private String defaultIntegrationLabel(String providerKey) {
        String normalized = normalizeProviderKey(providerKey);
        return switch (normalized) {
            case "webmotors" -> "Webmotors / Estoque e Leads";
            case "olx", "olx-autos" -> "OLX";
            case "mercadolivre" -> "Mercado Livre";
            case "icarros" -> "iCarros";
            default -> normalized.isBlank() ? "Integração" : normalized.substring(0, 1).toUpperCase(Locale.ROOT) + normalized.substring(1);
        };
    }

    private boolean isSupportedProvider(String providerKey) {
        return "zapi".equalsIgnoreCase(normalizeProviderKey(providerKey)) == false;
    }

    private boolean isSupportedLeadSource(String sourcePlatform) {
        String normalized = normalizeSourcePlatform(sourcePlatform);
        return !"ZAPI".equals(normalized) && !"WHATSAPP".equals(normalized);
    }

    private record DashboardPeriodSelection(
            String preset,
            LocalDate fromDate,
            LocalDate toDate,
            Instant fromAt,
            Instant toExclusiveAt
    ) {
    }

    private record PublicCatalogLeadPeriodSelection(
            String preset,
            LocalDate fromDate,
            LocalDate toDate,
            Instant fromAt,
            Instant toExclusiveAt
    ) {
    }

    public record IoAutoDashboardHttpResponse(
            String companyName,
            long vehicleCount,
            long featuredCount,
            long publicationCount,
            long leadCount,
            long connectedIntegrations,
            long inventoryValueCents,
            long totalSalesCount,
            long totalSalesRevenueCents,
            BillingSnapshot billing,
            PeriodFilter periodFilter,
            List<PeriodPoint> leadVsSales,
            List<SellerSalesSummary> salesBySeller,
            List<SourceSummary> leadSources,
            List<RecentVehicle> recentVehicles,
            List<RecentConversation> recentConversations
    ) {
        public record PeriodFilter(String preset, String from, String to) {
        }

        public record PeriodPoint(String date, String label, long leads, long sales) {
        }

        public record SellerSalesSummary(UUID sellerId, String sellerName, long totalSales) {
        }

        public record SourceSummary(String key, String label, long total) {
        }

        public record RecentVehicle(
                UUID id,
                String title,
                Long priceCents,
                String status,
                Instant updatedAt,
                int publicationCount
        ) {
        }

        public record RecentConversation(
                UUID id,
                String contactName,
                String lastMessage,
                Instant lastAt,
                String sourcePlatform
        ) {
        }
    }

    public record IoAutoVehicleHttpResponse(
            UUID id,
            String stockNumber,
            String title,
            String brand,
            String model,
            String version,
            String engine,
            Integer year,
            Integer modelYear,
            Integer manufactureYear,
            Long priceCents,
            Integer mileage,
            String transmission,
            String fuelType,
            String bodyType,
            String color,
            String plateFinal,
            String plate,
            String contactPhone,
            String zipcode,
            String city,
            String state,
            boolean featured,
            String status,
            String description,
            String coverImageUrl,
            List<String> gallery,
            List<String> optionals,
            VehicleFinancingHttpResponse financing,
            String meliCategoryId,
            String meliListingTypeId,
            String meliCondition,
            List<PublicationSummary> publications,
            Instant updatedAt
    ) {
        public record PublicationSummary(
                UUID id,
                String providerKey,
                String providerName,
                String status,
                String externalUrl
        ) {
        }
    }

    public record PublicInventoryCatalogHttpResponse(
            PublicCompanySummary company,
            List<PublicCatalogBanner> banners,
            List<PublicInventoryVehicleHttpResponse> vehicles
    ) {
    }

    public record PublicVehicleDetailHttpResponse(
            PublicCompanySummary company,
            PublicInventoryVehicleHttpResponse vehicle
    ) {
    }

    public record PublicCompanySummary(
            UUID id,
            String name,
            String publicSlug,
            String profileImageUrl,
            String whatsappNumber
    ) {
    }

    public record PublicCatalogBanner(
            String id,
            String kind,
            UUID vehicleId,
            String title,
            String subtitle,
            String imageUrl,
            Long priceCents,
            String city,
            String state,
            Integer modelYear,
            boolean featured
    ) {
    }

    public record PublicInventoryVehicleHttpResponse(
            UUID id,
            String stockNumber,
            String title,
            String brand,
            String model,
            String version,
            String engine,
            Integer year,
            Integer modelYear,
            Integer manufactureYear,
            Long priceCents,
            Integer mileage,
            String transmission,
            String fuelType,
            String bodyType,
            String color,
            String plateFinal,
            String city,
            String state,
            boolean featured,
            String status,
            String description,
            String coverImageUrl,
            List<String> gallery,
            List<String> optionals,
            VehicleFinancingHttpResponse financing,
            Instant updatedAt
    ) {
    }

    public record PublicLeadEventSummaryHttpResponse(
            long totalTrackedInteractions,
            long totalContactClicks,
            long totalInterestClicks,
            List<SourcePerformance> sources,
            List<RecentEvent> recentEvents
    ) {
        public record SourcePerformance(
                String sourceType,
                String sourceReference,
                long totalInteractions,
                long stockInteractions,
                long vehicleInteractions,
                long contactClicks,
                long interestClicks,
                Instant lastEventAt
        ) {
        }

        public record RecentEvent(
                String eventType,
                String sourceType,
                String sourceReference,
                UUID vehicleId,
                String pagePath,
                Instant createdAt
            ) {
        }
    }

    public record PublicCatalogLeadListHttpResponse(
            String preset,
            LocalDate fromDate,
            LocalDate toDate,
            long totalLeads,
            long leadsWithVehicle,
            long leadsWithCampaign,
            long uniquePhones,
            List<LeadItem> leads
    ) {
        public record LeadItem(
                UUID id,
                String customerName,
                String customerPhone,
                UUID vehicleId,
                String vehicleTitle,
                String sourceType,
                String sourceReference,
                String pagePath,
                String sourceUrl,
                Instant createdAt
        ) {
        }
    }

    public record PublicLinkHttpResponse(
            UUID id,
            String name,
            String linkKind,
            String scopeType,
            String sourceType,
            String sourceReference,
            UUID vehicleId,
            String vehicleTitle,
            String publicPath,
            long totalInteractions,
            long contactClicks,
            long interestClicks,
            Instant lastInteractionAt,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record PublicCatalogSettingsHttpResponse(
            String bannerMode,
            List<String> customImageUrls
    ) {
    }

    public record IoAutoIntegrationHttpResponse(
            String providerKey,
            String displayName,
            String status,
            String endpointUrl,
            String accountName,
            String username,
            boolean hasApiToken,
            boolean hasWebhookSecret,
            boolean supportsPublication,
            Instant lastSyncAt,
            String lastError,
            Map<String, String> settings
    ) {
    }

    public record IoAutoPublicationHttpResponse(
            UUID id,
            UUID vehicleId,
            String vehicleTitle,
            String providerKey,
            String providerName,
            String status,
            String externalUrl,
            String lastError,
            Instant publishedAt,
            Instant updatedAt
    ) {
    }

    public record SaveVehicleHttpRequest(
            String stockNumber,
            @NotBlank(message = "Informe um título.") String title,
            @NotBlank(message = "Informe a marca.") String brand,
            @NotBlank(message = "Informe o modelo.") String model,
            String version,
            String engine,
            Integer year,
            Integer modelYear,
            Integer manufactureYear,
            Long priceCents,
            Integer mileage,
            String transmission,
            String fuelType,
            String bodyType,
            String color,
            String plateFinal,
            String plate,
            String contactPhone,
            String zipcode,
            String city,
            String state,
            Boolean featured,
            String status,
            String description,
            String coverImageUrl,
            List<String> gallery,
            List<String> optionals,
            VehicleFinancingHttpRequest financing,
            List<String> targetIntegrations,
            String meliCategoryId,
            String meliListingTypeId,
            String meliCondition
    ) {
    }

    public record VehicleFinancingHttpRequest(
            Long downPaymentCents,
            Integer installmentCount,
            Long installmentValueCents
    ) {
    }

    public record VehicleFinancingHttpResponse(
            Long downPaymentCents,
            Integer installmentCount,
            Long installmentValueCents
    ) {
    }

    public record TrackPublicLeadEventHttpRequest(
            UUID vehicleId,
            String eventType,
            String sourceType,
            String sourceReference,
            String pagePath,
            String sourceUrl,
            String sessionId
    ) {
    }

    public record CreatePublicCatalogLeadHttpRequest(
            UUID vehicleId,
            @NotBlank(message = "Informe o nome.") String customerName,
            @NotBlank(message = "Informe o telefone.") String customerPhone,
            String sourceType,
            String sourceReference,
            String pagePath,
            String sourceUrl,
            String sessionId
    ) {
    }

    public record SavePublicLinkHttpRequest(
            @NotBlank(message = "Informe um nome para o link.") String name,
            String linkKind,
            String scopeType,
            UUID vehicleId,
            String sourceType,
            String sourceReference
    ) {
    }

    public record SavePublicCatalogSettingsHttpRequest(
            String bannerMode,
            List<String> customImageUrls
    ) {
    }

    public record UpdateIntegrationHttpRequest(
            String displayName,
            String status,
            String endpointUrl,
            String accountName,
            String username,
            String apiToken,
            String webhookSecret,
            String lastError,
            Map<String, String> settings,
            boolean markSyncedNow
    ) {
    }
}
