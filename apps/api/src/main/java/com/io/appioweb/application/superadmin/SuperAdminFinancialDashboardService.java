package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
public class SuperAdminFinancialDashboardService {

    private static final String MRR_EQUIVALENT_CENTS_SQL =
            "case " +
            "when upper(coalesce(c.billing_recurrence, 'MONTHLY')) = 'ANNUAL' then coalesce(c.subscription_amount_cents, 0)::numeric / 12.0 " +
            "else coalesce(c.subscription_amount_cents, 0)::numeric end";

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminFinancialDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public FinancialDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", SuperAdminSqlValues.timestamp(window.fromAt()))
                .addValue("windowEnd", SuperAdminSqlValues.timestamp(window.toExclusiveAt()))
                .addValue("nowAt", SuperAdminSqlValues.timestamp(java.time.Instant.now()));

        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String cardSql = """
                select
                    coalesce(sum(case
                        when upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                             and (c.subscription_canceled_at is null or c.subscription_canceled_at > :nowAt)
                        then %s else 0 end), 0) as mrr_active_cents,
                    coalesce(sum(case
                        when upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                             and (c.subscription_canceled_at is null or c.subscription_canceled_at > :nowAt)
                        then %s else 0 end), 0) * 12 as arr_cents,
                    coalesce(sum(case
                        when upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                             and (c.subscription_canceled_at is null or c.subscription_canceled_at > :nowAt)
                        then %s else 0 end), 0)
                        / nullif(sum(case
                            when upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                                 and (c.subscription_canceled_at is null or c.subscription_canceled_at > :nowAt)
                                 and coalesce(c.subscription_amount_cents, 0) > 0
                            then 1 else 0 end), 0) as average_ticket_cents,
                    avg(case
                        when c.subscription_started_at is null then null
                        when c.subscription_canceled_at is null then extract(epoch from (:nowAt - c.subscription_started_at)) / 2592000.0
                        else extract(epoch from (c.subscription_canceled_at - c.subscription_started_at)) / 2592000.0
                    end) as average_tenure_months,
                    coalesce(sum(case
                        when c.subscription_canceled_at >= :windowStart and c.subscription_canceled_at < :windowEnd
                        then %s else 0 end), 0) as lost_mrr_cents_window,
                    coalesce(sum(case
                        when c.subscription_started_at < :windowEnd
                             and (c.subscription_canceled_at is null or c.subscription_canceled_at >= :windowStart)
                        then %s else 0 end), 0) as total_mrr_cents_window
                from companies c
                %s
                """.formatted(
                MRR_EQUIVALENT_CENTS_SQL,
                MRR_EQUIVALENT_CENTS_SQL,
                MRR_EQUIVALENT_CENTS_SQL,
                MRR_EQUIVALENT_CENTS_SQL,
                MRR_EQUIVALENT_CENTS_SQL,
                where
        );

        FinancialCardMetrics cards = jdbc.queryForObject(cardSql, params, (rs, rowNum) -> {
            double mrr = rs.getDouble("mrr_active_cents");
            double arr = rs.getDouble("arr_cents");
            double averageTicket = rs.getDouble("average_ticket_cents");
            double tenure = rs.getDouble("average_tenure_months");
            double ltv = averageTicket * (Double.isFinite(tenure) ? Math.max(tenure, 0D) : 0D);
            double lostMrr = rs.getDouble("lost_mrr_cents_window");
            double totalMrrWindow = rs.getDouble("total_mrr_cents_window");
            double churnRate = totalMrrWindow <= 0D ? 0D : (lostMrr / totalMrrWindow) * 100D;
            return new FinancialCardMetrics(
                    toCents(mrr),
                    toCents(arr),
                    toCents(averageTicket),
                    toCents(ltv),
                    round(churnRate)
            );
        });

        int year = filter.resolveYearOrCurrent();
        List<FinancialChurnPoint> chart = buildYearlyChurnChart(filter, year);

        return new FinancialDashboardResponse(cards, chart);
    }

    private List<FinancialChurnPoint> buildYearlyChurnChart(SuperAdminFilter filter, int year) {
        List<FinancialChurnPoint> points = new ArrayList<>();

        for (int month = 1; month <= 12; month++) {
            YearMonth yearMonth = YearMonth.of(year, month);
            LocalDate monthStartDate = yearMonth.atDay(1);
            LocalDate monthEndDate = yearMonth.plusMonths(1).atDay(1);

            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("monthStart", SuperAdminSqlValues.timestamp(monthStartDate.atStartOfDay(SuperAdminTimeWindow.ZONE).toInstant()))
                    .addValue("monthEnd", SuperAdminSqlValues.timestamp(monthEndDate.atStartOfDay(SuperAdminTimeWindow.ZONE).toInstant()));
            StringBuilder where = new StringBuilder(" where 1=1 ");
            SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

            String sql = """
                    select
                        coalesce(sum(case
                            when c.subscription_started_at < :monthEnd
                                 and (c.subscription_canceled_at is null or c.subscription_canceled_at >= :monthStart)
                                 and upper(coalesce(c.subscription_status, 'ACTIVE')) <> 'BLOCKED'
                            then %s else 0 end), 0) as total_mrr_cents,
                        coalesce(sum(case
                            when c.subscription_canceled_at >= :monthStart and c.subscription_canceled_at < :monthEnd
                            then %s else 0 end), 0) as lost_mrr_cents
                    from companies c
                    %s
                    """.formatted(MRR_EQUIVALENT_CENTS_SQL, MRR_EQUIVALENT_CENTS_SQL, where);

            FinancialChurnPoint point = jdbc.queryForObject(sql, params, (rs, rowNum) -> {
                double total = rs.getDouble("total_mrr_cents");
                double lost = rs.getDouble("lost_mrr_cents");
                double churn = total <= 0D ? 0D : (lost / total) * 100D;
                return new FinancialChurnPoint(
                        "%d-%02d".formatted(yearMonth.getYear(), yearMonth.getMonthValue()),
                        toCents(total),
                        toCents(lost),
                        round(churn)
                );
            });
            points.add(point);
        }

        return points;
    }

    private static long toCents(double value) {
        if (!Double.isFinite(value)) return 0L;
        return Math.round(value);
    }

    private static double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record FinancialDashboardResponse(
            FinancialCardMetrics cards,
            List<FinancialChurnPoint> chart
    ) {
    }

    public record FinancialCardMetrics(
            long mrrCents,
            long arrCents,
            long averageTicketCents,
            long ltvCents,
            double financialChurnRate
    ) {
    }

    public record FinancialChurnPoint(
            String month,
            long totalMrrCents,
            long lostMrrCents,
            double churnRate
    ) {
    }
}
