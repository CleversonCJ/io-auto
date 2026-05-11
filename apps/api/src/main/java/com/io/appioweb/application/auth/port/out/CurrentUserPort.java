package com.io.appioweb.application.auth.port.out;

import java.util.Set;
import java.util.UUID;

public interface CurrentUserPort {
    UUID userId();
    UUID companyId();
    String email();
    Set<String> roles();

    default boolean impersonation() { return false; }
    default UUID actorSuperAdminId() { return null; }
    default UUID impersonatedTenantId() { return null; }
}
