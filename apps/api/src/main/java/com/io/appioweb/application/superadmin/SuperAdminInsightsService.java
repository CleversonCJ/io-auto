package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class SuperAdminInsightsService {

    private static final List<String> DEFAULT_FEATURES = List.of(
            FeatureUsageService.FEATURE_MARKETPLACE_INTEGRATION,
            FeatureUsageService.FEATURE_OWN_SITE,
            FeatureUsageService.FEATURE_FINANCE,
            FeatureUsageService.FEATURE_REPORTS,
            FeatureUsageService.FEATURE_VEHICLE_MANAGEMENT,
            FeatureUsageService.FEATURE_LEAD_MANAGEMENT,
            FeatureUsageService.FEATURE_SALES_MANAGEMENT
    );

    private final NamedParameterJdbcTemplate jdbc;
    private final CustomerHealthScoreService healthScoreService;

    public SuperAdminInsightsService(NamedParameterJdbcTemplate jdbc, CustomerHealthScoreService healthScoreService) {
        this.jdbc = jdbc;
        this.healthScoreService = healthScoreService;
    }

    public InsightsDashboardResponse getInsights(SuperAdminFilter filter) {
        List<CustomerHealthScoreService.CustomerHealthScoreRow> healthRows = healthScoreService.listHealthScores(filter);

        List<CancellationRiskCustomer> cancellationRiskCustomers = healthRows.stream()
                .sorted(Comparator.comparing(CustomerHealthScoreService.CustomerHealthScoreRow::score))
                .limit(30)
                .map(row -> new CancellationRiskCustomer(
                        row.tenantId(),
                        row.companyName(),
                        row.planName(),
                        row.score(),
                        row.classification(),
                        row.riskLevel(),
                        row.reasons(),
                        row.lastAccessAt(),
                        row.overdueStatus()
                ))
                .toList();

        List<UpgradeReadyCustomer> upgradeReadyCustomers = buildUpgradeReadyCustomers(filter);
        List<HighRevenuePotentialCustomer> highRevenuePotentialCustomers = buildHighRevenuePotentialCustomers(filter);
        List<UnderusedFeature> underusedFeatures = buildUnderusedFeatures(filter);

        return new InsightsDashboardResponse(
                cancellationRiskCustomers,
                upgradeReadyCustomers,
                highRevenuePotentialCustomers,
                underusedFeatures
        );
    }

    private List<UpgradeReadyCustomer> buildUpgradeReadyCustomers(SuperAdminFilter filter) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("thirtyDaysAgo", Instant.now().minus(30, ChronoUnit.DAYS));
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String sql = """
                with stock as (
                    select v.company_id, count(*) as stock_count
                    from ioauto_vehicles v
                    group by v.company_id
                ),
                ads as (
                    select p.company_id,
                           sum(case when upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED') then 1 else 0 end) as active_ads
                    from ioauto_vehicle_publications p
                    group by p.company_id
                ),
                users_count as (
                    select u.company_id, count(*) as users_count
                    from users u
                    where coalesce(u.is_active, true) = true
                    group by u.company_id
                ),
                leads as (
                    select l.company_id, count(*) as leads_30d
                    from ioauto_public_catalog_leads l
                    where l.created_at >= :thirtyDaysAgo
                    group by l.company_id
                ),
                latest_billing as (
                    select distinct on (b.company_id)
                        b.company_id,
                        b.plan_name
                    from ioauto_billing_subscriptions b
                    order by b.company_id, b.updated_at desc
                )
                select
                    c.id,
                    c.name,
                    coalesce(latest_billing.plan_name, 'START') as plan_name,
                    coalesce(stock.stock_count, 0) as stock_count,
                    coalesce(ads.active_ads, 0) as active_ads,
                    coalesce(users_count.users_count, 0) as users_count,
                    coalesce(leads.leads_30d, 0) as leads_30d
                from companies c
                left join stock on stock.company_id = c.id
                left join ads on ads.company_id = c.id
                left join users_count on users_count.company_id = c.id
                left join leads on leads.company_id = c.id
                left join latest_billing on latest_billing.company_id = c.id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                """.formatted(where);

        List<UpgradeReadyCustomer> rows = new ArrayList<>();
        jdbc.query(sql, params, rs -> {
            String planName = rs.getString("plan_name");
            Limits limits = limitsForPlan(planName);
            long stockCount = rs.getLong("stock_count");
            long activeAds = rs.getLong("active_ads");
            long usersCount = rs.getLong("users_count");
            long leads30d = rs.getLong("leads_30d");

            double stockUsage = limits.stockLimit() <= 0 ? 0D : (stockCount * 100D) / limits.stockLimit();
            double adsUsage = limits.adsLimit() <= 0 ? 0D : (activeAds * 100D) / limits.adsLimit();
            double usersUsage = limits.usersLimit() <= 0 ? 0D : (usersCount * 100D) / limits.usersLimit();
            double maxUsage = Math.max(stockUsage, Math.max(adsUsage, usersUsage));
            if (maxUsage < 75D && leads30d < 12) {
                return;
            }

            List<String> reasons = new ArrayList<>();
            if (stockUsage >= 80D) reasons.add("Estoque proximo do limite do plano");
            if (adsUsage >= 80D) reasons.add("Anuncios ativos proximos do limite");
            if (usersUsage >= 80D) reasons.add("Usuarios proximos do limite");
            if (leads30d >= 12) reasons.add("Volume de leads acima da media");
            if (reasons.isEmpty()) reasons.add("Uso crescente com espaco para expansao");

            rows.add(new UpgradeReadyCustomer(
                    UUID.fromString(rs.getString("id")),
                    rs.getString("name"),
                    planName,
                    round(maxUsage),
                    stockCount,
                    activeAds,
                    usersCount,
                    leads30d,
                    reasons
            ));
        });

        rows.sort(Comparator.comparing(UpgradeReadyCustomer::usagePressurePercent).reversed());
        return rows.stream().limit(30).toList();
    }

    private List<HighRevenuePotentialCustomer> buildHighRevenuePotentialCustomers(SuperAdminFilter filter) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("ninetyDaysAgo", Instant.now().minus(90, ChronoUnit.DAYS));
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String sql = """
                with stock as (
                    select v.company_id, count(*) as stock_count
                    from ioauto_vehicles v
                    group by v.company_id
                ),
                ads as (
                    select p.company_id,
                           sum(case when upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED') then 1 else 0 end) as active_ads
                    from ioauto_vehicle_publications p
                    group by p.company_id
                ),
                leads as (
                    select l.company_id, count(*) as leads_90d
                    from ioauto_public_catalog_leads l
                    where l.created_at >= :ninetyDaysAgo
                    group by l.company_id
                ),
                sales as (
                    select s.company_id,
                           count(*) as sales_90d,
                           coalesce(sum(v.price_cents), 0) as sold_value_cents_90d
                    from atendimento_sessions s
                    left join ioauto_vehicles v on v.id = s.sold_vehicle_id
                    where s.sale_completed = true
                      and s.sale_completed_at >= :ninetyDaysAgo
                    group by s.company_id
                )
                select
                    c.id,
                    c.name,
                    coalesce(stock.stock_count, 0) as stock_count,
                    coalesce(ads.active_ads, 0) as active_ads,
                    coalesce(leads.leads_90d, 0) as leads_90d,
                    coalesce(sales.sales_90d, 0) as sales_90d,
                    coalesce(sales.sold_value_cents_90d, 0) as sold_value_cents_90d
                from companies c
                left join stock on stock.company_id = c.id
                left join ads on ads.company_id = c.id
                left join leads on leads.company_id = c.id
                left join sales on sales.company_id = c.id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                """.formatted(where);

        List<HighRevenuePotentialCustomer> rows = new ArrayList<>();
        jdbc.query(sql, params, rs -> {
            long stockCount = rs.getLong("stock_count");
            long activeAds = rs.getLong("active_ads");
            long leads90d = rs.getLong("leads_90d");
            long sales90d = rs.getLong("sales_90d");
            long soldValue90d = rs.getLong("sold_value_cents_90d");

            double score = (stockCount * 0.25D) + (activeAds * 0.25D) + (leads90d * 0.30D) + (sales90d * 12D * 0.20D);
            if (score <= 0D) return;

            rows.add(new HighRevenuePotentialCustomer(
                    UUID.fromString(rs.getString("id")),
                    rs.getString("name"),
                    round(score),
                    stockCount,
                    activeAds,
                    leads90d,
                    sales90d,
                    soldValue90d
            ));
        });

        rows.sort(Comparator.comparing(HighRevenuePotentialCustomer::potentialScore).reversed());
        return rows.stream().limit(30).toList();
    }

    private List<UnderusedFeature> buildUnderusedFeatures(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", window.fromAt())
                .addValue("windowEnd", window.toExclusiveAt());
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String activeCustomersSql = """
                select count(*)
                from companies c
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                """.formatted(where);
        long activeCustomers = jdbc.queryForObject(activeCustomersSql, params, Long.class);

        String usageSql = """
                select
                    upper(f.feature_key) as feature_key,
                    count(*) as usage_count,
                    count(distinct f.company_id) as unique_customers
                from feature_usage_events f
                join companies c on c.id = f.company_id
                %s
                and f.occurred_at >= :windowStart
                and f.occurred_at < :windowEnd
                group by upper(f.feature_key)
                """.formatted(where);

        Map<String, UsageAgg> usageByFeature = new LinkedHashMap<>();
        List<FeatureUsageAggRow> usageRows = jdbc.query(usageSql, params, (rs, rowNum) ->
                new FeatureUsageAggRow(
                        rs.getString("feature_key"),
                        rs.getLong("unique_customers"),
                        rs.getLong("usage_count")
                )
        );
        for (FeatureUsageAggRow row : usageRows) {
            usageByFeature.put(row.featureKey(), new UsageAgg(row.uniqueCustomers(), row.usageCount()));
        }

        List<UnderusedFeature> rows = new ArrayList<>();
        for (String feature : DEFAULT_FEATURES) {
            UsageAgg agg = usageByFeature.getOrDefault(feature, new UsageAgg(0L, 0L));
            double adoption = activeCustomers <= 0 ? 0D : (agg.uniqueCustomers() * 100D) / activeCustomers;
            rows.add(new UnderusedFeature(feature, agg.uniqueCustomers(), agg.usageCount(), round(adoption), adoption < 35D));
        }

        rows.sort(Comparator.comparing(UnderusedFeature::adoptionRate));
        return rows;
    }

    private Limits limitsForPlan(String planName) {
        String normalized = planName == null ? "" : planName.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains("ENTERPRISE")) return new Limits(400, 900, 80);
        if (normalized.contains("SCALE")) return new Limits(120, 260, 25);
        if (normalized.contains("PRO")) return new Limits(50, 120, 10);
        return new Limits(20, 50, 3);
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    private record Limits(long stockLimit, long adsLimit, long usersLimit) {
    }

    private record UsageAgg(long uniqueCustomers, long usageCount) {
    }

    private record FeatureUsageAggRow(String featureKey, long uniqueCustomers, long usageCount) {
    }

    public record InsightsDashboardResponse(
            List<CancellationRiskCustomer> cancellationRiskCustomers,
            List<UpgradeReadyCustomer> upgradeReadyCustomers,
            List<HighRevenuePotentialCustomer> highRevenuePotentialCustomers,
            List<UnderusedFeature> underusedFeatures
    ) {
    }

    public record CancellationRiskCustomer(
            UUID tenantId,
            String companyName,
            String planName,
            int score,
            String classification,
            String riskLevel,
            List<String> reasons,
            Instant lastAccessAt,
            boolean overdueStatus
    ) {
    }

    public record UpgradeReadyCustomer(
            UUID tenantId,
            String companyName,
            String planName,
            double usagePressurePercent,
            long stockCount,
            long activeAdsCount,
            long usersCount,
            long leads30d,
            List<String> reasons
    ) {
    }

    public record HighRevenuePotentialCustomer(
            UUID tenantId,
            String companyName,
            double potentialScore,
            long stockCount,
            long activeAdsCount,
            long leads90d,
            long sales90d,
            long soldValueCents90d
    ) {
    }

    public record UnderusedFeature(
            String featureKey,
            long uniqueCustomersCount,
            long usageCount,
            double adoptionRate,
            boolean underused
    ) {
    }
}
