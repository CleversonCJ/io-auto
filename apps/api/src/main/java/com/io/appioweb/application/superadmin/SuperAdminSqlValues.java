package com.io.appioweb.application.superadmin;

import java.sql.Timestamp;
import java.time.Instant;

final class SuperAdminSqlValues {

    private SuperAdminSqlValues() {
    }

    static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }
}
