package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.auth.CompanyRepositoryJpa;
import com.io.appioweb.adapters.persistence.auth.JpaCompanyEntity;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.JpaSubscriptionPlanEntity;
import com.io.appioweb.adapters.persistence.superadmin.SubscriptionPlanRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class SuperAdminPlanManagementService {

    public static final String FEATURE_OWN_SITE = "OWN_SITE";
    public static final String FEATURE_FINANCE = "FINANCE";
    public static final String FEATURE_REPORTS = "REPORTS";
    public static final String FEATURE_CRM_KANBAN = "CRM_KANBAN";
    public static final String FEATURE_LEAD_MANAGEMENT = "LEAD_MANAGEMENT";
    public static final String FEATURE_TRACKABLE_LINKS = "TRACKABLE_LINKS";
    public static final String PROVIDER_OLX = "olx";
    public static final String PROVIDER_WEBMOTORS = "webmotors";
    public static final String PROVIDER_ICARROS = "icarros";

    private static final String DEFAULT_PLAN_KEY = "start";
    private static final String DEFAULT_CUSTOM_PLAN_KEY = "personalizado";

    private final SubscriptionPlanRepositoryJpa plans;
    private final CompanyRepositoryJpa companies;
    private final UserRepositoryJpa users;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminPlanManagementService(
            SubscriptionPlanRepositoryJpa plans,
            CompanyRepositoryJpa companies,
            UserRepositoryJpa users,
            IoAutoVehicleRepositoryJpa vehicles,
            NamedParameterJdbcTemplate jdbc
    ) {
        this.plans = plans;
        this.companies = companies;
        this.users = users;
        this.vehicles = vehicles;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<PlanRow> listPlans() {
        Map<UUID, Long> assignedCounts = new HashMap<>();
        jdbc.query(
                "select plan_id, count(*) as assigned_count from companies where plan_id is not null group by plan_id",
                rs -> {
                    Object raw = rs.getObject("plan_id");
                    if (raw == null) return;
                    UUID planId = raw instanceof UUID ? (UUID) raw : UUID.fromString(String.valueOf(raw));
                    assignedCounts.put(planId, rs.getLong("assigned_count"));
                }
        );

        return plans.findAllByOrderBySortOrderAscPlanNameAsc().stream()
                .filter(plan -> !isDefaultCustomTemplate(plan))
                .map(plan -> toRow(plan, assignedCounts.getOrDefault(plan.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanOptionRow> listActivePlanOptions() {
        return plans.findAllByActiveTrueOrderBySortOrderAscPlanNameAsc().stream()
                .filter(plan -> !isDefaultCustomTemplate(plan))
                .map(this::toOptionRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanSnapshot> listActivePlanSnapshots() {
        return plans.findAllByActiveTrueOrderBySortOrderAscPlanNameAsc().stream()
                .filter(plan -> !isDefaultCustomTemplate(plan))
                .map(this::toSnapshot)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlanSnapshot getPlan(UUID planId) {
        return toSnapshot(plans.findById(planId)
                .orElseThrow(() -> new BusinessException("PLAN_NOT_FOUND", "Plano nao encontrado.")));
    }

    @Transactional(readOnly = true)
    public Optional<PlanSnapshot> resolveReferencedPlan(UUID planId, String planKey, String planName) {
        if (planId != null) {
            return plans.findById(planId).map(this::toSnapshot);
        }

        String normalizedKey = normalizePlanKey(planKey, null);
        if (normalizedKey != null) {
            return plans.findByPlanKeyIgnoreCase(normalizedKey).map(this::toSnapshot);
        }

        String normalizedName = normalizeNullable(planName);
        if (normalizedName == null) {
            return Optional.empty();
        }

        return plans.findAllByOrderBySortOrderAscPlanNameAsc().stream()
                .filter(item -> normalizedName.equalsIgnoreCase(item.getPlanName()))
                .findFirst()
                .map(this::toSnapshot);
    }

    @Transactional
    public PlanRow createPlan(SavePlanCommand command) {
        NormalizedPlanValues values = normalizeValues(null, command);
        Instant now = Instant.now();

        JpaSubscriptionPlanEntity entity = new JpaSubscriptionPlanEntity();
        entity.setId(UUID.randomUUID());
        apply(entity, values, now, true);
        return toRow(plans.save(entity), 0L);
    }

    @Transactional
    public PlanRow updatePlan(UUID planId, SavePlanCommand command) {
        JpaSubscriptionPlanEntity entity = plans.findById(planId)
                .orElseThrow(() -> new BusinessException("PLAN_NOT_FOUND", "Plano nao encontrado."));
        NormalizedPlanValues values = normalizeValues(entity.getId(), command);
        validateAssignedCompaniesWithinLimits(planId, values.usersLimit(), values.vehiclesLimit(), values.activeAdsLimit());
        apply(entity, values, Instant.now(), false);
        return toRow(plans.save(entity), countAssignedCompanies(entity.getId()));
    }

    @Transactional
    public void deletePlan(UUID planId) {
        JpaSubscriptionPlanEntity entity = plans.findById(planId)
                .orElseThrow(() -> new BusinessException("PLAN_NOT_FOUND", "Plano nao encontrado."));

        if (entity.isSystemPlan()) {
            throw new BusinessException("PLAN_DELETE_FORBIDDEN", "Os planos principais do sistema nao podem ser removidos.");
        }

        long assignedCompanies = countAssignedCompanies(planId);
        if (assignedCompanies > 0) {
            throw new BusinessException("PLAN_IN_USE", "Nao e possivel excluir um plano vinculado a empresas.");
        }

        plans.delete(entity);
    }

    @Transactional(readOnly = true)
    public PlanSnapshot resolvePlanForCompany(UUID companyId) {
        JpaCompanyEntity company = companies.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada."));

        if (company.getPlanId() != null) {
            Optional<JpaSubscriptionPlanEntity> assigned = plans.findById(company.getPlanId());
            if (assigned.isPresent()) {
                return toSnapshot(assigned.get());
            }
        }

        return plans.findByPlanKeyIgnoreCase(DEFAULT_PLAN_KEY)
                .map(this::toSnapshot)
                .orElseThrow(() -> new BusinessException("PLAN_DEFAULT_NOT_FOUND", "Plano padrao nao configurado."));
    }

    @Transactional(readOnly = true)
    public void assertUserCreationAllowed(UUID companyId) {
        PlanSnapshot plan = resolvePlanForCompany(companyId);
        if (plan.usersLimit() == null) return;
        long activeUsers = users.countByCompanyIdAndActiveTrue(companyId);
        if (activeUsers >= plan.usersLimit()) {
            throw new BusinessException(
                    "PLAN_USER_LIMIT_REACHED",
                    "O plano " + plan.planName() + " permite até " + plan.usersLimit() + " usuários ativos."
            );
        }
    }

    @Transactional(readOnly = true)
    public void assertVehicleCreationAllowed(UUID companyId) {
        PlanSnapshot plan = resolvePlanForCompany(companyId);
        if (plan.vehiclesLimit() == null) return;
        long activeVehicles = vehicles.countActiveByCompanyId(companyId);
        if (activeVehicles >= plan.vehiclesLimit()) {
            throw new BusinessException(
                    "PLAN_VEHICLE_LIMIT_REACHED",
                    "O plano " + plan.planName() + " permite até " + plan.vehiclesLimit() + " veículos ativos."
            );
        }
    }

    @Transactional(readOnly = true)
    public void assertFeatureEnabled(UUID companyId, String featureKey) {
        PlanSnapshot plan = resolvePlanForCompany(companyId);
        if (isFeatureEnabled(plan, featureKey)) {
            return;
        }
        throw new BusinessException(
                "PLAN_FEATURE_NOT_INCLUDED",
                "O recurso solicitado nao esta disponivel no plano " + plan.planName() + "."
        );
    }

    @Transactional(readOnly = true)
    public void assertProviderIntegrationEnabled(UUID companyId, String providerKey) {
        String normalizedProvider = normalizeProviderKey(providerKey);
        if (PROVIDER_OLX.equals(normalizedProvider)) {
            assertFeatureEnabled(companyId, "OLX");
            return;
        }
        if (PROVIDER_WEBMOTORS.equals(normalizedProvider)) {
            assertFeatureEnabled(companyId, "WEBMOTORS");
            return;
        }
        if (PROVIDER_ICARROS.equals(normalizedProvider)) {
            assertFeatureEnabled(companyId, "ICARROS");
        }
    }

    @Transactional(readOnly = true)
    public void assertTenantFitsPlan(UUID companyId, PlanSnapshot plan) {
        PlanCompatibility compatibility = evaluateTenantPlanCompatibility(companyId, plan);
        if (compatibility.eligible()) {
            return;
        }

        String message = compatibility.blockingReasons().isEmpty()
                ? "A conta nao cabe no plano " + plan.planName() + "."
                : compatibility.blockingReasons().get(0);
        throw new BusinessException("PLAN_ASSIGNMENT_INVALID", message);
    }

    @Transactional(readOnly = true)
    public TenantPlanUsage getTenantPlanUsage(UUID companyId) {
        ensureTenantExists(companyId);

        MapSqlParameterSource params = new MapSqlParameterSource("companyId", companyId);
        return jdbc.queryForObject(
                """
                select
                    (select count(*)
                     from users u
                     where u.company_id = :companyId
                       and coalesce(u.is_active, true) = true) as active_users,
                    (select count(*)
                     from ioauto_vehicles v
                     where v.company_id = :companyId
                       and upper(coalesce(v.status, 'DRAFT')) not in ('DRAFT', 'ARCHIVED', 'SOLD', 'REMOVED')) as active_vehicles,
                    (select count(*)
                     from ioauto_vehicle_publications p
                     where p.company_id = :companyId
                       and upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED')) as active_ads,
                    (select count(*)
                     from ioauto_integrations i
                     where i.company_id = :companyId
                       and upper(coalesce(i.status, '')) in ('CONNECTED', 'ACTIVE')) as connected_integrations,
                    (select count(*)
                     from ioauto_integrations i
                     where i.company_id = :companyId
                       and lower(coalesce(i.provider_key, '')) = 'webmotors'
                       and upper(coalesce(i.status, '')) in ('CONNECTED', 'ACTIVE')) as webmotors_integrations,
                    (select count(*)
                     from ioauto_integrations i
                     where i.company_id = :companyId
                       and lower(coalesce(i.provider_key, '')) = 'olx'
                       and upper(coalesce(i.status, '')) in ('CONNECTED', 'ACTIVE')) as olx_integrations,
                    (select count(*)
                     from ioauto_integrations i
                     where i.company_id = :companyId
                       and lower(coalesce(i.provider_key, '')) = 'icarros'
                       and upper(coalesce(i.status, '')) in ('CONNECTED', 'ACTIVE')) as icarros_integrations,
                    (select count(*)
                     from ioauto_public_links l
                     where l.company_id = :companyId) as public_links,
                    (select count(*)
                     from ioauto_public_links l
                     where l.company_id = :companyId
                       and upper(coalesce(l.link_kind, 'PUBLIC')) <> 'PUBLIC') as tracked_links,
                    (select count(*)
                     from ioauto_public_catalog_leads l
                     where l.company_id = :companyId) as catalog_leads,
                    (select count(*)
                     from ioauto_public_lead_events e
                     where e.company_id = :companyId) as public_lead_events,
                    (select count(*)
                     from ioauto_public_lead_events e
                     where e.company_id = :companyId
                       and coalesce(nullif(e.source_reference, ''), nullif(e.source_type, '')) is not null) as tracked_lead_events,
                    (select count(*)
                     from ioauto_financial_entries f
                     where f.company_id = :companyId) as financial_entries,
                    (select count(*)
                     from ioauto_dre_subcategories d
                     where d.company_id = :companyId) as dre_subcategories,
                    (select count(*)
                     from feature_usage_events e
                     where e.company_id = :companyId
                       and upper(coalesce(e.feature_key, '')) = 'REPORTS') as report_events,
                    exists(
                        select 1
                        from crm_company_state c
                        where c.company_id = :companyId
                          and (
                              coalesce(c.stages_json, '[]') <> '[]'
                              or coalesce(c.custom_fields_json, '[]') <> '[]'
                              or coalesce(c.lead_stage_map_json, '{}') <> '{}'
                              or coalesce(c.lead_field_values_json, '{}') <> '{}'
                          )
                    ) as crm_customized,
                    exists(
                        select 1
                        from companies c
                        where c.id = :companyId
                          and (
                              coalesce(nullif(c.public_stock_banner_mode, ''), 'default') <> 'default'
                              or coalesce(nullif(c.public_stock_banner_images_json, ''), '[]') <> '[]'
                          )
                    ) as storefront_customized
                """,
                params,
                (rs, rowNum) -> new TenantPlanUsage(
                        rs.getLong("active_users"),
                        rs.getLong("active_vehicles"),
                        rs.getLong("active_ads"),
                        rs.getLong("connected_integrations"),
                        rs.getLong("webmotors_integrations"),
                        rs.getLong("olx_integrations"),
                        rs.getLong("icarros_integrations"),
                        rs.getLong("public_links"),
                        rs.getLong("tracked_links"),
                        rs.getLong("catalog_leads"),
                        rs.getLong("public_lead_events"),
                        rs.getLong("tracked_lead_events"),
                        rs.getLong("financial_entries"),
                        rs.getLong("dre_subcategories"),
                        rs.getLong("report_events"),
                        rs.getBoolean("crm_customized"),
                        rs.getBoolean("storefront_customized")
                )
        );
    }

    @Transactional(readOnly = true)
    public PlanCompatibility evaluateTenantPlanCompatibility(UUID companyId, PlanSnapshot plan) {
        return evaluateTenantPlanCompatibility(getTenantPlanUsage(companyId), plan);
    }

    @Transactional(readOnly = true)
    public PlanCompatibility evaluateTenantPlanCompatibility(TenantPlanUsage usage, PlanSnapshot plan) {
        List<String> blockingReasons = new java.util.ArrayList<>();

        if (plan.usersLimit() != null && usage.activeUsers() > plan.usersLimit()) {
            blockingReasons.add("A conta já possui " + usage.activeUsers() + " usuários ativos e o plano " + plan.planName() + " suporta até " + plan.usersLimit() + ".");
        }
        if (plan.vehiclesLimit() != null && usage.activeVehicles() > plan.vehiclesLimit()) {
            blockingReasons.add("A conta já possui " + usage.activeVehicles() + " veículos ativos e o plano " + plan.planName() + " suporta até " + plan.vehiclesLimit() + ".");
        }
        if (plan.activeAdsLimit() != null && usage.activeAds() > plan.activeAdsLimit()) {
            blockingReasons.add("A conta já possui " + usage.activeAds() + " anúncios ativos e o plano " + plan.planName() + " suporta até " + plan.activeAdsLimit() + ".");
        }

        boolean ownSiteInUse = usage.publicLinks() > 0 || usage.catalogLeads() > 0 || usage.publicLeadEvents() > 0 || usage.storefrontCustomized();
        if (ownSiteInUse && !(plan.features().catalogBioLink() || plan.features().storefrontPage())) {
            blockingReasons.add("A conta já utiliza o módulo de site próprio/catálogo público e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if ((usage.trackedLinks() > 0 || usage.trackedLeadEvents() > 0) && !plan.features().trackableLinks()) {
            blockingReasons.add("A conta já utiliza links rastreáveis e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.catalogLeads() > 0 && !plan.features().leadManagement()) {
            blockingReasons.add("A conta já possui leads capturados pelo catálogo e o plano " + plan.planName() + " não inclui gestão de leads.");
        }
        if ((usage.financialEntries() > 0 || usage.dreSubcategories() > 0) && !plan.features().finance()) {
            blockingReasons.add("A conta já utiliza o módulo financeiro e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.reportEvents() > 0 && !plan.features().reports()) {
            blockingReasons.add("A conta já utiliza o módulo de relatórios e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.crmCustomized() && !plan.features().crmKanban()) {
            blockingReasons.add("A conta já possui configuração ativa de CRM Kanban e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.webmotorsIntegrations() > 0 && !plan.features().webmotors()) {
            blockingReasons.add("A conta já possui integração ativa com Webmotors e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.olxIntegrations() > 0 && !plan.features().olx()) {
            blockingReasons.add("A conta já possui integração ativa com OLX e o plano " + plan.planName() + " não inclui esse recurso.");
        }
        if (usage.icarrosIntegrations() > 0 && !plan.features().icarros()) {
            blockingReasons.add("A conta já possui integração ativa com iCarros e o plano " + plan.planName() + " não inclui esse recurso.");
        }

        return new PlanCompatibility(blockingReasons.isEmpty(), blockingReasons, usage);
    }

    private boolean isFeatureEnabled(PlanSnapshot plan, String featureKey) {
        String normalized = normalizeText(featureKey);
        return switch (normalized) {
            case FEATURE_OWN_SITE -> plan.features().catalogBioLink() || plan.features().storefrontPage();
            case FEATURE_FINANCE -> plan.features().finance();
            case FEATURE_REPORTS -> plan.features().reports();
            case FEATURE_CRM_KANBAN -> plan.features().crmKanban();
            case FEATURE_LEAD_MANAGEMENT -> plan.features().leadManagement();
            case FEATURE_TRACKABLE_LINKS -> plan.features().trackableLinks();
            case "WEBMOTORS" -> plan.features().webmotors();
            case "OLX" -> plan.features().olx();
            case "ICARROS" -> plan.features().icarros();
            default -> true;
        };
    }

    private void ensureTenantExists(UUID companyId) {
        if (!companies.existsById(companyId)) {
            throw new BusinessException("COMPANY_NOT_FOUND", "Empresa nao encontrada.");
        }
    }

    private long countAssignedCompanies(UUID planId) {
        Long count = jdbc.queryForObject(
                "select count(*) from companies where plan_id = :planId",
                new MapSqlParameterSource("planId", planId),
                Long.class
        );
        return count == null ? 0L : count;
    }

    private long countActiveAds(UUID companyId) {
        Long count = jdbc.queryForObject(
                """
                select count(*)
                from ioauto_vehicle_publications p
                where p.company_id = :companyId
                  and upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED')
                """,
                new MapSqlParameterSource("companyId", companyId),
                Long.class
        );
        return count == null ? 0L : count;
    }

    private void validateAssignedCompaniesWithinLimits(UUID planId, Integer usersLimit, Integer vehiclesLimit, Integer activeAdsLimit) {
        if (usersLimit == null && vehiclesLimit == null && activeAdsLimit == null) {
            return;
        }

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("planId", planId)
                .addValue("usersLimit", usersLimit)
                .addValue("vehiclesLimit", vehiclesLimit)
                .addValue("activeAdsLimit", activeAdsLimit);

        List<String> violatingCompanies = jdbc.query(
                """
                with user_counts as (
                    select u.company_id, count(*) as users_count
                    from users u
                    where coalesce(u.is_active, true) = true
                    group by u.company_id
                ),
                vehicle_counts as (
                    select v.company_id, count(*) as vehicles_count
                    from ioauto_vehicles v
                    where upper(coalesce(v.status, 'DRAFT')) not in ('DRAFT', 'ARCHIVED', 'SOLD', 'REMOVED')
                    group by v.company_id
                ),
                publication_counts as (
                    select p.company_id, count(*) as active_ads_count
                    from ioauto_vehicle_publications p
                    where upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED')
                    group by p.company_id
                )
                select c.name
                from companies c
                left join user_counts on user_counts.company_id = c.id
                left join vehicle_counts on vehicle_counts.company_id = c.id
                left join publication_counts on publication_counts.company_id = c.id
                where c.plan_id = :planId
                  and (
                      (:usersLimit is not null and coalesce(user_counts.users_count, 0) > :usersLimit)
                      or (:vehiclesLimit is not null and coalesce(vehicle_counts.vehicles_count, 0) > :vehiclesLimit)
                      or (:activeAdsLimit is not null and coalesce(publication_counts.active_ads_count, 0) > :activeAdsLimit)
                  )
                order by c.name asc
                limit 3
                """,
                params,
                (rs, rowNum) -> rs.getString("name")
        );

        if (!violatingCompanies.isEmpty()) {
            throw new BusinessException(
                    "PLAN_LIMIT_UPDATE_INVALID",
                    "Nao foi possivel salvar os novos limites porque as contas " + String.join(", ", violatingCompanies) + " excedem esse plano."
            );
        }
    }

    private void apply(JpaSubscriptionPlanEntity entity, NormalizedPlanValues values, Instant now, boolean creating) {
        entity.setPlanKey(values.planKey());
        entity.setPlanName(values.planName());
        entity.setDescription(values.description());
        entity.setBillingRecurrence(values.billingRecurrence());
        entity.setPriceCents(values.priceCents());
        entity.setMonthlyPriceCents(values.monthlyPriceCents());
        entity.setAnnualPriceCents(values.annualPriceCents());
        entity.setCustomPlan(values.customPlan());
        entity.setSystemPlan(values.systemPlan());
        entity.setActive(values.active());
        entity.setSortOrder(values.sortOrder());
        entity.setUsersLimit(values.usersLimit());
        entity.setVehiclesLimit(values.vehiclesLimit());
        entity.setActiveAdsLimit(values.activeAdsLimit());
        entity.setFeatureCatalogBioLink(values.features().catalogBioLink());
        entity.setFeatureWhatsappSharing(values.features().whatsappSharing());
        entity.setFeatureStorefrontPage(values.features().storefrontPage());
        entity.setFeatureWebmotors(values.features().webmotors());
        entity.setFeatureOlx(values.features().olx());
        entity.setFeatureIcarros(values.features().icarros());
        entity.setFeatureCrmKanban(values.features().crmKanban());
        entity.setFeatureLeadManagement(values.features().leadManagement());
        entity.setFeatureFinance(values.features().finance());
        entity.setFeatureReports(values.features().reports());
        entity.setFeatureTrackableLinks(values.features().trackableLinks());
        entity.setFeatureMultiunits(values.features().multiunits());
        entity.setFeatureAdvancedMultiuser(values.features().advancedMultiuser());
        entity.setFeatureExecutiveDashboard(values.features().executiveDashboard());
        entity.setFeatureIntegrationsApi(values.features().integrationsApi());
        entity.setFeatureAssistedOnboarding(values.features().assistedOnboarding());
        entity.setFeaturePrioritySupport(values.features().prioritySupport());
        entity.setFeatureCustomizations(values.features().customizations());
        if (creating) {
            entity.setCreatedAt(now);
        }
        entity.setUpdatedAt(now);
    }

    private NormalizedPlanValues normalizeValues(UUID planId, SavePlanCommand command) {
        String planName = normalizeNullable(command.planName());
        if (planName == null) {
            throw new BusinessException("PLAN_NAME_REQUIRED", "Informe o nome do plano.");
        }

        String requestedPlanKey = normalizeNullable(command.planKey());
        if (requestedPlanKey == null) {
            throw new BusinessException("PLAN_KEY_REQUIRED", "Informe a chave tecnica do plano.");
        }

        String planKey = normalizePlanKey(requestedPlanKey, planName);
        if (planKey == null) {
            throw new BusinessException("PLAN_KEY_REQUIRED", "Nao foi possivel gerar a chave do plano.");
        }

        String description = normalizeNullable(command.description());
        if (description == null) {
            throw new BusinessException("PLAN_DESCRIPTION_REQUIRED", "Informe a descricao do plano.");
        }

        boolean keyTaken = planId == null
                ? plans.existsByPlanKeyIgnoreCase(planKey)
                : plans.existsByPlanKeyIgnoreCaseAndIdNot(planKey, planId);
        if (keyTaken) {
            throw new BusinessException("PLAN_KEY_ALREADY_EXISTS", "Ja existe um plano com esta chave.");
        }

        String legacyBillingRecurrence = normalizeRecurrence(command.billingRecurrence());
        Long legacyPriceCents = normalizePrice(command.priceCents());
        Long monthlyPriceCents = normalizePrice(command.monthlyPriceCents());
        Long annualPriceCents = normalizePrice(command.annualPriceCents());

        if (monthlyPriceCents == null) {
            throw new BusinessException("PLAN_MONTHLY_PRICE_REQUIRED", "Informe o valor mensal do plano.");
        }
        if (annualPriceCents == null) {
            throw new BusinessException("PLAN_ANNUAL_PRICE_REQUIRED", "Informe o valor anual do plano.");
        }

        Integer usersLimit = normalizeLimit(command.usersLimit());
        Integer vehiclesLimit = normalizeLimit(command.vehiclesLimit());
        Integer activeAdsLimit = normalizeLimit(command.activeAdsLimit());
        if (command.sortOrder() == null) {
            throw new BusinessException("PLAN_SORT_ORDER_REQUIRED", "Informe a ordem visual do plano.");
        }
        if (usersLimit == null) {
            throw new BusinessException("PLAN_USERS_LIMIT_REQUIRED", "Informe o limite de usuarios do plano.");
        }
        if (vehiclesLimit == null) {
            throw new BusinessException("PLAN_VEHICLES_LIMIT_REQUIRED", "Informe o limite de veiculos ativos do plano.");
        }
        if (activeAdsLimit == null) {
            throw new BusinessException("PLAN_ACTIVE_ADS_LIMIT_REQUIRED", "Informe o limite de anuncios ativos do plano.");
        }

        if (legacyPriceCents != null) {
            if ("ANNUAL".equals(legacyBillingRecurrence)) {
                annualPriceCents = annualPriceCents == null ? legacyPriceCents : annualPriceCents;
            } else {
                monthlyPriceCents = monthlyPriceCents == null ? legacyPriceCents : monthlyPriceCents;
            }
        }

        String billingRecurrence = resolveDefaultBillingRecurrence(monthlyPriceCents, annualPriceCents, legacyBillingRecurrence);
        Long priceCents = resolveDefaultPriceCents(monthlyPriceCents, annualPriceCents, billingRecurrence);

        return new NormalizedPlanValues(
                planKey,
                planName,
                description,
                billingRecurrence,
                priceCents,
                monthlyPriceCents,
                annualPriceCents,
                Boolean.TRUE.equals(command.customPlan()),
                Boolean.TRUE.equals(command.systemPlan()),
                command.active() == null || command.active(),
                command.sortOrder() == null ? 0 : command.sortOrder(),
                usersLimit,
                vehiclesLimit,
                activeAdsLimit,
                new PlanFeatures(
                        Boolean.TRUE.equals(command.featureCatalogBioLink()),
                        Boolean.TRUE.equals(command.featureWhatsappSharing()),
                        Boolean.TRUE.equals(command.featureStorefrontPage()),
                        Boolean.TRUE.equals(command.featureWebmotors()),
                        Boolean.TRUE.equals(command.featureOlx()),
                        Boolean.TRUE.equals(command.featureIcarros()),
                        Boolean.TRUE.equals(command.featureCrmKanban()),
                        Boolean.TRUE.equals(command.featureLeadManagement()),
                        Boolean.TRUE.equals(command.featureFinance()),
                        Boolean.TRUE.equals(command.featureReports()),
                        Boolean.TRUE.equals(command.featureTrackableLinks()),
                        Boolean.TRUE.equals(command.featureMultiunits()),
                        Boolean.TRUE.equals(command.featureAdvancedMultiuser()),
                        Boolean.TRUE.equals(command.featureExecutiveDashboard()),
                        Boolean.TRUE.equals(command.featureIntegrationsApi()),
                        Boolean.TRUE.equals(command.featureAssistedOnboarding()),
                        Boolean.TRUE.equals(command.featurePrioritySupport()),
                        Boolean.TRUE.equals(command.featureCustomizations())
                )
        );
    }

    private PlanRow toRow(JpaSubscriptionPlanEntity entity, long assignedCompaniesCount) {
        return new PlanRow(
                entity.getId(),
                entity.getPlanKey(),
                entity.getPlanName(),
                entity.getDescription(),
                entity.getBillingRecurrence(),
                entity.getPriceCents(),
                entity.getMonthlyPriceCents(),
                entity.getAnnualPriceCents(),
                entity.isCustomPlan(),
                entity.isSystemPlan(),
                entity.isActive(),
                entity.getSortOrder(),
                entity.getUsersLimit(),
                entity.getVehiclesLimit(),
                entity.getActiveAdsLimit(),
                toFeatures(entity),
                assignedCompaniesCount,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private PlanOptionRow toOptionRow(JpaSubscriptionPlanEntity entity) {
        return new PlanOptionRow(
                entity.getId(),
                entity.getPlanKey(),
                entity.getPlanName(),
                entity.getBillingRecurrence(),
                entity.getPriceCents(),
                entity.getMonthlyPriceCents(),
                entity.getAnnualPriceCents(),
                entity.isCustomPlan(),
                entity.getUsersLimit(),
                entity.getVehiclesLimit(),
                entity.getActiveAdsLimit()
        );
    }

    private PlanSnapshot toSnapshot(JpaSubscriptionPlanEntity entity) {
        return new PlanSnapshot(
                entity.getId(),
                entity.getPlanKey(),
                entity.getPlanName(),
                entity.getBillingRecurrence(),
                entity.getPriceCents(),
                entity.getMonthlyPriceCents(),
                entity.getAnnualPriceCents(),
                entity.getUsersLimit(),
                entity.getVehiclesLimit(),
                entity.getActiveAdsLimit(),
                toFeatures(entity)
        );
    }

    private PlanFeatures toFeatures(JpaSubscriptionPlanEntity entity) {
        return new PlanFeatures(
                entity.isFeatureCatalogBioLink(),
                entity.isFeatureWhatsappSharing(),
                entity.isFeatureStorefrontPage(),
                entity.isFeatureWebmotors(),
                entity.isFeatureOlx(),
                entity.isFeatureIcarros(),
                entity.isFeatureCrmKanban(),
                entity.isFeatureLeadManagement(),
                entity.isFeatureFinance(),
                entity.isFeatureReports(),
                entity.isFeatureTrackableLinks(),
                entity.isFeatureMultiunits(),
                entity.isFeatureAdvancedMultiuser(),
                entity.isFeatureExecutiveDashboard(),
                entity.isFeatureIntegrationsApi(),
                entity.isFeatureAssistedOnboarding(),
                entity.isFeaturePrioritySupport(),
                entity.isFeatureCustomizations()
        );
    }

    private String normalizeRecurrence(String raw) {
        String normalized = normalizeNullable(raw);
        if (normalized == null) return null;
        String upper = normalized.toUpperCase(Locale.ROOT);
        if ("MONTH".equals(upper) || "MONTHLY".equals(upper) || "MENSAL".equals(upper)) return "MONTHLY";
        if ("QUARTERLY".equals(upper) || "TRIMESTRAL".equals(upper)) return "QUARTERLY";
        if ("SEMIANNUALLY".equals(upper) || "SEMIANNUAL".equals(upper) || "SEMESTRAL".equals(upper)) return "SEMIANNUALLY";
        if ("YEAR".equals(upper) || "YEARLY".equals(upper) || "ANNUAL".equals(upper) || "ANUAL".equals(upper)) return "ANNUAL";
        throw new BusinessException("PLAN_RECURRENCE_INVALID", "Recorrencia do plano invalida.");
    }

    private String resolveDefaultBillingRecurrence(Long monthlyPriceCents, Long annualPriceCents, String fallback) {
        if (monthlyPriceCents != null) return "MONTHLY";
        if (annualPriceCents != null) return "ANNUAL";
        return fallback;
    }

    private Long resolveDefaultPriceCents(Long monthlyPriceCents, Long annualPriceCents, String billingRecurrence) {
        if ("QUARTERLY".equals(billingRecurrence) || "SEMIANNUALLY".equals(billingRecurrence)) {
            return null;
        }
        if ("ANNUAL".equals(billingRecurrence)) {
            return annualPriceCents != null ? annualPriceCents : monthlyPriceCents;
        }
        if ("MONTHLY".equals(billingRecurrence)) {
            return monthlyPriceCents != null ? monthlyPriceCents : annualPriceCents;
        }
        return monthlyPriceCents != null ? monthlyPriceCents : annualPriceCents;
    }

    private boolean isDefaultCustomTemplate(JpaSubscriptionPlanEntity entity) {
        return entity.isSystemPlan() && DEFAULT_CUSTOM_PLAN_KEY.equalsIgnoreCase(normalizeText(entity.getPlanKey()));
    }

    private String normalizePlanKey(String raw, String fallbackName) {
        String source = normalizeNullable(raw);
        if (source == null) {
            source = normalizeNullable(fallbackName);
        }
        if (source == null) return null;
        String normalized = source
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        return normalized.isBlank() ? null : normalized;
    }

    private Integer normalizeLimit(Integer value) {
        if (value == null || value <= 0) return null;
        return value;
    }

    private Long normalizePrice(Long value) {
        if (value == null || value <= 0L) return null;
        return value;
    }

    private String normalizeNullable(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeProviderKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private record NormalizedPlanValues(
            String planKey,
            String planName,
            String description,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            boolean customPlan,
            boolean systemPlan,
            boolean active,
            int sortOrder,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            PlanFeatures features
    ) {
    }

    public record PlanFeatures(
            boolean catalogBioLink,
            boolean whatsappSharing,
            boolean storefrontPage,
            boolean webmotors,
            boolean olx,
            boolean icarros,
            boolean crmKanban,
            boolean leadManagement,
            boolean finance,
            boolean reports,
            boolean trackableLinks,
            boolean multiunits,
            boolean advancedMultiuser,
            boolean executiveDashboard,
            boolean integrationsApi,
            boolean assistedOnboarding,
            boolean prioritySupport,
            boolean customizations
    ) {
    }

    public record TenantPlanUsage(
            long activeUsers,
            long activeVehicles,
            long activeAds,
            long connectedIntegrations,
            long webmotorsIntegrations,
            long olxIntegrations,
            long icarrosIntegrations,
            long publicLinks,
            long trackedLinks,
            long catalogLeads,
            long publicLeadEvents,
            long trackedLeadEvents,
            long financialEntries,
            long dreSubcategories,
            long reportEvents,
            boolean crmCustomized,
            boolean storefrontCustomized
    ) {
    }

    public record PlanCompatibility(
            boolean eligible,
            List<String> blockingReasons,
            TenantPlanUsage usage
    ) {
    }

    public record PlanRow(
            UUID planId,
            String planKey,
            String planName,
            String description,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            boolean customPlan,
            boolean systemPlan,
            boolean active,
            int sortOrder,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            PlanFeatures features,
            long assignedCompaniesCount,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record PlanOptionRow(
            UUID planId,
            String planKey,
            String planName,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            boolean customPlan,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit
    ) {
    }

    public record PlanSnapshot(
            UUID planId,
            String planKey,
            String planName,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            PlanFeatures features
    ) {
        public Long priceForRecurrence(String recurrence) {
            String normalized = recurrence == null ? "" : recurrence.trim().toUpperCase(Locale.ROOT);
            if ("QUARTERLY".equals(normalized) || "SEMIANNUALLY".equals(normalized)) {
                if (normalized.equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")) {
                    return priceCents;
                }
                return null;
            }
            if ("ANNUAL".equals(normalized) || "YEARLY".equals(normalized) || "YEAR".equals(normalized)) {
                if (annualPriceCents != null) return annualPriceCents;
                if ("ANNUAL".equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")
                        || "YEARLY".equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")
                        || "YEAR".equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")) {
                    return priceCents != null ? priceCents : monthlyPriceCents;
                }
                return priceCents != null && annualPriceCents == null && monthlyPriceCents == null ? priceCents : monthlyPriceCents;
            }
            if ("MONTHLY".equals(normalized) || "MONTH".equals(normalized)) {
                if (monthlyPriceCents != null) return monthlyPriceCents;
                if ("MONTHLY".equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")
                        || "MONTH".equals(billingRecurrence != null ? billingRecurrence.trim().toUpperCase(Locale.ROOT) : "")) {
                    return priceCents != null ? priceCents : annualPriceCents;
                }
                return priceCents != null && monthlyPriceCents == null && annualPriceCents == null ? priceCents : annualPriceCents;
            }
            return null;
        }

        public List<String> supportedBillingIntervals() {
            List<String> intervals = new ArrayList<>();
            if (monthlyPriceCents != null) intervals.add("MONTHLY");
            if (annualPriceCents != null) intervals.add("ANNUAL");
            String normalizedDefault = billingRecurrence == null ? "" : billingRecurrence.trim().toUpperCase(Locale.ROOT);
            if (priceCents != null && !normalizedDefault.isBlank() && !intervals.contains(normalizedDefault)) {
                intervals.add(normalizedDefault);
            }
            if (intervals.isEmpty() && !normalizedDefault.isBlank()) {
                intervals.add(normalizedDefault);
            }
            return List.copyOf(intervals);
        }

        public Map<String, Long> priceByInterval() {
            Map<String, Long> prices = new LinkedHashMap<>();
            for (String interval : supportedBillingIntervals()) {
                Long amount = priceForRecurrence(interval);
                if (amount != null) {
                    prices.put(interval, amount);
                }
            }
            return Map.copyOf(prices);
        }
    }

    public record SavePlanCommand(
            String planName,
            String planKey,
            String description,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            Boolean customPlan,
            Boolean systemPlan,
            Boolean active,
            Integer sortOrder,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            Boolean featureCatalogBioLink,
            Boolean featureWhatsappSharing,
            Boolean featureStorefrontPage,
            Boolean featureWebmotors,
            Boolean featureOlx,
            Boolean featureIcarros,
            Boolean featureCrmKanban,
            Boolean featureLeadManagement,
            Boolean featureFinance,
            Boolean featureReports,
            Boolean featureTrackableLinks,
            Boolean featureMultiunits,
            Boolean featureAdvancedMultiuser,
            Boolean featureExecutiveDashboard,
            Boolean featureIntegrationsApi,
            Boolean featureAssistedOnboarding,
            Boolean featurePrioritySupport,
            Boolean featureCustomizations
    ) {
    }
}
