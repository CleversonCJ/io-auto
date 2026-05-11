package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SuperAdminGrowthDashboardService {

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminGrowthDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public GrowthDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", window.fromAt())
                .addValue("windowEnd", window.toExclusiveAt());

        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String leadsSql = """
                select count(*)
                from ioauto_public_catalog_leads l
                join companies c on c.id = l.company_id
                %s
                and l.created_at >= :windowStart
                and l.created_at < :windowEnd
                """.formatted(where);
        long leadsGenerated = jdbc.queryForObject(leadsSql, params, Long.class);

        String salesSql = """
                select count(*)
                from atendimento_sessions s
                join companies c on c.id = s.company_id
                %s
                and s.sale_completed = true
                and s.sale_completed_at >= :windowStart
                and s.sale_completed_at < :windowEnd
                """.formatted(where);
        long closedSales = jdbc.queryForObject(salesSql, params, Long.class);

        String leadsByOriginSql = """
                select
                    upper(coalesce(nullif(l.origin_source, ''), nullif(l.source_type, ''), 'CATALOG')) as origin_key,
                    count(*) as total
                from ioauto_public_catalog_leads l
                join companies c on c.id = l.company_id
                %s
                and l.created_at >= :windowStart
                and l.created_at < :windowEnd
                group by upper(coalesce(nullif(l.origin_source, ''), nullif(l.source_type, ''), 'CATALOG'))
                order by total desc
                """.formatted(where);
        List<OriginMetric> leadsByOrigin = jdbc.query(leadsByOriginSql, params, (rs, rowNum) ->
                new OriginMetric(rs.getString("origin_key"), rs.getLong("total"))
        );

        String customerOriginsSql = """
                select
                    upper(coalesce(nullif(c.origin_source, ''), 'DIRECT')) as origin_key,
                    count(*) as total
                from companies c
                %s
                group by upper(coalesce(nullif(c.origin_source, ''), 'DIRECT'))
                order by total desc
                """.formatted(where);
        List<OriginMetric> customerOrigins = jdbc.query(customerOriginsSql, params, (rs, rowNum) ->
                new OriginMetric(rs.getString("origin_key"), rs.getLong("total"))
        );

        double conversionRate = leadsGenerated == 0 ? 0D : (closedSales * 100D) / leadsGenerated;
        return new GrowthDashboardResponse(
                leadsGenerated,
                closedSales,
                round(conversionRate),
                null,
                null,
                leadsByOrigin,
                customerOrigins
        );
    }

    public CatalogLeadsPage listCatalogLeads(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", window.fromAt())
                .addValue("windowEnd", window.toExclusiveAt());
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");

        String sql = """
                select
                    l.id,
                    l.company_id,
                    c.name as company_name,
                    l.customer_name,
                    l.customer_phone,
                    coalesce(l.vehicle_interest_name, v.title, l.customer_name) as vehicle_interest_name,
                    l.seller_user_id,
                    u.full_name as seller_name,
                    upper(coalesce(nullif(l.origin_source, ''), nullif(l.source_type, ''), 'CATALOG')) as origin_source,
                    l.created_at,
                    l.converted_to_sale,
                    l.converted_sale_id
                from ioauto_public_catalog_leads l
                join companies c on c.id = l.company_id
                left join ioauto_vehicles v on v.id = l.vehicle_id
                left join users u on u.id = l.seller_user_id
                %s
                and l.created_at >= :windowStart
                and l.created_at < :windowEnd
                order by l.created_at desc
                """.formatted(where);

        List<CatalogLeadRow> rows = jdbc.query(sql, params, (rs, rowNum) -> new CatalogLeadRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("company_id")),
                rs.getString("company_name"),
                rs.getString("customer_name"),
                rs.getString("customer_phone"),
                rs.getString("vehicle_interest_name"),
                rs.getString("seller_name"),
                rs.getString("origin_source"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getBoolean("converted_to_sale"),
                rs.getString("converted_sale_id") == null ? null : UUID.fromString(rs.getString("converted_sale_id"))
        ));

        return new CatalogLeadsPage(window.fromDate(), window.toDate(), rows);
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record GrowthDashboardResponse(
            long leadsGenerated,
            long closedSales,
            double conversionRate,
            Double cac,
            Double payback,
            List<OriginMetric> leadsByOrigin,
            List<OriginMetric> customerOrigins
    ) {
    }

    public record OriginMetric(String origin, long total) {
    }

    public record CatalogLeadsPage(
            java.time.LocalDate fromDate,
            java.time.LocalDate toDate,
            List<CatalogLeadRow> leads
    ) {
    }

    public record CatalogLeadRow(
            UUID id,
            UUID tenantId,
            String companyName,
            String fullName,
            String whatsapp,
            String vehicleInterestName,
            String sellerName,
            String originSource,
            Instant createdAt,
            boolean convertedToSale,
            UUID convertedSaleId
    ) {
    }
}
