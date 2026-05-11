package com.io.appioweb.application.superadmin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public record SuperAdminTimeWindow(
        LocalDate fromDate,
        LocalDate toDate,
        Instant fromAt,
        Instant toExclusiveAt
) {

    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    public static SuperAdminTimeWindow of(LocalDate fromDate, LocalDate toDate) {
        LocalDate safeFrom = fromDate == null ? LocalDate.now(ZONE).withDayOfMonth(1) : fromDate;
        LocalDate safeTo = toDate == null ? LocalDate.now(ZONE) : toDate;
        if (safeTo.isBefore(safeFrom)) {
            LocalDate swap = safeFrom;
            safeFrom = safeTo;
            safeTo = swap;
        }

        ZonedDateTime fromAt = safeFrom.atStartOfDay(ZONE);
        ZonedDateTime toExclusiveAt = safeTo.plusDays(1).atStartOfDay(ZONE);
        return new SuperAdminTimeWindow(safeFrom, safeTo, fromAt.toInstant(), toExclusiveAt.toInstant());
    }
}
