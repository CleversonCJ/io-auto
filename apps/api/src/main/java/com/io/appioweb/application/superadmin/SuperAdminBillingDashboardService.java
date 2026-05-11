package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SuperAdminBillingDashboardService {

    private static final String MRR_EQUIVALENT_CENTS_SQL =
            "case " +
            "when upper(coalesce(c.billing_recurrence, 'MONTHLY')) = 'ANNUAL' then coalesce(c.subscription_amount_cents, 0)::numeric / 12.0 " +
            "else coalesce(c.subscription_amount_cents, 0)::numeric end";

    private static final List<String> OVERDUE_STATUSES = List.of("OVERDUE", "PAST_DUE", "PAYMENT_FAILED", "FAILED");
    private static final List<String> FAILED_PAYMENT_STATUSES = List.of("OVERDUE", "PAST_DUE", "PAYMENT_FAILED", "FAILED", "CANCELED", "CANCELLED");

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminBillingDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public BillingDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", window.fromAt())
                .addValue("windowEnd", window.toExclusiveAt())
                .addValue("nowAt", Instant.now())
                .addValue("overdueStatuses", OVERDUE_STATUSES)
                .addValue("failedStatuses", FAILED_PAYMENT_STATUSES);

        StringBuilder companyWhere = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(companyWhere, params, filter, "c");

        String overdueCte = """
                with latest_billing as (
                    select distinct on (b.company_id)
                        b.company_id,
                        b.status,
                        b.amount_cents,
                        b.plan_name,
                        b.current_period_end,
                        b.updated_at
                    from ioauto_billing_subscriptions b
                    order by b.company_id, b.updated_at desc
                ),
                overdue_companies as (
                    select
                        c.id,
                        c.name,
                        c.email,
                        c.subscription_status,
                        c.subscription_amount_cents,
                        c.billing_recurrence,
                        lb.status as billing_status,
                        lb.amount_cents as latest_amount_cents,
                        lb.plan_name,
                        lb.current_period_end,
                        case
                            when lb.current_period_end is null then 0
                            when lb.current_period_end >= :nowAt then 0
                            else greatest(extract(epoch from (:nowAt - lb.current_period_end)) / 86400.0, 0)
                        end as delay_days
                    from companies c
                    left join latest_billing lb on lb.company_id = c.id
                    %s
                    and (
                        upper(coalesce(c.subscription_status, '')) in (:overdueStatuses)
                        or upper(coalesce(lb.status, '')) in (:overdueStatuses)
                        or (
                            lb.current_period_end is not null
                            and lb.current_period_end < :nowAt
                            and upper(coalesce(lb.status, 'PENDING')) not in ('RECEIVED', 'CONFIRMED', 'ACTIVE')
                        )
                    )
                )
                """.formatted(companyWhere);

        String cardsSql = overdueCte + """
                select
                    count(*) as overdue_customers,
                    coalesce(sum(case
                        when coalesce(o.latest_amount_cents, 0) > 0 then o.latest_amount_cents
                        else %s
                    end), 0) as overdue_revenue_cents,
                    coalesce(avg(o.delay_days), 0) as avg_delay_days
                from overdue_companies o
                join companies c on c.id = o.id
                """.formatted(MRR_EQUIVALENT_CENTS_SQL.replace("c.", "o."));

        BillingCardMetrics cards = jdbc.queryForObject(cardsSql, params, (rs, rowNum) ->
                new BillingCardMetrics(
                        rs.getLong("overdue_customers"),
                        Math.max(0L, rs.getLong("overdue_revenue_cents")),
                        round(rs.getDouble("avg_delay_days")),
                        0D
                )
        );

        String failureRateSql = """
                with latest_billing as (
                    select distinct on (b.company_id)
                        b.company_id,
                        upper(coalesce(b.status, '')) as status,
                        b.updated_at
                    from ioauto_billing_subscriptions b
                    order by b.company_id, b.updated_at desc
                )
                select
                    count(*) as total_attempts,
                    sum(case when lb.status in (:failedStatuses) then 1 else 0 end) as failed_attempts
                from latest_billing lb
                join companies c on c.id = lb.company_id
                %s
                and lb.updated_at >= :windowStart
                and lb.updated_at < :windowEnd
                """.formatted(companyWhere);

        PaymentFailureCount failureCount = jdbc.queryForObject(failureRateSql, params, (rs, rowNum) ->
                new PaymentFailureCount(
                        rs.getLong("total_attempts"),
                        rs.getLong("failed_attempts")
                )
        );

        double failureRate = (failureCount == null || failureCount.totalAttempts() <= 0)
                ? 0D
                : (failureCount.failedAttempts() * 100D) / failureCount.totalAttempts();

        String overdueListSql = overdueCte + """
                select
                    o.id,
                    o.name,
                    o.email,
                    upper(coalesce(o.subscription_status, 'ACTIVE')) as subscription_status,
                    upper(coalesce(o.billing_status, 'OVERDUE')) as billing_status,
                    coalesce(nullif(o.plan_name, ''), 'Plano principal') as plan_name,
                    coalesce(
                        case
                            when coalesce(o.latest_amount_cents, 0) > 0 then o.latest_amount_cents
                            else %s
                        end,
                        0
                    ) as overdue_amount_cents,
                    o.delay_days,
                    o.current_period_end
                from overdue_companies o
                join companies c on c.id = o.id
                order by o.delay_days desc, o.name asc
                limit 200
                """.formatted(MRR_EQUIVALENT_CENTS_SQL.replace("c.", "o."));

        List<OverdueCustomerRow> overdueCustomers = jdbc.query(overdueListSql, params, (rs, rowNum) -> new OverdueCustomerRow(
                UUID.fromString(rs.getString("id")),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("plan_name"),
                rs.getString("subscription_status"),
                rs.getString("billing_status"),
                Math.max(0L, rs.getLong("overdue_amount_cents")),
                round(rs.getDouble("delay_days")),
                rs.getTimestamp("current_period_end") == null ? null : rs.getTimestamp("current_period_end").toInstant()
        ));

        BillingCardMetrics mergedCards = new BillingCardMetrics(
                cards == null ? 0L : cards.overdueCustomers(),
                cards == null ? 0L : cards.overdueRevenueCents(),
                cards == null ? 0D : cards.averageDelayDays(),
                round(failureRate)
        );

        return new BillingDashboardResponse(mergedCards, overdueCustomers);
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    private record PaymentFailureCount(long totalAttempts, long failedAttempts) {
    }

    public record BillingDashboardResponse(
            BillingCardMetrics cards,
            List<OverdueCustomerRow> overdueCustomers
    ) {
    }

    public record BillingCardMetrics(
            long overdueCustomers,
            long overdueRevenueCents,
            double averageDelayDays,
            double paymentFailureRate
    ) {
    }

    public record OverdueCustomerRow(
            UUID tenantId,
            String companyName,
            String companyEmail,
            String planName,
            String subscriptionStatus,
            String billingStatus,
            long overdueAmountCents,
            double delayDays,
            Instant currentPeriodEnd
    ) {
    }
}
