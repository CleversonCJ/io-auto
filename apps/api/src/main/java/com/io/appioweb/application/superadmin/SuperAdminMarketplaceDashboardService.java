package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SuperAdminMarketplaceDashboardService {

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminMarketplaceDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public MarketplaceDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", SuperAdminSqlValues.timestamp(window.fromAt()))
                .addValue("windowEnd", SuperAdminSqlValues.timestamp(window.toExclusiveAt()));
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String adsSql = """
                select
                    coalesce(nullif(p.platform, ''), upper(coalesce(p.provider_key, 'OUTRA'))) as platform_key,
                    count(*) as ads_count
                from ioauto_vehicle_publications p
                join companies c on c.id = p.company_id
                %s
                and upper(coalesce(c.subscription_status, 'ACTIVE')) not in ('CANCELED', 'BLOCKED')
                and upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED')
                group by coalesce(nullif(p.platform, ''), upper(coalesce(p.provider_key, 'OUTRA')))
                order by ads_count desc
                """.formatted(where);

        List<PlatformCount> adsByPlatform = jdbc.query(adsSql, params, (rs, rowNum) ->
                new PlatformCount(normalizePlatform(rs.getString("platform_key")), rs.getLong("ads_count"))
        );

        String salesSql = """
                select
                    upper(coalesce(s.sale_origin_platform, 'MANUAL')) as platform_key,
                    count(*) as sales_count,
                    coalesce(sum(v.price_cents), 0) as total_value_cents
                from atendimento_sessions s
                join companies c on c.id = s.company_id
                left join ioauto_vehicles v on v.id = s.sold_vehicle_id
                %s
                and s.sale_completed = true
                and s.sale_completed_at >= :windowStart
                and s.sale_completed_at < :windowEnd
                group by upper(coalesce(s.sale_origin_platform, 'MANUAL'))
                order by sales_count desc
                """.formatted(where);

        List<SalesByPlatformRow> salesByPlatform = jdbc.query(salesSql, params, (rs, rowNum) ->
                new SalesByPlatformRow(
                        normalizePlatform(rs.getString("platform_key")),
                        rs.getLong("sales_count"),
                        rs.getLong("total_value_cents")
                )
        );

        String leadsSql = """
                select
                    upper(coalesce(nullif(l.origin_source, ''), nullif(l.source_type, ''), 'CATALOG')) as origin_key,
                    count(*) as leads_count
                from ioauto_public_catalog_leads l
                join companies c on c.id = l.company_id
                %s
                and l.created_at >= :windowStart
                and l.created_at < :windowEnd
                group by upper(coalesce(nullif(l.origin_source, ''), nullif(l.source_type, ''), 'CATALOG'))
                """.formatted(where);

        Map<String, Long> leadsByPlatform = new LinkedHashMap<>();
        List<PlatformCount> leadsRows = jdbc.query(leadsSql, params, (rs, rowNum) ->
                new PlatformCount(normalizePlatform(rs.getString("origin_key")), rs.getLong("leads_count"))
        );
        for (PlatformCount row : leadsRows) {
            leadsByPlatform.put(row.platform(), row.count());
        }

        Map<String, SalesByPlatformRow> salesByPlatformMap = new LinkedHashMap<>();
        for (SalesByPlatformRow row : salesByPlatform) {
            salesByPlatformMap.put(row.platform(), row);
        }

        List<PlatformPerformanceRow> performance = new ArrayList<>();
        for (String platform : mergeKeys(leadsByPlatform.keySet(), salesByPlatformMap.keySet())) {
            long leads = leadsByPlatform.getOrDefault(platform, 0L);
            SalesByPlatformRow sales = salesByPlatformMap.get(platform);
            long salesCount = sales == null ? 0L : sales.salesCount();
            long totalValue = sales == null ? 0L : sales.totalValueCents();
            double conversionRate = leads == 0 ? 0D : (salesCount * 100D) / leads;
            performance.add(new PlatformPerformanceRow(platform, leads, salesCount, totalValue, round(conversionRate)));
        }

        return new MarketplaceDashboardResponse(adsByPlatform, salesByPlatform, performance);
    }

    private List<String> mergeKeys(java.util.Set<String> left, java.util.Set<String> right) {
        java.util.LinkedHashSet<String> merged = new java.util.LinkedHashSet<>(left);
        merged.addAll(right);
        return new java.util.ArrayList<>(merged);
    }

    private String normalizePlatform(String raw) {
        String normalized = raw == null ? "" : raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if (normalized.isBlank()) return "OTHER";
        return switch (normalized) {
            case "MELI", "MERCADOLIVRE", "MERCADO_LIVRE" -> "MERCADO_LIVRE";
            case "WEB_MOTORS", "WEBMOTORS" -> "WEBMOTORS";
            case "SITE", "SITE_PROPRIO" -> "SITE_PROPRIO";
            case "OUTRA", "OUTRO" -> "OTHER";
            default -> normalized;
        };
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record MarketplaceDashboardResponse(
            List<PlatformCount> adsByPlatform,
            List<SalesByPlatformRow> salesByPlatform,
            List<PlatformPerformanceRow> platformPerformance
    ) {
    }

    public record PlatformCount(
            String platform,
            long count
    ) {
    }

    public record SalesByPlatformRow(
            String platform,
            long salesCount,
            long totalValueCents
    ) {
    }

    public record PlatformPerformanceRow(
            String platform,
            long leadsCount,
            long salesCount,
            long totalValueCents,
            double conversionRate
    ) {
    }
}
