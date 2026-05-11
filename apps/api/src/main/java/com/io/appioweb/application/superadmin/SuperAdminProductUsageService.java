package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
public class SuperAdminProductUsageService {

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminProductUsageService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ProductUsageDashboardResponse getDashboard(SuperAdminFilter filter, String periodPreset) {
        SuperAdminTimeWindow usageWindow = resolveUsageWindow(filter, periodPreset);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("usageStart", usageWindow.fromAt())
                .addValue("usageEnd", usageWindow.toExclusiveAt());
        StringBuilder companyWhere = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(companyWhere, params, filter, "c");

        String activeCustomersSql = """
                select count(*)
                from companies c
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                """.formatted(companyWhere);
        long activeCustomers = jdbc.queryForObject(activeCustomersSql, params, Long.class);

        String totalVehiclesSql = """
                select count(*)
                from ioauto_vehicles v
                join companies c on c.id = v.company_id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                """.formatted(companyWhere);
        long totalVehicles = jdbc.queryForObject(totalVehiclesSql, params, Long.class);

        String activePublicationsSql = """
                select count(*)
                from ioauto_vehicle_publications p
                join companies c on c.id = p.company_id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                and upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED')
                """.formatted(companyWhere);
        long activeMarketplaceAds = jdbc.queryForObject(activePublicationsSql, params, Long.class);

        String activeIntegrationsSql = """
                select count(*)
                from ioauto_integrations i
                join companies c on c.id = i.company_id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                and upper(coalesce(i.status, '')) in ('ACTIVE', 'CONNECTED', 'READY')
                """.formatted(companyWhere);
        long activeIntegrations = jdbc.queryForObject(activeIntegrationsSql, params, Long.class);

        String featureUsageSql = """
                select
                    f.feature_key,
                    count(*) as usage_count,
                    count(distinct f.company_id) as unique_customers_count
                from feature_usage_events f
                join companies c on c.id = f.company_id
                %s
                and f.occurred_at >= :usageStart
                and f.occurred_at < :usageEnd
                group by f.feature_key
                order by unique_customers_count desc, usage_count desc, f.feature_key asc
                """.formatted(companyWhere);

        List<FeatureUsageMetric> featureUsage = jdbc.query(featureUsageSql, params, (rs, rowNum) -> {
            long uniqueCustomers = rs.getLong("unique_customers_count");
            long usageCount = rs.getLong("usage_count");
            double adoptionRate = activeCustomers == 0 ? 0D : (uniqueCustomers * 100D) / activeCustomers;
            return new FeatureUsageMetric(
                    rs.getString("feature_key"),
                    uniqueCustomers,
                    usageCount,
                    round(adoptionRate)
            );
        });

        double averageVehiclesPerCustomer = activeCustomers == 0 ? 0D : (totalVehicles * 1D) / activeCustomers;

        return new ProductUsageDashboardResponse(
                totalVehicles,
                round(averageVehiclesPerCustomer),
                activeMarketplaceAds,
                activeIntegrations,
                featureUsage,
                usageWindow.fromDate(),
                usageWindow.toDate()
        );
    }

    private SuperAdminTimeWindow resolveUsageWindow(SuperAdminFilter filter, String preset) {
        String normalized = preset == null ? "" : preset.trim().toUpperCase();
        LocalDate today = LocalDate.now(SuperAdminTimeWindow.ZONE);
        if ("CURRENT_MONTH".equals(normalized)) {
            YearMonth ym = YearMonth.from(today);
            return SuperAdminTimeWindow.of(ym.atDay(1), today);
        }
        if ("LAST_30_DAYS".equals(normalized)) {
            return SuperAdminTimeWindow.of(today.minusDays(29), today);
        }
        if ("CURRENT_YEAR".equals(normalized)) {
            return SuperAdminTimeWindow.of(LocalDate.of(today.getYear(), 1, 1), today);
        }
        return filter.resolveTimeWindow();
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record ProductUsageDashboardResponse(
            long totalVehicles,
            double averageVehiclesPerCustomer,
            long activeMarketplaceAds,
            long activeIntegrations,
            List<FeatureUsageMetric> featureUsage,
            LocalDate fromDate,
            LocalDate toDate
    ) {
    }

    public record FeatureUsageMetric(
            String featureKey,
            long uniqueCustomersCount,
            long usageCount,
            double adoptionRate
    ) {
    }
}
