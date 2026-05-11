package com.io.appioweb.application.superadmin;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

public final class SuperAdminSqlFilterBuilder {

    private SuperAdminSqlFilterBuilder() {
    }

    public static void appendCompanyFilters(
            StringBuilder sql,
            MapSqlParameterSource params,
            SuperAdminFilter filter,
            String companyAlias
    ) {
        String alias = companyAlias == null || companyAlias.isBlank() ? "c" : companyAlias;
        if (hasText(filter.city())) {
            sql.append(" and lower(coalesce(").append(alias).append(".cidade, '')) = :city");
            params.addValue("city", filter.city().trim().toLowerCase());
        }
        if (hasText(filter.region())) {
            sql.append(" and lower(coalesce(").append(alias).append(".uf, '')) = :region");
            params.addValue("region", filter.region().trim().toLowerCase());
        }
        if (hasText(filter.recurrence())) {
            sql.append(" and upper(coalesce(").append(alias).append(".billing_recurrence, '')) = :recurrence");
            params.addValue("recurrence", filter.recurrence().trim().toUpperCase());
        }
        if (hasText(filter.status())) {
            sql.append(" and upper(coalesce(").append(alias).append(".subscription_status, '')) = :subscriptionStatus");
            params.addValue("subscriptionStatus", filter.status().trim().toUpperCase());
        }
        if (filter.planId() != null) {
            sql.append(" and ").append(alias).append(".plan_id = :planId");
            params.addValue("planId", filter.planId());
        }
        if (hasText(filter.origin())) {
            sql.append(" and lower(coalesce(").append(alias).append(".origin_source, '')) = :originSource");
            params.addValue("originSource", filter.origin().trim().toLowerCase());
        }
        if (hasText(filter.search())) {
            sql.append(" and (");
            sql.append("lower(coalesce(").append(alias).append(".name, '')) like :search ");
            sql.append("or lower(coalesce(").append(alias).append(".email, '')) like :search)");
            params.addValue("search", "%" + filter.search().trim().toLowerCase() + "%");
        }
    }

    public static void appendStockFilter(StringBuilder sql, MapSqlParameterSource params, String stockAlias, String stockSize) {
        if (!hasText(stockSize)) return;
        String normalized = stockSize.trim().toUpperCase();
        String alias = stockAlias == null || stockAlias.isBlank() ? "stock" : stockAlias;
        if ("UP_TO_20".equals(normalized)) {
            sql.append(" and coalesce(").append(alias).append(".stock_count, 0) <= 20");
            return;
        }
        if ("FROM_20_TO_50".equals(normalized)) {
            sql.append(" and coalesce(").append(alias).append(".stock_count, 0) > 20 and coalesce(").append(alias).append(".stock_count, 0) <= 50");
            return;
        }
        if ("OVER_50".equals(normalized)) {
            sql.append(" and coalesce(").append(alias).append(".stock_count, 0) > 50");
        }
    }

    public static boolean hasText(String value) {
        return value != null && !value.trim().isBlank();
    }
}
