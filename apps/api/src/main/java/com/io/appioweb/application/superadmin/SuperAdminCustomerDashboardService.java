package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;

@Service
public class SuperAdminCustomerDashboardService {

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminCustomerDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public CustomerDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        YearMonth referenceMonth = filter.resolveYearMonthOrCurrent();
        Instant monthStart = referenceMonth.atDay(1).atStartOfDay(SuperAdminTimeWindow.ZONE).toInstant();
        Instant monthEnd = referenceMonth.plusMonths(1).atDay(1).atStartOfDay(SuperAdminTimeWindow.ZONE).toInstant();

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", window.fromAt())
                .addValue("windowEnd", window.toExclusiveAt())
                .addValue("monthStart", monthStart)
                .addValue("monthEnd", monthEnd)
                .addValue("nowAt", Instant.now());

        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");
        SuperAdminSqlFilterBuilder.appendStockFilter(where, params, "stock", filter.stockSize());

        String sql = """
                with stock as (
                    select v.company_id, count(*) as stock_count
                    from ioauto_vehicles v
                    group by v.company_id
                )
                select
                    sum(case when upper(coalesce(c.subscription_status, 'ACTIVE')) in ('ACTIVE', 'OVERDUE', 'TRIAL')
                                and upper(coalesce(c.subscription_status, 'ACTIVE')) <> 'CANCELED'
                             then 1 else 0 end) as total_active_customers,
                    sum(case when c.subscription_started_at >= :windowStart and c.subscription_started_at < :windowEnd then 1 else 0 end) as new_customers,
                    sum(case when c.subscription_canceled_at >= :windowStart and c.subscription_canceled_at < :windowEnd then 1 else 0 end) as canceled_customers,
                    sum(case when c.subscription_started_at < :monthStart
                                and (c.subscription_canceled_at is null or c.subscription_canceled_at >= :monthStart)
                                and upper(coalesce(c.subscription_status, 'ACTIVE')) <> 'BLOCKED'
                             then 1 else 0 end) as active_at_month_start,
                    sum(case when c.subscription_canceled_at >= :monthStart and c.subscription_canceled_at < :monthEnd then 1 else 0 end) as canceled_in_month,
                    avg(case
                        when c.subscription_started_at is null then null
                        when c.subscription_canceled_at is null then extract(epoch from (:nowAt - c.subscription_started_at)) / 2592000.0
                        else extract(epoch from (c.subscription_canceled_at - c.subscription_started_at)) / 2592000.0
                    end) as avg_tenure_months
                from companies c
                left join stock on stock.company_id = c.id
                %s
                """.formatted(where);

        return jdbc.queryForObject(sql, params, (rs, rowNum) -> {
            long totalActive = rs.getLong("total_active_customers");
            long newCustomers = rs.getLong("new_customers");
            long canceledCustomers = rs.getLong("canceled_customers");
            long activeAtMonthStart = rs.getLong("active_at_month_start");
            long canceledInMonth = rs.getLong("canceled_in_month");
            double churnRate = activeAtMonthStart == 0 ? 0D : (canceledInMonth * 100D) / activeAtMonthStart;
            double averageTenure = rs.getDouble("avg_tenure_months");
            if (!Double.isFinite(averageTenure)) averageTenure = 0D;

            return new CustomerDashboardResponse(
                    totalActive,
                    newCustomers,
                    canceledCustomers,
                    round(churnRate),
                    round(averageTenure)
            );
        });
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record CustomerDashboardResponse(
            long totalActiveCustomers,
            long newCustomersInPeriod,
            long canceledCustomersInPeriod,
            double churnRate,
            double averageLifetimeMonths
    ) {
    }
}
