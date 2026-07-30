package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoConversationEntity;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.crm.CrmCompanyStateRepositoryJpa;
import com.io.appioweb.adapters.persistence.crm.JpaCrmCompanyStateEntity;
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
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.application.ioauto.VehicleAutoPublicationService;
import com.io.appioweb.application.superadmin.FeatureUsageService;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.realtime.RealtimeGateway;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
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

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
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
    private static final Map<String, String> VEHICLE_TRANSMISSION_OPTIONS = Map.ofEntries(
            Map.entry("automatica", "Automatica"),
            Map.entry("automatico", "Automatica"),
            Map.entry("cvt", "Automatica"),
            Map.entry("manual", "Manual"),
            Map.entry("semiautomatica", "Semiautomatica"),
            Map.entry("semiautomatico", "Semiautomatica"),
            Map.entry("automaticasequencial", "Automatica sequencial"),
            Map.entry("automaticosequencial", "Automatica sequencial"),
            Map.entry("sequencial", "Automatica sequencial")
    );
    private static final Map<String, String> VEHICLE_FUEL_OPTIONS = Map.ofEntries(
            Map.entry("flex", "Flex"),
            Map.entry("gasolina", "Gasolina"),
            Map.entry("diesel", "Diesel"),
            Map.entry("etanol", "Etanol"),
            Map.entry("alcool", "Alcool"),
            Map.entry("eletrico", "Eletrico"),
            Map.entry("hibrido", "Hibrido"),
            Map.entry("hibridoflex", "Hibrido/Flex"),
            Map.entry("hibridogasolina", "Hibrido/Gasolina"),
            Map.entry("hibridodiesel", "Hibrido/Diesel"),
            Map.entry("gasolinaeeletrico", "Gasolina e eletrico"),
            Map.entry("gasolinaegasnatural", "Gasolina e gas natural"),
            Map.entry("alcoolegasnatural", "Alcool e gas natural"),
            Map.entry("gasolinaalcoolegasnatural", "Gasolina-Alcool e gas natural"),
            Map.entry("gasolinaealcool", "Flex")
    );
    private static final Map<String, String> VEHICLE_BODY_TYPE_OPTIONS = Map.ofEntries(
            Map.entry("hatch", "Hatch"),
            Map.entry("sedan", "Sedan"),
            Map.entry("suv", "SUV"),
            Map.entry("crossover", "Crossover"),
            Map.entry("picape", "Picape"),
            Map.entry("pickup", "Picape"),
            Map.entry("coupe", "Coupe"),
            Map.entry("cupe", "Coupe"),
            Map.entry("conversivel", "Conversivel"),
            Map.entry("convertible", "Conversivel"),
            Map.entry("perua", "Perua"),
            Map.entry("wagon", "Perua"),
            Map.entry("van", "Van"),
            Map.entry("minivan", "Minivan")
    );
    private static final Map<String, String> VEHICLE_COLOR_OPTIONS = Map.ofEntries(
            Map.entry("prata", "Prata"),
            Map.entry("preto", "Preto"),
            Map.entry("branco", "Branco"),
            Map.entry("cinza", "Cinza"),
            Map.entry("cinzaescuro", "Cinza escuro"),
            Map.entry("vermelho", "Vermelho"),
            Map.entry("azul", "Azul"),
            Map.entry("verde", "Verde"),
            Map.entry("amarelo", "Amarelo"),
            Map.entry("bege", "Bege"),
            Map.entry("marrom", "Marrom")
    );

    private final CurrentUserPort currentUser;
    private final CompanyRepositoryPort companies;
    private final UserRepositoryPort users;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final CrmCompanyStateRepositoryJpa crmState;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final IoAutoVehiclePublicationRepositoryJpa publications;
    private final IoAutoIntegrationRepositoryJpa integrations;
    private final IoAutoIntegrationManagementService integrationManagementService;
    private final IoAutoPublicLinkRepositoryJpa publicLinks;
    private final IoAutoPublicLeadEventRepositoryJpa publicLeadEvents;
    private final IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads;
    private final IoAutoBillingService billingService;
    private final VehicleAutoPublicationService vehicleAutoPublicationService;
    private final FeatureUsageService featureUsageService;
    private final SuperAdminPlanManagementService planManagementService;
    private final RealtimeGateway realtime;
    private final MeliAdService meliAdService;
    private final MeliCategoryService meliCategoryService;
    private final MeliListingTypeService meliListingTypeService;
    private final OlxAdService olxAdService;
    private final IoAutoSalesService ioAutoSalesService;

    public IoAutoController(
            CurrentUserPort currentUser,
            CompanyRepositoryPort companies,
            UserRepositoryPort users,
            AtendimentoConversationRepositoryJpa conversations,
            AtendimentoSessionRepositoryJpa sessions,
            CrmCompanyStateRepositoryJpa crmState,
            IoAutoVehicleRepositoryJpa vehicles,
            IoAutoVehiclePublicationRepositoryJpa publications,
            IoAutoIntegrationRepositoryJpa integrations,
            IoAutoIntegrationManagementService integrationManagementService,
            IoAutoPublicLinkRepositoryJpa publicLinks,
            IoAutoPublicLeadEventRepositoryJpa publicLeadEvents,
            IoAutoPublicCatalogLeadRepositoryJpa publicCatalogLeads,
            IoAutoBillingService billingService,
            VehicleAutoPublicationService vehicleAutoPublicationService,
            FeatureUsageService featureUsageService,
            SuperAdminPlanManagementService planManagementService,
            RealtimeGateway realtime,
            MeliAdService meliAdService,
            MeliCategoryService meliCategoryService,
            MeliListingTypeService meliListingTypeService,
            OlxAdService olxAdService,
            IoAutoSalesService ioAutoSalesService
    ) {
        this.currentUser = currentUser;
        this.companies = companies;
        this.users = users;
        this.conversations = conversations;
        this.sessions = sessions;
        this.crmState = crmState;
        this.vehicles = vehicles;
        this.publications = publications;
        this.integrations = integrations;
        this.integrationManagementService = integrationManagementService;
        this.publicLinks = publicLinks;
        this.publicLeadEvents = publicLeadEvents;
        this.publicCatalogLeads = publicCatalogLeads;
        this.billingService = billingService;
        this.vehicleAutoPublicationService = vehicleAutoPublicationService;
        this.featureUsageService = featureUsageService;
        this.planManagementService = planManagementService;
        this.realtime = realtime;
        this.meliAdService = meliAdService;
        this.meliCategoryService = meliCategoryService;
        this.meliListingTypeService = meliListingTypeService;
        this.olxAdService = olxAdService;
        this.ioAutoSalesService = ioAutoSalesService;
    }

    @GetMapping("/ioauto/dashboard")
    public ResponseEntity<IoAutoDashboardHttpResponse> getDashboard(
            @RequestParam(name = "preset", required = false) String preset,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to
    ) {
        UUID companyId = currentUser.companyId();
        String companyName = companies.findNameById(companyId).orElse("IOAuto");
        DashboardPeriodSelection periodSelection = resolveDashboardPeriod(preset, from, to);

        List<JpaIoAutoVehicleEntity> companyVehicles = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        List<JpaIoAutoVehiclePublicationEntity> companyPublications = publications.findAllByCompanyIdOrderByUpdatedAtDesc(companyId);
        List<JpaIoAutoIntegrationEntity> companyIntegrations = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .toList();
        List<JpaAtendimentoConversationEntity> companyConversations = conversations.findAllByCompanyIdOrderByLastMessageAtDescUpdatedAtDesc(companyId).stream()
                .filter(conversation -> isSupportedLeadSource(conversation.getSourcePlatform()))
                .toList();
        java.util.Set<UUID> supportedConversationIds = companyConversations.stream()
                .map(JpaAtendimentoConversationEntity::getId)
                .collect(java.util.stream.Collectors.toSet());
        List<JpaAtendimentoSessionEntity> periodLeadSessions = sessions.findAllByCompanyIdAndArrivedAtGreaterThanEqualAndArrivedAtLessThanOrderByArrivedAtAsc(
                companyId,
                periodSelection.fromAt(),
                periodSelection.toExclusiveAt()
        ).stream()
                .filter(session -> supportedConversationIds.contains(session.getConversationId()))
                .toList();
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
        Map<UUID, Long> vehiclePriceById = companyVehicles.stream()
                .collect(java.util.stream.Collectors.toMap(
                        JpaIoAutoVehicleEntity::getId,
                        vehicle -> vehicle.getPriceCents() == null ? 0L : vehicle.getPriceCents()
                ));
        for (JpaAtendimentoSessionEntity session : periodSalesSessions) {
            totalSalesCount++;
            if (session.isSaleIsConsigned()) {
                Long commission = session.getSaleConsignmentCommissionAmountCents();
                if (commission != null && commission > 0) {
                    totalSalesRevenueCents += commission;
                }
                continue;
            }

            Long ownSaleAmount = session.getSaleAmountAfterDiscountCents();
            if (ownSaleAmount != null && ownSaleAmount > 0) {
                totalSalesRevenueCents += ownSaleAmount;
                continue;
            }

            if (session.getSoldVehicleId() != null) {
                Long fallbackPrice = vehiclePriceById.get(session.getSoldVehicleId());
                if (fallbackPrice != null && fallbackPrice > 0) {
                    totalSalesRevenueCents += fallbackPrice;
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

        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> publicationsByVehicle = groupPublicationsByVehicle(companyPublications);

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
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_VEHICLE_MANAGEMENT, Map.of("action", "LIST_VEHICLES"));
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

    @GetMapping("/ioauto/vehicles/inventory-summaries")
    public ResponseEntity<List<IoAutoVehicleInventorySummaryHttpResponse>> listVehicleInventorySummaries() {
        UUID companyId = currentUser.companyId();
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_VEHICLE_MANAGEMENT, Map.of("action", "LIST_VEHICLES"));

        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> publicationsByVehicle =
                groupPublicationsByVehicle(publications.findAllByCompanyIdOrderByUpdatedAtDesc(companyId));
        Map<String, JpaIoAutoIntegrationEntity> integrationsByKey = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                .collect(java.util.stream.Collectors.toMap(
                        JpaIoAutoIntegrationEntity::getProviderKey,
                        item -> item,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<IoAutoVehicleInventorySummaryHttpResponse> response = vehicles.findInventorySummariesByCompanyId(companyId).stream()
                .map(vehicle -> new IoAutoVehicleInventorySummaryHttpResponse(
                        vehicle.getId(),
                        normalizeNullableText(vehicle.getStockNumber()),
                        vehicle.getTitle(),
                        vehicle.getBrand(),
                        vehicle.getModel(),
                        normalizeNullableText(vehicle.getVersion()),
                        normalizeNullableText(vehicle.getEngine()),
                        vehicle.getYear(),
                        vehicle.getModelYear(),
                        vehicle.getManufactureYear(),
                        vehicle.getPriceCents(),
                        vehicle.getMileage(),
                        vehicle.getConsigned(),
                        normalizeNullableText(vehicle.getConsignedOwnerName()),
                        vehicle.getConsignmentCommissionPercentage(),
                        vehicle.getFeatured(),
                        normalizeText(vehicle.getStatus(), "DRAFT"),
                        vehicle.getCoverImageAvailable(),
                        toPublicationSummaries(
                                publicationsByVehicle.getOrDefault(vehicle.getId(), List.of()),
                                integrationsByKey
                        ),
                        vehicle.getUpdatedAt()
                ))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ioauto/vehicles/options")
    public ResponseEntity<List<IoAutoVehicleOptionHttpResponse>> listVehicleOptions() {
        UUID companyId = currentUser.companyId();
        List<IoAutoVehicleOptionHttpResponse> response = vehicles.findOptionsByCompanyId(companyId).stream()
                .map(vehicle -> new IoAutoVehicleOptionHttpResponse(
                        vehicle.getId(),
                        vehicle.getTitle(),
                        normalizeText(vehicle.getStatus(), "DRAFT")
                ))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ioauto/vehicles/{vehicleId}")
    public ResponseEntity<IoAutoVehicleHttpResponse> getVehicle(@PathVariable UUID vehicleId) {
        UUID companyId = currentUser.companyId();
        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId)
                .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veículo não encontrado."));
        return ResponseEntity.ok(toVehicleResponse(
                vehicle,
                publications.findAllByCompanyIdAndVehicleId(companyId, vehicleId),
                integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
                        .filter(integration -> isSupportedProvider(integration.getProviderKey()))
                        .collect(java.util.stream.Collectors.toMap(
                                JpaIoAutoIntegrationEntity::getProviderKey,
                                item -> item,
                                (left, right) -> left,
                                LinkedHashMap::new
                        ))
        ));
    }

    @GetMapping("/ioauto/vehicles/{vehicleId}/cover-image")
    public ResponseEntity<?> getVehicleCoverImage(@PathVariable UUID vehicleId) {
        UUID companyId = currentUser.companyId();
        String source = normalizeNullableText(
                vehicles.findCoverImageByIdAndCompanyId(vehicleId, companyId).orElse(null)
        );
        if (source == null) {
            source = vehicles.findGalleryJsonByIdAndCompanyId(vehicleId, companyId)
                    .map(this::readStringArray)
                    .flatMap(items -> items.stream().findFirst())
                    .orElse(null);
        }
        if (source == null) {
            return ResponseEntity.notFound().build();
        }

        if (source.startsWith("https://") || source.startsWith("http://")) {
            return ResponseEntity.status(302)
                    .location(URI.create(source))
                    .header(HttpHeaders.CACHE_CONTROL, "private, max-age=604800")
                    .build();
        }

        VehicleImageContent image = decodeVehicleImage(source);
        if (image == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .contentLength(image.bytes().length)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=604800, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .body(image.bytes());
    }

    @GetMapping("/public/stock/{companyIdentifier}")
    public ResponseEntity<PublicInventoryCatalogHttpResponse> getPublicInventory(
            @PathVariable String companyIdentifier,
            @RequestParam(name = "source", required = false) String sourceType,
            @RequestParam(name = "ref", required = false) String sourceReference
    ) {
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
                toPublicCompanySummary(company, resolvePublicLinkWhatsappNumber(company, sourceType, sourceReference)),
                buildResolvedPublicCatalogBanners(company, publicVehicles),
                catalogVehicles
        ));
    }

    @GetMapping("/public/stock/{companyIdentifier}/vehicles/{vehicleId}")
    public ResponseEntity<PublicVehicleDetailHttpResponse> getPublicVehicle(
            @PathVariable String companyIdentifier,
            @PathVariable UUID vehicleId,
            @RequestParam(name = "source", required = false) String sourceType,
            @RequestParam(name = "ref", required = false) String sourceReference
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
                toPublicCompanySummary(company, resolvePublicLinkWhatsappNumber(company, sourceType, sourceReference)),
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

        String normalizedSourceType = trimToMaxLength(normalizePublicCatalogLeadSourceType(request.sourceType()), 40);
        String normalizedSourceReference = trimToMaxLength(normalizeNullableText(request.sourceReference()), 160);
        JpaIoAutoPublicCatalogLeadEntity entity = new JpaIoAutoPublicCatalogLeadEntity();
        entity.setId(UUID.randomUUID());
        entity.setCompanyId(companyId);
        entity.setVehicleId(trackedVehicleId);
        entity.setSellerUserId(resolvePublicLinkResponsibleUserId(companyId, normalizedSourceType, normalizedSourceReference));
        entity.setCustomerName(trimToMaxLength(requireText(request.customerName(), "Informe o nome."), 160));
        entity.setCustomerPhone(normalizePublicCatalogLeadPhone(request.customerPhone()));
        entity.setVehicleInterestName(resolveVehicleInterestName(companyId, trackedVehicleId, request.customerName()));
        entity.setSourceType(normalizedSourceType);
        entity.setSourceReference(normalizedSourceReference);
        entity.setPagePath(trimToMaxLength(normalizeNullableText(request.pagePath()), 255));
        entity.setSourceUrl(normalizeNullableText(request.sourceUrl()));
        entity.setOriginSource(trimToMaxLength(normalizedSourceType, 255));
        entity.setSessionId(trimToMaxLength(normalizeNullableText(request.sessionId()), 120));
        entity.setConvertedToSale(false);
        entity.setConvertedSaleId(null);
        entity.setCreatedAt(Instant.now());
        publicCatalogLeads.save(entity);
        boolean crmStateChanged = ensurePublicCatalogLeadCrmCard(companyId, entity, entity.getCreatedAt());

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            boolean notifyCrmState = crmStateChanged;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    realtime.publicCatalogLeadCreated(companyId);
                    if (notifyCrmState) {
                        realtime.crmStateChanged(companyId);
                    }
                }
            });
        } else {
            realtime.publicCatalogLeadCreated(companyId);
            if (crmStateChanged) {
                realtime.crmStateChanged(companyId);
            }
        }

        return ResponseEntity.noContent().build();
    }

    private boolean ensurePublicCatalogLeadCrmCard(UUID companyId, JpaIoAutoPublicCatalogLeadEntity lead, Instant now) {
        var plan = planManagementService.resolvePlanForCompany(companyId);
        if (!plan.features().crmKanban() || !plan.features().leadManagement()) {
            return false;
        }

        JpaCrmCompanyStateEntity entity = crmState.findByCompanyIdForUpdate(companyId).orElseGet(() -> {
            JpaCrmCompanyStateEntity created = new JpaCrmCompanyStateEntity();
            created.setCompanyId(companyId);
            created.setStagesJson("[]");
            created.setLeadStageMapJson("{}");
            created.setCustomFieldsJson("[]");
            created.setLeadFieldValuesJson("{}");
            created.setLeadFieldsOrderJson("[]");
            created.setCreatedAt(now);
            created.setUpdatedAt(now);
            return created;
        });

        List<Map<String, Object>> stages = readJsonListOfObjects(entity.getStagesJson());
        String firstStageId = resolveFirstCrmStageId(stages);
        if (firstStageId == null) {
            Map<String, Object> defaultStage = createDefaultCrmInitialStage(now);
            stages = new ArrayList<>(stages);
            stages.add(defaultStage);
            firstStageId = String.valueOf(defaultStage.get("id"));
            entity.setStagesJson(writeJsonValue(stages, "[]"));
        }

        Map<String, String> leadStageMap = readJsonStringMap(entity.getLeadStageMapJson());
        String leadKey = lead.getId().toString();
        if (firstStageId.equals(leadStageMap.get(leadKey))) {
            return false;
        }

        leadStageMap.put(leadKey, firstStageId);
        entity.setLeadStageMapJson(writeJsonValue(leadStageMap, "{}"));
        entity.setUpdatedAt(now);
        crmState.saveAndFlush(entity);
        return true;
    }

    private String resolveFirstCrmStageId(List<Map<String, Object>> stages) {
        if (stages == null || stages.isEmpty()) {
            return null;
        }

        return stages.stream()
                .filter(stage -> normalizeText(String.valueOf(stage.getOrDefault("id", ""))).isBlank() == false)
                .sorted(Comparator
                        .comparing((Map<String, Object> stage) -> readStageOrder(stage))
                        .thenComparing(stage -> "initial".equalsIgnoreCase(normalizeText(String.valueOf(stage.get("kind")))) ? 0 : 1))
                .map(stage -> normalizeText(String.valueOf(stage.get("id"))))
                .findFirst()
                .orElse(null);
    }

    private int readStageOrder(Map<String, Object> stage) {
        if (stage == null) return Integer.MAX_VALUE;
        Object raw = stage.get("order");
        if (raw instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (Exception ignored) {
            return Integer.MAX_VALUE;
        }
    }

    private Map<String, Object> createDefaultCrmInitialStage(Instant now) {
        Map<String, Object> stage = new LinkedHashMap<>();
        stage.put("id", "crm_stage_catalog_entry");
        stage.put("title", "Entrada");
        stage.put("kind", "initial");
        stage.put("order", 0);
        stage.put("createdAt", now.toString());
        stage.put("updatedAt", now.toString());
        return stage;
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
    public ResponseEntity<List<IoAutoIntegrationHttpResponse>> listIntegrations() {
        UUID companyId = currentUser.companyId();
        List<IoAutoIntegrationHttpResponse> response = integrations.findAllByCompanyIdOrderByDisplayNameAsc(companyId).stream()
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
        planManagementService.assertProviderIntegrationEnabled(companyId, normalizedProviderKey);

        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, normalizedProviderKey)
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

    @DeleteMapping("/ioauto/integrations/{providerKey}")
    @Transactional
    public ResponseEntity<Void> deleteIntegration(@PathVariable String providerKey) {
        integrationManagementService.deleteDisconnectedIntegration(currentUser.companyId(), providerKey);
        return ResponseEntity.noContent().build();
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
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_TRACKABLE_LINKS);
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
            @RequestParam(name = "to", required = false) String to,
            @RequestParam(name = "sellerUserId", required = false) UUID sellerUserId
    ) {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_LEAD_MANAGEMENT);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_LEAD_MANAGEMENT, Map.of("action", "LIST_CATALOG_LEADS"));
        PublicCatalogLeadPeriodSelection periodSelection = resolvePublicCatalogLeadPeriod(preset, from, to);
        String publicSlug = companies.findById(companyId)
                .map(company -> slugifyPublicPathSegment(company.name()))
                .orElse("catalogo");
        boolean canViewAllLeads = currentUser.roles().stream()
                .anyMatch(role -> "ADMIN".equalsIgnoreCase(role) || "SUPERADMIN".equalsIgnoreCase(role));
        UUID effectiveSellerUserId = canViewAllLeads ? sellerUserId : currentUser.userId();
        if (effectiveSellerUserId != null && users.findByIdAndCompanyId(effectiveSellerUserId, companyId).isEmpty()) {
            throw new BusinessException("IOAUTO_LEAD_USER_INVALID", "Usuário responsável não encontrado nesta empresa.");
        }

        List<JpaIoAutoPublicCatalogLeadEntity> leads = effectiveSellerUserId == null
                ? publicCatalogLeads.findAllByCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                companyId,
                periodSelection.fromAt(),
                periodSelection.toExclusiveAt()
        )
                : publicCatalogLeads.findAllByCompanyIdAndSellerUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                companyId,
                currentUser.userId(),
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
                            vehicle == null ? null : vehicle.getPriceCents(),
                            vehicle == null ? null : "/estoque-publico/" + publicSlug + "/veiculo/" + lead.getVehicleId(),
                            normalizeNullableText(lead.getSourceType()),
                            normalizeNullableText(lead.getSourceReference()),
                            normalizeNullableText(lead.getPagePath()),
                            normalizeNullableText(lead.getSourceUrl()),
                            lead.getSellerUserId(),
                            lead.isConvertedToSale(),
                            lead.getConvertedSaleId(),
                            lead.getCreatedAt()
                    );
                })
                .toList();

        return ResponseEntity.ok(new PublicCatalogLeadListHttpResponse(
                periodSelection.preset(),
                periodSelection.fromDate(),
                periodSelection.toDate(),
                canViewAllLeads,
                leads.size(),
                leadsWithVehicle,
                leadsWithCampaign,
                uniquePhones.size(),
                items
        ));
    }

    @PostMapping("/ioauto/public-catalog-leads/{leadId}/close-sale")
    @Transactional
    public ResponseEntity<Void> closePublicCatalogLeadSale(
            @PathVariable UUID leadId,
            @Valid @RequestBody ClosePublicCatalogLeadSaleHttpRequest request
    ) {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_LEAD_MANAGEMENT);
        ioAutoSalesService.registerPublicCatalogLeadSale(
                companyId,
                leadId,
                request.sellerUserId(),
                toSaleClosingCommand(request.financial()),
                Instant.now()
        );
        featureUsageService.registerUsage(
                companyId,
                FeatureUsageService.FEATURE_SALES_MANAGEMENT,
                Map.of("action", "REGISTER_SALE", "saleOriginPlatform", "CATALOG")
        );
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ioauto/vehicles/{vehicleId}/close-sale")
    @Transactional
    public ResponseEntity<Void> closeVehicleSale(
            @PathVariable UUID vehicleId,
            @Valid @RequestBody CloseInventoryVehicleSaleHttpRequest request
    ) {
        UUID companyId = currentUser.companyId();
        boolean requireBuyerLead = planManagementService.resolvePlanForCompany(companyId).features().leadManagement();
        ioAutoSalesService.registerInventoryVehicleSale(
                companyId,
                vehicleId,
                request.sellerUserId(),
                request.buyerConversationId(),
                request.buyerName(),
                request.buyerPhone(),
                requireBuyerLead,
                toSaleClosingCommand(request.financial()),
                Instant.now()
        );
        featureUsageService.registerUsage(
                companyId,
                FeatureUsageService.FEATURE_SALES_MANAGEMENT,
                Map.of("action", "REGISTER_SALE", "saleOriginPlatform", "MANUAL")
        );
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ioauto/public-links")
    public ResponseEntity<List<PublicLinkHttpResponse>> listPublicLinks() {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_OWN_SITE);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_OWN_SITE, Map.of("action", "LIST_PUBLIC_LINKS"));
        String companyName = companies.findNameById(companyId).orElse(null);
        if (companyName == null) {
            return ResponseEntity.ok(List.of());
        }

        List<JpaIoAutoPublicLinkEntity> links = publicLinks.findAllByCompanyIdOrderByCreatedAtDesc(companyId);
        Map<UUID, String> vehicleTitlesById = vehicles.findOptionsByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        IoAutoVehicleRepositoryJpa.VehicleOptionSummary::getId,
                        IoAutoVehicleRepositoryJpa.VehicleOptionSummary::getTitle,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        Map<String, PublicLinkEventStats> eventStatsBySource = publicLeadEvents.summarizeForPublicLinks(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        aggregate -> publicLinkEventStatsKey(aggregate.getSourceType(), aggregate.getSourceReference()),
                        aggregate -> new PublicLinkEventStats(
                                aggregate.getTotalInteractions(),
                                aggregate.getContactClicks(),
                                aggregate.getInterestClicks(),
                                aggregate.getLastInteractionAt()
                        ),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        Map<UUID, String> responsibleUserNames = users.findAllByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        user -> user.id(),
                        user -> normalizeText(user.fullName(), user.email()),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<PublicLinkHttpResponse> response = links.stream()
                .map(link -> toPublicLinkResponse(
                        companyName,
                        link,
                        vehicleTitlesById,
                        eventStatsBySource,
                        responsibleUserNames.get(link.getResponsibleUserId())
                ))
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/ioauto/public-catalog-settings")
    public ResponseEntity<PublicCatalogSettingsHttpResponse> getPublicCatalogSettings() {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_OWN_SITE);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_OWN_SITE, Map.of("action", "GET_CATALOG_SETTINGS"));
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada."));
        return ResponseEntity.ok(toPublicCatalogSettingsResponse(company));
    }

    @PutMapping("/ioauto/public-catalog-settings")
    @Transactional
    public ResponseEntity<PublicCatalogSettingsHttpResponse> updatePublicCatalogSettings(
            @Valid @RequestBody SavePublicCatalogSettingsHttpRequest request
    ) {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_OWN_SITE);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_OWN_SITE, Map.of("action", "UPDATE_CATALOG_SETTINGS"));
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada."));

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
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_OWN_SITE);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_OWN_SITE, Map.of("action", "CREATE_PUBLIC_LINK"));
        var company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada."));
        var responsibleUser = users.findByIdAndCompanyId(request.responsibleUserId(), companyId)
                .filter(user -> user.isActive())
                .orElseThrow(() -> new BusinessException(
                        "IOAUTO_PUBLIC_LINK_INVALID_RESPONSIBLE",
                        "Selecione um usuário ativo da empresa para receber os leads deste link."
                ));

        String linkKind = normalizePublicLinkKind(request.linkKind());
        String scopeType = normalizePublicLinkScope(request.scopeType());
        if ("PUBLIC".equals(linkKind) == false) {
            planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_TRACKABLE_LINKS);
        }
        String sourceType = "PUBLIC".equals(linkKind) ? null : normalizePublicLinkSourceType(request.sourceType());
        String sourceReference = "PUBLIC".equals(linkKind) ? null : normalizePublicLinkSourceReference(request.sourceReference());
        boolean useCompanyWhatsapp = request.useCompanyWhatsapp() == null || request.useCompanyWhatsapp();
        String whatsappNumber;
        if (useCompanyWhatsapp) {
            if (sanitizeWhatsappNumber(company.whatsappNumber()) == null) {
                throw new BusinessException(
                        "IOAUTO_PUBLIC_LINK_INVALID_WHATSAPP",
                        "Cadastre um WhatsApp válido para a empresa ou informe um número personalizado para o link."
                );
            }
            whatsappNumber = null;
        } else {
            whatsappNumber = requirePublicLinkWhatsappNumber(request.whatsappNumber());
        }

        UUID vehicleId = request.vehicleId();
        JpaIoAutoVehicleEntity vehicle = null;
        if ("VEHICLE".equals(scopeType)) {
            if (vehicleId == null) {
                throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Selecione um veículo para este link.");
            }
            vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId)
                    .orElseThrow(() -> new BusinessException("VEHICLE_NOT_FOUND", "Veículo não encontrado."));
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
        entity.setUseCompanyWhatsapp(useCompanyWhatsapp);
        entity.setWhatsappNumber(whatsappNumber);
        entity.setResponsibleUserId(responsibleUser.id());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        publicLinks.save(entity);

        Map<UUID, String> vehicleTitlesById = vehicle == null
                ? Map.of()
                : Map.of(vehicle.getId(), vehicle.getTitle());
        return ResponseEntity.ok(toPublicLinkResponse(
                company.name(),
                entity,
                vehicleTitlesById,
                Map.of(),
                normalizeText(responsibleUser.fullName(), responsibleUser.email())
        ));
    }

    @DeleteMapping("/ioauto/public-links/{linkId}")
    @Transactional
    public ResponseEntity<Void> deletePublicLink(@PathVariable UUID linkId) {
        UUID companyId = currentUser.companyId();
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_OWN_SITE);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_OWN_SITE, Map.of("action", "DELETE_PUBLIC_LINK"));
        JpaIoAutoPublicLinkEntity entity = publicLinks.findByIdAndCompanyId(linkId, companyId)
                .orElseThrow(() -> new BusinessException("IOAUTO_PUBLIC_LINK_NOT_FOUND", "Link não encontrado."));
        publicLinks.delete(entity);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ioauto/billing")
    public ResponseEntity<BillingSnapshot> getBilling() {
        return ResponseEntity.ok(billingService.getBillingSnapshot(currentUser.companyId()));
    }

    @PostMapping("/ioauto/billing/plan-change/notice/dismiss")
    public ResponseEntity<Void> dismissBillingPlanChangeNotice() {
        billingService.dismissPlanChangeNotice(currentUser.companyId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ioauto/billing/plan-change/preview")
    public ResponseEntity<PlanChangePreviewResponse> previewBillingPlanChange(@Valid @RequestBody PlanChangePreviewHttpRequest request) {
        billingService.assertPlanChangeAllowed(currentUser.roles());
        return ResponseEntity.ok(
                billingService.previewPlanChange(
                        currentUser.companyId(),
                        request.targetPlanKey(),
                        request.targetBillingInterval()
                )
        );
    }

    @PostMapping("/ioauto/billing/plan-change/confirm")
    public ResponseEntity<PlanChangeConfirmResponse> confirmBillingPlanChange(@Valid @RequestBody PlanChangeConfirmHttpRequest request) {
        billingService.assertPlanChangeAllowed(currentUser.roles());
        return ResponseEntity.ok(
                billingService.confirmPlanChange(
                        currentUser.companyId(),
                        request.targetPlanKey(),
                        request.targetBillingInterval(),
                        request.updatePendingPayments()
                )
        );
    }

    @PatchMapping("/ioauto/billing/plan")
    public ResponseEntity<BillingSnapshot> changeBillingPlan(@RequestBody ChangeBillingPlanHttpRequest request) {
        billingService.assertPlanChangeAllowed(currentUser.roles());
        if (request == null || request.planId() == null) {
            throw new BusinessException("PLAN_ID_REQUIRED", "Selecione um plano valido.");
        }
        return ResponseEntity.ok(billingService.changePlan(currentUser.companyId(), request.planId(), request.billingRecurrence()));
    }

    @GetMapping("/ioauto/billing/access-status")
    public ResponseEntity<BillingAccessStatusSnapshot> getBillingAccessStatus() {
        return ResponseEntity.ok(billingService.getBillingAccessStatus(currentUser.companyId()));
    }

    @PostMapping("/ioauto/billing/access-status/verify")
    public ResponseEntity<BillingAccessStatusSnapshot> verifyBillingAccessStatus() {
        return ResponseEntity.ok(billingService.verifyAndSyncBillingAccessStatus(currentUser.companyId()));
    }

    @GetMapping("/ioauto/billing/regularization-options")
    public ResponseEntity<BillingRegularizationOptions> getBillingRegularizationOptions() {
        return ResponseEntity.ok(billingService.getRegularizationOptions(currentUser.companyId()));
    }

    @PostMapping("/ioauto/billing/portal")
    public ResponseEntity<PortalLaunch> createBillingPortal() {
        return ResponseEntity.ok(billingService.createPortalSession(currentUser.companyId()));
    }

    public record ChangeBillingPlanHttpRequest(
            UUID planId,
            String billingRecurrence
    ) {
    }

    public record PlanChangePreviewHttpRequest(
            @NotBlank String targetPlanKey,
            String targetBillingInterval
    ) {
    }

    public record PlanChangeConfirmHttpRequest(
            @NotBlank String targetPlanKey,
            String targetBillingInterval,
            Boolean updatePendingPayments
    ) {
    }

    private IoAutoVehicleHttpResponse saveVehicle(UUID vehicleId, SaveVehicleHttpRequest request) {
        UUID companyId = currentUser.companyId();
        if (vehicleId == null) {
            planManagementService.assertVehicleCreationAllowed(companyId);
        }
        featureUsageService.registerUsage(
                companyId,
                FeatureUsageService.FEATURE_VEHICLE_MANAGEMENT,
                Map.of("action", vehicleId == null ? "CREATE_VEHICLE" : "UPDATE_VEHICLE")
        );
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
        entity.setTransmission(normalizeVehicleTransmission(request.transmission()));
        entity.setFuelType(normalizeVehicleFuelType(request.fuelType()));
        entity.setBodyType(normalizeVehicleBodyType(request.bodyType()));
        entity.setDoors(normalizeVehicleDoors(request.doors()));
        entity.setColor(normalizeVehicleColor(request.color()));
        entity.setPlateFinal(normalizeNullableText(request.plateFinal()));
        entity.setPlate(normalizeNullableText(request.plate()));
        entity.setContactPhone(normalizeNullableText(request.contactPhone()));
        entity.setZipcode(normalizeNullableText(request.zipcode()));
        entity.setCity(normalizeNullableText(request.city()));
        entity.setState(normalizedState == null ? null : normalizedState.toUpperCase(Locale.ROOT));
        boolean consigned = Boolean.TRUE.equals(request.consigned());
        entity.setConsigned(consigned);
        if (consigned) {
            entity.setConsignedOwnerName(trimToMaxLength(requireText(
                    request.consignedOwnerName(),
                    "Informe o dono/empresa para veículo consignado."
            ), 200));
            entity.setConsignmentCommissionPercentage(normalizeConsignmentCommissionPercentage(request.consignmentCommissionPercentage()));
        } else {
            entity.setConsignedOwnerName(null);
            entity.setConsignmentCommissionPercentage(null);
        }
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

        if (!selectedIntegrations.isEmpty()) {
            UUID savedVehicleId = entity.getId();
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        for (String providerKey : selectedIntegrations) {
                            vehicleAutoPublicationService.publishAfterCommit(companyId, savedVehicleId, providerKey);
                        }
                    }
                });
            } else {
                for (String providerKey : selectedIntegrations) {
                    vehicleAutoPublicationService.publishAfterCommit(companyId, savedVehicleId, providerKey);
                }
            }
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

        return groupPublicationsByVehicle(publications.findAllByCompanyIdAndVehicleIdIn(companyId, vehicleIds));
    }

    private Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> groupPublicationsByVehicle(
            List<JpaIoAutoVehiclePublicationEntity> companyPublications
    ) {
        Map<UUID, List<JpaIoAutoVehiclePublicationEntity>> grouped = new LinkedHashMap<>();
        for (JpaIoAutoVehiclePublicationEntity publication : companyPublications) {
            grouped.computeIfAbsent(publication.getVehicleId(), ignored -> new ArrayList<>()).add(publication);
        }
        return grouped;
    }

    private IoAutoVehicleHttpResponse toVehicleResponse(
            JpaIoAutoVehicleEntity vehicle,
            List<JpaIoAutoVehiclePublicationEntity> vehiclePublications,
            Map<String, JpaIoAutoIntegrationEntity> integrationsByKey
    ) {
        List<IoAutoVehicleHttpResponse.PublicationSummary> publicationSummaries =
                toPublicationSummaries(vehiclePublications, integrationsByKey);

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
                vehicle.getDoors(),
                normalizeNullableText(vehicle.getColor()),
                normalizeNullableText(vehicle.getPlateFinal()),
                normalizeNullableText(vehicle.getPlate()),
                normalizeNullableText(vehicle.getContactPhone()),
                normalizeNullableText(vehicle.getZipcode()),
                normalizeNullableText(vehicle.getCity()),
                normalizeNullableText(vehicle.getState()),
                vehicle.isConsigned(),
                normalizeNullableText(vehicle.getConsignedOwnerName()),
                vehicle.getConsignmentCommissionPercentage(),
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

    private List<IoAutoVehicleHttpResponse.PublicationSummary> toPublicationSummaries(
            List<JpaIoAutoVehiclePublicationEntity> vehiclePublications,
            Map<String, JpaIoAutoIntegrationEntity> integrationsByKey
    ) {
        return vehiclePublications.stream()
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
    }

    private VehicleImageContent decodeVehicleImage(String source) {
        if (source == null || source.startsWith("data:image/") == false) return null;
        int metadataEnd = source.indexOf(',');
        if (metadataEnd <= "data:".length()) return null;

        String metadata = source.substring("data:".length(), metadataEnd);
        int metadataSeparator = metadata.indexOf(';');
        String contentType = metadataSeparator >= 0 ? metadata.substring(0, metadataSeparator) : metadata;
        if (contentType.startsWith("image/") == false || metadata.toLowerCase(Locale.ROOT).contains(";base64") == false) {
            return null;
        }

        try {
            return new VehicleImageContent(contentType, Base64.getDecoder().decode(source.substring(metadataEnd + 1)));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
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

    private PublicCompanySummary toPublicCompanySummary(
            com.io.appioweb.domain.auth.entity.Company company,
            String whatsappNumber
    ) {
        return new PublicCompanySummary(
                company.id(),
                normalizeText(company.name(), "Catalogo"),
                slugifyPublicPathSegment(company.name()),
                normalizeNullableText(company.profileImageUrl()),
                sanitizeWhatsappNumber(whatsappNumber)
        );
    }

    private PublicLinkHttpResponse toPublicLinkResponse(
            String companyName,
            JpaIoAutoPublicLinkEntity link,
            Map<UUID, String> vehicleTitlesById,
            Map<String, PublicLinkEventStats> eventStatsBySource,
            String responsibleUserName
    ) {
        String sourceType = normalizeNullableText(link.getSourceType());
        String sourceReference = normalizeNullableText(link.getSourceReference());
        String trackingSourceType = resolvePublicLinkTrackingSourceType(link);
        String trackingSourceReference = resolvePublicLinkTrackingSourceReference(link);
        PublicLinkEventStats eventStats = eventStatsBySource.getOrDefault(
                publicLinkEventStatsKey(trackingSourceType, trackingSourceReference),
                PublicLinkEventStats.EMPTY
        );

        return new PublicLinkHttpResponse(
                link.getId(),
                normalizeText(link.getName(), "Link publico"),
                normalizeText(link.getLinkKind(), "PUBLIC"),
                normalizeText(link.getScopeType(), "CATALOG"),
                sourceType,
                sourceReference,
                link.isUseCompanyWhatsapp(),
                sanitizeWhatsappNumber(link.getWhatsappNumber()),
                link.getResponsibleUserId(),
                normalizeNullableText(responsibleUserName),
                link.getVehicleId(),
                link.getVehicleId() == null ? null : vehicleTitlesById.get(link.getVehicleId()),
                buildPublicLinkPath(companyName, link),
                eventStats.totalInteractions(),
                eventStats.contactClicks(),
                eventStats.interestClicks(),
                eventStats.lastInteractionAt(),
                link.getCreatedAt(),
                link.getUpdatedAt()
        );
    }

    private String publicLinkEventStatsKey(String sourceType, String sourceReference) {
        return normalizeText(sourceType).toUpperCase(Locale.ROOT)
                + "\u0000"
                + normalizeText(sourceReference).toUpperCase(Locale.ROOT);
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
                vehicle.getDoors(),
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
        if (parts.isEmpty()) return "Veículo disponível no estoque";
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
        JpaIoAutoIntegrationEntity entity = integrations.findByCompanyIdAndProviderKeyIgnoreCase(companyId, normalizedProviderKey)
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
        String normalized = normalizeText(value)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9-]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        return switch (normalized) {
            case "mercado-livre", "meli" -> "mercadolivre";
            case "olx-autos" -> "olx";
            case "web-motors" -> "webmotors";
            default -> normalized;
        };
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
                throw new BusinessException("IOAUTO_PUBLIC_CATALOG_IMAGE_LIMIT", "Você pode salvar até " + MAX_PUBLIC_CATALOG_BANNER_IMAGES + " imagens no banner.");
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

    private List<Map<String, Object>> readJsonListOfObjects(String raw) {
        try {
            return OBJECT_MAPPER.readValue(normalizeText(raw, "[]"), new TypeReference<List<Map<String, Object>>>() {
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
            throw new BusinessException("IOAUTO_FINANCING_SERIALIZATION_FAILED", "Não foi possível salvar as condições de financiamento.");
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

    private String writeJsonValue(Object value, String fallbackJson) {
        if (value == null) return fallbackJson;
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception ignored) {
            return fallbackJson;
        }
    }

    private Map<String, String> readJsonStringMap(String raw) {
        try {
            return new LinkedHashMap<>(OBJECT_MAPPER.readValue(normalizeText(raw, "{}"), new TypeReference<Map<String, String>>() {
            }));
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
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
            throw new BusinessException("IOAUTO_PUBLIC_CATALOG_LEADS_INVALID_DATE", "Não foi possível interpretar uma das datas dos leads.");
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
        if ((digits.length() == 12 || digits.length() == 13) && digits.startsWith("55")) {
            digits = digits.substring(2);
        }
        return digits.matches("[1-9]{2}[2-9]\\d{7,8}") ? digits : null;
    }

    private String requirePublicLinkWhatsappNumber(String raw) {
        String normalized = sanitizeWhatsappNumber(raw);
        if (normalized == null) {
            throw new BusinessException(
                    "IOAUTO_PUBLIC_LINK_INVALID_WHATSAPP",
                    "Informe um WhatsApp válido com DDD para o link."
            );
        }
        return normalized;
    }

    private String resolvePublicLinkWhatsappNumber(
            com.io.appioweb.domain.auth.entity.Company company,
            String sourceType,
            String sourceReference
    ) {
        String companyWhatsapp = sanitizeWhatsappNumber(company.whatsappNumber());
        JpaIoAutoPublicLinkEntity link = findPublicLinkByTracking(company.id(), sourceType, sourceReference);
        if (link == null || link.isUseCompanyWhatsapp()) {
            return companyWhatsapp;
        }

        String customWhatsapp = sanitizeWhatsappNumber(link.getWhatsappNumber());
        return customWhatsapp == null ? companyWhatsapp : customWhatsapp;
    }

    private JpaIoAutoPublicLinkEntity findPublicLinkByTracking(
            UUID companyId,
            String sourceType,
            String sourceReference
    ) {
        String normalizedReference = normalizeNullableText(sourceReference);
        if (normalizedReference == null) {
            return null;
        }

        String normalizedType = normalizeNullableText(sourceType);
        return publicLinks.findAllByCompanyIdOrderByCreatedAtDesc(companyId).stream()
                .filter(link -> normalizedReference.equalsIgnoreCase(normalizeText(resolvePublicLinkTrackingSourceReference(link))))
                .filter(link -> normalizedType == null
                        || normalizedType.equalsIgnoreCase(normalizeText(resolvePublicLinkTrackingSourceType(link))))
                .findFirst()
                .orElse(null);
    }

    private UUID resolvePublicLinkResponsibleUserId(
            UUID companyId,
            String sourceType,
            String sourceReference
    ) {
        JpaIoAutoPublicLinkEntity link = findPublicLinkByTracking(companyId, sourceType, sourceReference);
        UUID responsibleUserId = link == null ? null : link.getResponsibleUserId();
        if (responsibleUserId == null) {
            responsibleUserId = parseUuidOrNull(sourceReference);
        }
        if (responsibleUserId == null) {
            return null;
        }

        return users.findByIdAndCompanyId(responsibleUserId, companyId)
                .filter(user -> user.isActive())
                .map(user -> user.id())
                .orElse(null);
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

    private String buildPublicLinkPath(String companyName, JpaIoAutoPublicLinkEntity link) {
        String basePath = "/estoque-publico/" + slugifyPublicPathSegment(companyName);
        if ("VEHICLE".equalsIgnoreCase(normalizeText(link.getScopeType())) && link.getVehicleId() != null) {
            basePath += "/veiculo/" + link.getVehicleId();
        }

        String sourceReference = resolvePublicLinkTrackingSourceReference(link);
        if (sourceReference == null) {
            return basePath;
        }

        String sourceType = normalizeText(resolvePublicLinkTrackingSourceType(link), "INFLUENCER").toLowerCase(Locale.ROOT);
        return basePath
                + "?source=" + URLEncoder.encode(sourceType, StandardCharsets.UTF_8)
                + "&ref=" + URLEncoder.encode(sourceReference, StandardCharsets.UTF_8);
    }

    private String resolvePublicLinkTrackingSourceType(JpaIoAutoPublicLinkEntity link) {
        String sourceType = normalizeNullableText(link.getSourceType());
        if (sourceType != null) {
            return sourceType.toUpperCase(Locale.ROOT);
        }
        if ("PUBLIC".equalsIgnoreCase(normalizeText(link.getLinkKind()))) {
            return "PUBLIC";
        }
        return null;
    }

    private String resolvePublicLinkTrackingSourceReference(JpaIoAutoPublicLinkEntity link) {
        String sourceReference = normalizeNullableText(link.getSourceReference());
        if (sourceReference != null) {
            return sourceReference;
        }
        if ("PUBLIC".equalsIgnoreCase(normalizeText(link.getLinkKind())) && link.getId() != null) {
            return "public-" + link.getId();
        }
        return null;
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
            throw new BusinessException("IOAUTO_PUBLIC_LINK_INVALID", "Não foi possível gerar o identificador do link.");
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

    private String resolveVehicleInterestName(UUID companyId, UUID vehicleId, String fallbackName) {
        if (vehicleId == null) {
            return trimToMaxLength(requireText(fallbackName, "Informe o nome."), 200);
        }
        JpaIoAutoVehicleEntity vehicle = vehicles.findByIdAndCompanyId(vehicleId, companyId).orElse(null);
        if (vehicle == null || normalizeNullableText(vehicle.getTitle()) == null) {
            return trimToMaxLength(requireText(fallbackName, "Informe o nome."), 200);
        }
        return trimToMaxLength(vehicle.getTitle(), 200);
    }

    private UUID parseUuidOrNull(String raw) {
        String normalized = normalizeNullableText(raw);
        if (normalized == null) return null;
        try {
            return UUID.fromString(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String normalizeVehicleTransmission(String raw) {
        return normalizeVehiclePreset(raw, VEHICLE_TRANSMISSION_OPTIONS, "cambio");
    }

    private String normalizeVehicleFuelType(String raw) {
        return normalizeVehiclePreset(raw, VEHICLE_FUEL_OPTIONS, "combustivel");
    }

    private String normalizeVehicleBodyType(String raw) {
        return normalizeVehiclePreset(raw, VEHICLE_BODY_TYPE_OPTIONS, "carroceria");
    }

    private String normalizeVehicleColor(String raw) {
        return normalizeVehiclePreset(raw, VEHICLE_COLOR_OPTIONS, "cor");
    }

    private java.math.BigDecimal normalizeConsignmentCommissionPercentage(java.math.BigDecimal raw) {
        if (raw == null) {
            return null;
        }
        java.math.BigDecimal normalized = raw.setScale(4, java.math.RoundingMode.HALF_UP);
        if (normalized.compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new BusinessException("IOAUTO_INVALID_PAYLOAD", "O percentual de comissão da consignação não pode ser negativo.");
        }
        if (normalized.compareTo(new java.math.BigDecimal("100")) > 0) {
            throw new BusinessException("IOAUTO_INVALID_PAYLOAD", "O percentual de comissão da consignação não pode ser maior que 100%.");
        }
        return normalized;
    }

    private Integer normalizeVehicleDoors(Integer raw) {
        if (raw == null) {
            return null;
        }
        if (raw < 2 || raw > 5) {
            throw new BusinessException("IOAUTO_INVALID_PAYLOAD", "Selecione uma quantidade valida de portas.");
        }
        return raw;
    }

    private String normalizeVehiclePreset(String raw, Map<String, String> allowedValues, String fieldLabel) {
        String normalized = normalizeNullableText(raw);
        if (normalized == null) {
            return null;
        }
        String key = normalizeVehicleChoiceKey(normalized);
        String canonical = allowedValues.get(key);
        if (canonical != null) {
            return canonical;
        }
        throw new BusinessException("IOAUTO_INVALID_PAYLOAD", "Selecione uma opcao valida para " + fieldLabel + ".");
    }

    private String normalizeVehicleChoiceKey(String raw) {
        return java.text.Normalizer.normalize(normalizeText(raw), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "");
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
        return !"ZAPI".equals(normalized) && !"WHATSAPP".equals(normalized) && !"SYSTEM_SALE".equals(normalized);
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

    public record IoAutoVehicleInventorySummaryHttpResponse(
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
            boolean consigned,
            String consignedOwnerName,
            java.math.BigDecimal consignmentCommissionPercentage,
            boolean featured,
            String status,
            boolean coverImageAvailable,
            List<IoAutoVehicleHttpResponse.PublicationSummary> publications,
            Instant updatedAt
    ) {
    }

    public record IoAutoVehicleOptionHttpResponse(
            UUID id,
            String title,
            String status
    ) {
    }

    private record VehicleImageContent(String contentType, byte[] bytes) {
    }

    private record PublicLinkEventStats(
            long totalInteractions,
            long contactClicks,
            long interestClicks,
            Instant lastInteractionAt
    ) {
        private static final PublicLinkEventStats EMPTY = new PublicLinkEventStats(0, 0, 0, null);
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
            Integer doors,
            String color,
            String plateFinal,
            String plate,
            String contactPhone,
            String zipcode,
            String city,
            String state,
            boolean consigned,
            String consignedOwnerName,
            java.math.BigDecimal consignmentCommissionPercentage,
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
            Integer doors,
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
            boolean canViewAllLeads,
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
                Long vehiclePriceCents,
                String publicVehiclePath,
                String sourceType,
                String sourceReference,
                String pagePath,
                String sourceUrl,
                UUID sellerUserId,
                boolean convertedToSale,
                UUID convertedSaleId,
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
            boolean useCompanyWhatsapp,
            String whatsappNumber,
            UUID responsibleUserId,
            String responsibleUserName,
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

    private IoAutoSaleCalculationService.SaleClosingCommand toSaleClosingCommand(SaleClosingFinancialHttpRequest request) {
        if (request == null) {
            return IoAutoSaleCalculationService.SaleClosingCommand.empty();
        }
        return new IoAutoSaleCalculationService.SaleClosingCommand(
                request.discountPercentage(),
                request.hasTradeInVehicle(),
                request.tradeInVehicleId(),
                request.tradeInVehicleDescription(),
                request.tradeInAmountCents(),
                request.installmentSale(),
                request.installmentCount(),
                request.firstInstallmentDueDate(),
                request.consignmentCommissionType(),
                request.consignmentCommissionPercentage(),
                request.consignmentCommissionAmountCents()
        );
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
            Integer doors,
            String color,
            String plateFinal,
            String plate,
            String contactPhone,
            String zipcode,
            String city,
            String state,
            Boolean consigned,
            String consignedOwnerName,
            java.math.BigDecimal consignmentCommissionPercentage,
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

    public record ClosePublicCatalogLeadSaleHttpRequest(
            @NotNull(message = "Informe o vendedor responsável.") UUID sellerUserId,
            @Valid SaleClosingFinancialHttpRequest financial
    ) {
    }

    public record CloseVehicleSaleHttpRequest(
            @NotNull(message = "Informe o vendedor responsável.") UUID sellerUserId
    ) {
    }

    public record SavePublicLinkHttpRequest(
            @NotBlank(message = "Informe um nome para o link.") String name,
            String linkKind,
            String scopeType,
            UUID vehicleId,
            String sourceType,
            String sourceReference,
            Boolean useCompanyWhatsapp,
            String whatsappNumber,
            @NotNull(message = "Selecione o usuário responsável pelos leads.") UUID responsibleUserId
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
