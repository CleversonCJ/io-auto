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
import java.util.HashMap;
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
                .map(plan -> toRow(plan, assignedCounts.getOrDefault(plan.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanOptionRow> listActivePlanOptions() {
        return plans.findAllByActiveTrueOrderBySortOrderAscPlanNameAsc().stream()
                .map(this::toOptionRow)
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
                    "O plano " + plan.planName() + " permite ate " + plan.usersLimit() + " usuarios ativos."
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
                    "O plano " + plan.planName() + " permite ate " + plan.vehiclesLimit() + " veiculos ativos."
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
        long activeUsers = users.countByCompanyIdAndActiveTrue(companyId);
        long activeVehicles = vehicles.countActiveByCompanyId(companyId);
        long activeAds = countActiveAds(companyId);

        if (plan.usersLimit() != null && activeUsers > plan.usersLimit()) {
            throw new BusinessException(
                    "PLAN_ASSIGNMENT_INVALID",
                    "A conta ja possui " + activeUsers + " usuarios ativos e nao cabe no limite do plano " + plan.planName() + "."
            );
        }
        if (plan.vehiclesLimit() != null && activeVehicles > plan.vehiclesLimit()) {
            throw new BusinessException(
                    "PLAN_ASSIGNMENT_INVALID",
                    "A conta ja possui " + activeVehicles + " veiculos ativos e nao cabe no limite do plano " + plan.planName() + "."
            );
        }
        if (plan.activeAdsLimit() != null && activeAds > plan.activeAdsLimit()) {
            throw new BusinessException(
                    "PLAN_ASSIGNMENT_INVALID",
                    "A conta ja possui " + activeAds + " anuncios ativos e nao cabe no limite do plano " + plan.planName() + "."
            );
        }
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

        String planKey = normalizePlanKey(command.planKey(), planName);
        if (planKey == null) {
            throw new BusinessException("PLAN_KEY_REQUIRED", "Nao foi possivel gerar a chave do plano.");
        }

        boolean keyTaken = planId == null
                ? plans.existsByPlanKeyIgnoreCase(planKey)
                : plans.existsByPlanKeyIgnoreCaseAndIdNot(planKey, planId);
        if (keyTaken) {
            throw new BusinessException("PLAN_KEY_ALREADY_EXISTS", "Ja existe um plano com esta chave.");
        }

        return new NormalizedPlanValues(
                planKey,
                planName,
                normalizeNullable(command.description()),
                normalizeRecurrence(command.billingRecurrence()),
                normalizePrice(command.priceCents()),
                Boolean.TRUE.equals(command.customPlan()),
                Boolean.TRUE.equals(command.systemPlan()),
                command.active() == null || command.active(),
                command.sortOrder() == null ? 0 : command.sortOrder(),
                normalizeLimit(command.usersLimit()),
                normalizeLimit(command.vehiclesLimit()),
                normalizeLimit(command.activeAdsLimit()),
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
        if ("YEAR".equals(upper) || "YEARLY".equals(upper) || "ANNUAL".equals(upper) || "ANUAL".equals(upper)) return "ANNUAL";
        throw new BusinessException("PLAN_RECURRENCE_INVALID", "Recorrencia do plano invalida.");
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

    public record PlanRow(
            UUID planId,
            String planKey,
            String planName,
            String description,
            String billingRecurrence,
            Long priceCents,
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
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            PlanFeatures features
    ) {
    }

    public record SavePlanCommand(
            String planName,
            String planKey,
            String description,
            String billingRecurrence,
            Long priceCents,
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
