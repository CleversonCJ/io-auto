package com.io.appioweb.application.superadmin;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

public record SuperAdminFilter(
        LocalDate startDate,
        LocalDate endDate,
        Integer year,
        Integer month,
        UUID planId,
        String city,
        String region,
        String recurrence,
        String status,
        String origin,
        String stockSize,
        String search
) {

    public SuperAdminTimeWindow resolveTimeWindow() {
        if (startDate != null || endDate != null) {
            return SuperAdminTimeWindow.of(startDate, endDate);
        }
        if (year != null && month != null) {
            YearMonth ym = safeYearMonth(year, month);
            return SuperAdminTimeWindow.of(ym.atDay(1), ym.atEndOfMonth());
        }
        if (year != null) {
            LocalDate from = LocalDate.of(year, 1, 1);
            LocalDate to = LocalDate.of(year, 12, 31);
            return SuperAdminTimeWindow.of(from, to);
        }
        YearMonth current = YearMonth.now(SuperAdminTimeWindow.ZONE);
        return SuperAdminTimeWindow.of(current.atDay(1), current.atEndOfMonth());
    }

    public YearMonth resolveYearMonthOrCurrent() {
        if (year != null && month != null) {
            return safeYearMonth(year, month);
        }
        if (startDate != null) {
            return YearMonth.from(startDate);
        }
        return YearMonth.now(SuperAdminTimeWindow.ZONE);
    }

    public int resolveYearOrCurrent() {
        if (year != null) return year;
        if (startDate != null) return startDate.getYear();
        return LocalDate.now(SuperAdminTimeWindow.ZONE).getYear();
    }

    private static YearMonth safeYearMonth(Integer year, Integer month) {
        int safeYear = year == null ? LocalDate.now(SuperAdminTimeWindow.ZONE).getYear() : year;
        int safeMonth = month == null ? 1 : Math.max(1, Math.min(12, month));
        return YearMonth.of(safeYear, safeMonth);
    }
}
