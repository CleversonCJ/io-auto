package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SuperAdminOperationsDashboardService {

    private final NamedParameterJdbcTemplate jdbc;

    public SuperAdminOperationsDashboardService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public OperationsDashboardResponse getDashboard(SuperAdminFilter filter) {
        SuperAdminTimeWindow window = filter.resolveTimeWindow();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("windowStart", SuperAdminSqlValues.timestamp(window.fromAt()))
                .addValue("windowEnd", SuperAdminSqlValues.timestamp(window.toExclusiveAt()));

        StringBuilder companyWhere = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(companyWhere, params, filter, "c");

        String cardsSql = """
                select
                    sum(case when upper(coalesce(t.status, '')) in ('OPEN', 'IN_PROGRESS') then 1 else 0 end) as open_tickets,
                    avg(case
                        when t.first_response_at is null then null
                        else extract(epoch from (t.first_response_at - t.created_at)) / 60.0
                    end) as avg_first_response_minutes,
                    avg(case
                        when t.resolved_at is null then null
                        else extract(epoch from (t.resolved_at - t.created_at)) / 3600.0
                    end) as avg_resolution_hours,
                    sum(case when upper(coalesce(t.category, '')) = 'BUG' then 1 else 0 end) as bugs_reported
                from support_tickets t
                join companies c on c.id = t.company_id
                %s
                and t.created_at >= :windowStart
                and t.created_at < :windowEnd
                """.formatted(companyWhere);

        OperationsCards cards = jdbc.queryForObject(cardsSql, params, (rs, rowNum) -> new OperationsCards(
                rs.getLong("open_tickets"),
                round(rs.getDouble("avg_first_response_minutes")),
                round(rs.getDouble("avg_resolution_hours")),
                rs.getLong("bugs_reported")
        ));

        String bugAreasSql = """
                select
                    upper(coalesce(nullif(t.bug_area, ''), 'UNSPECIFIED')) as bug_area,
                    count(*) as total
                from support_tickets t
                join companies c on c.id = t.company_id
                %s
                and upper(coalesce(t.category, '')) = 'BUG'
                and t.created_at >= :windowStart
                and t.created_at < :windowEnd
                group by upper(coalesce(nullif(t.bug_area, ''), 'UNSPECIFIED'))
                order by total desc, bug_area asc
                """.formatted(companyWhere);

        List<BugAreaMetric> bugsByArea = jdbc.query(bugAreasSql, params, (rs, rowNum) -> new BugAreaMetric(
                rs.getString("bug_area"),
                rs.getLong("total")
        ));

        String latestTicketsSql = """
                select
                    t.id,
                    t.company_id,
                    c.name as company_name,
                    t.title,
                    upper(coalesce(t.category, 'OTHER')) as category,
                    upper(coalesce(t.urgency, 'MEDIUM')) as urgency,
                    upper(coalesce(t.status, 'OPEN')) as status,
                    t.created_at,
                    t.first_response_at,
                    t.resolved_at
                from support_tickets t
                join companies c on c.id = t.company_id
                %s
                and t.created_at >= :windowStart
                and t.created_at < :windowEnd
                order by t.created_at desc
                limit 200
                """.formatted(companyWhere);

        List<SupportTicketMetricRow> latestTickets = jdbc.query(latestTicketsSql, params, (rs, rowNum) -> new SupportTicketMetricRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("company_id")),
                rs.getString("company_name"),
                rs.getString("title"),
                rs.getString("category"),
                rs.getString("urgency"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("first_response_at") == null ? null : rs.getTimestamp("first_response_at").toInstant(),
                rs.getTimestamp("resolved_at") == null ? null : rs.getTimestamp("resolved_at").toInstant()
        ));

        return new OperationsDashboardResponse(
                cards == null ? new OperationsCards(0L, 0D, 0D, 0L) : cards,
                bugsByArea,
                latestTickets
        );
    }

    private double round(double value) {
        if (!Double.isFinite(value)) return 0D;
        return Math.round(value * 100D) / 100D;
    }

    public record OperationsDashboardResponse(
            OperationsCards cards,
            List<BugAreaMetric> bugsByArea,
            List<SupportTicketMetricRow> latestTickets
    ) {
    }

    public record OperationsCards(
            long openTickets,
            double averageFirstResponseMinutes,
            double averageResolutionHours,
            long bugsReported
    ) {
    }

    public record BugAreaMetric(
            String bugArea,
            long total
    ) {
    }

    public record SupportTicketMetricRow(
            UUID ticketId,
            UUID tenantId,
            String companyName,
            String title,
            String category,
            String urgency,
            String status,
            Instant createdAt,
            Instant firstResponseAt,
            Instant resolvedAt
    ) {
    }
}
