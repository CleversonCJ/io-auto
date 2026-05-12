package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class CustomerHealthScoreService {

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerHealthScoreService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CustomerHealthScoreRow> listHealthScores(SuperAdminFilter filter) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("thirtyDaysAgo", SuperAdminSqlValues.timestamp(Instant.now().minus(30, ChronoUnit.DAYS)));
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");
        SuperAdminSqlFilterBuilder.appendStockFilter(where, params, "stock", filter.stockSize());

        String sql = """
                with stock as (
                    select
                        v.company_id,
                        count(*) as stock_count,
                        sum(case when v.updated_at >= :thirtyDaysAgo then 1 else 0 end) as recent_updates
                    from ioauto_vehicles v
                    group by v.company_id
                ),
                ads as (
                    select
                        p.company_id,
                        sum(case when upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED') then 1 else 0 end) as active_ads
                    from ioauto_vehicle_publications p
                    group by p.company_id
                ),
                features as (
                    select
                        f.company_id,
                        count(*) as usage_count,
                        count(distinct f.feature_key) as used_features
                    from feature_usage_events f
                    where f.occurred_at >= :thirtyDaysAgo
                    group by f.company_id
                ),
                leads as (
                    select
                        l.company_id,
                        count(*) as recent_leads
                    from ioauto_public_catalog_leads l
                    where l.created_at >= :thirtyDaysAgo
                    group by l.company_id
                ),
                open_tickets as (
                    select
                        t.company_id,
                        count(*) as open_tickets
                    from support_tickets t
                    where upper(coalesce(t.status, '')) in ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')
                    group by t.company_id
                ),
                latest_billing as (
                    select distinct on (b.company_id)
                        b.company_id,
                        b.plan_name,
                        b.status as billing_status
                    from ioauto_billing_subscriptions b
                    order by b.company_id, b.updated_at desc
                )
                select
                    c.id,
                    c.name,
                    c.cidade,
                    c.uf,
                    c.last_access_at,
                    c.subscription_status,
                    coalesce(stock.stock_count, 0) as stock_count,
                    coalesce(stock.recent_updates, 0) as recent_updates,
                    coalesce(ads.active_ads, 0) as active_ads,
                    coalesce(features.used_features, 0) as used_features,
                    coalesce(features.usage_count, 0) as usage_count,
                    coalesce(leads.recent_leads, 0) as recent_leads,
                    coalesce(open_tickets.open_tickets, 0) as open_tickets,
                    coalesce(latest_billing.plan_name, 'Plano principal') as plan_name,
                    case
                        when upper(coalesce(c.subscription_status, '')) = 'OVERDUE' then true
                        when upper(coalesce(latest_billing.billing_status, '')) in ('OVERDUE', 'PAST_DUE', 'PAYMENT_FAILED', 'FAILED') then true
                        else false
                    end as overdue_status
                from companies c
                left join stock on stock.company_id = c.id
                left join ads on ads.company_id = c.id
                left join features on features.company_id = c.id
                left join leads on leads.company_id = c.id
                left join open_tickets on open_tickets.company_id = c.id
                left join latest_billing on latest_billing.company_id = c.id
                %s
                """.formatted(where);

        List<CustomerHealthScoreRow> rows = jdbc.query(sql, params, (rs, rowNum) -> {
            Instant lastAccessAt = rs.getTimestamp("last_access_at") == null ? null : rs.getTimestamp("last_access_at").toInstant();
            int stockCount = rs.getInt("stock_count");
            int recentUpdates = rs.getInt("recent_updates");
            int activeAds = rs.getInt("active_ads");
            int usedFeatures = rs.getInt("used_features");
            int usageCount = rs.getInt("usage_count");
            int recentLeads = rs.getInt("recent_leads");
            int openTickets = rs.getInt("open_tickets");
            boolean overdue = rs.getBoolean("overdue_status");
            String subscriptionStatus = safeUpper(rs.getString("subscription_status"), "ACTIVE");

            ScoreBreakdown breakdown = calculateScore(
                    lastAccessAt,
                    stockCount,
                    recentUpdates,
                    usedFeatures,
                    recentLeads,
                    openTickets,
                    subscriptionStatus,
                    overdue
            );

            return new CustomerHealthScoreRow(
                    UUID.fromString(rs.getString("id")),
                    rs.getString("name"),
                    rs.getString("plan_name"),
                    rs.getString("cidade"),
                    rs.getString("uf"),
                    breakdown.score(),
                    breakdown.classification(),
                    breakdown.riskLevel(),
                    breakdown.reasons(),
                    lastAccessAt,
                    stockCount,
                    activeAds,
                    openTickets,
                    overdue
            );
        });

        rows.sort(Comparator.comparing(CustomerHealthScoreRow::score).thenComparing(CustomerHealthScoreRow::companyName, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    private ScoreBreakdown calculateScore(
            Instant lastAccessAt,
            int stockCount,
            int recentUpdates,
            int usedFeatures,
            int recentLeads,
            int openTickets,
            String subscriptionStatus,
            boolean overdue
    ) {
        LocalDate today = LocalDate.now(SuperAdminTimeWindow.ZONE);
        int accessScore = 0;
        if (lastAccessAt != null) {
            long daysWithoutAccess = ChronoUnit.DAYS.between(lastAccessAt.atZone(SuperAdminTimeWindow.ZONE).toLocalDate(), today);
            if (daysWithoutAccess <= 3) accessScore = 20;
            else if (daysWithoutAccess <= 7) accessScore = 15;
            else if (daysWithoutAccess <= 15) accessScore = 10;
            else if (daysWithoutAccess <= 30) accessScore = 5;
        }

        int featureScore = (int) Math.round(Math.min(20D, (usedFeatures / 7D) * 20D));

        int stockScore;
        if (stockCount <= 0) {
            stockScore = 5;
        } else {
            stockScore = (int) Math.round(Math.min(20D, (recentUpdates / (double) stockCount) * 20D));
        }

        int leadScore;
        if (recentLeads >= 20) leadScore = 15;
        else if (recentLeads >= 10) leadScore = 12;
        else if (recentLeads >= 5) leadScore = 8;
        else if (recentLeads >= 1) leadScore = 4;
        else leadScore = 0;

        int financialScore;
        if (overdue || "OVERDUE".equals(subscriptionStatus)) financialScore = 0;
        else if ("BLOCKED".equals(subscriptionStatus) || "CANCELED".equals(subscriptionStatus)) financialScore = 0;
        else if ("TRIAL".equals(subscriptionStatus)) financialScore = 8;
        else financialScore = 15;

        int supportScore;
        if (openTickets <= 0) supportScore = 10;
        else if (openTickets <= 2) supportScore = 7;
        else if (openTickets <= 5) supportScore = 4;
        else supportScore = 1;

        int totalScore = Math.max(0, Math.min(100, accessScore + featureScore + stockScore + leadScore + financialScore + supportScore));
        Classification classification = classify(totalScore);

        List<String> reasons = new ArrayList<>();
        if (accessScore < 10) reasons.add("Acesso recente baixo");
        if (featureScore < 10) reasons.add("Adoção de funcionalidades abaixo do esperado");
        if (stockScore < 10) reasons.add("Atualização de estoque insuficiente");
        if (leadScore < 8) reasons.add("Gestão de leads pouco ativa");
        if (financialScore < 10) reasons.add("Situação financeira exige atenção");
        if (supportScore < 7) reasons.add("Volume de tickets em aberto elevado");

        return new ScoreBreakdown(totalScore, classification.classification(), classification.riskLevel(), reasons);
    }

    private Classification classify(int score) {
        if (score <= 19) return new Classification("CRITICO", "RISCO_IMINENTE");
        if (score <= 39) return new Classification("BAIXISSIMO", "RISCO_ALTISSIMO");
        if (score <= 49) return new Classification("BAIXO", "RISCO_ALTO");
        if (score <= 69) return new Classification("INTERMEDIARIO", "RISCO_INTERMEDIARIO");
        if (score <= 89) return new Classification("ALTO", "RISCO_BAIXO");
        return new Classification("ALTISSIMO", "RISCO_MINIMO");
    }

    private String safeUpper(String value, String fallback) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        return normalized.isBlank() ? fallback : normalized;
    }

    private record Classification(String classification, String riskLevel) {
    }

    private record ScoreBreakdown(
            int score,
            String classification,
            String riskLevel,
            List<String> reasons
    ) {
    }

    public record CustomerHealthScoreRow(
            UUID tenantId,
            String companyName,
            String planName,
            String city,
            String region,
            int score,
            String classification,
            String riskLevel,
            List<String> reasons,
            Instant lastAccessAt,
            int stockCount,
            int activeAdsCount,
            int openTicketsCount,
            boolean overdueStatus
    ) {
    }
}
