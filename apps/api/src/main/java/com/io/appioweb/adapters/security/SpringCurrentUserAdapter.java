package com.io.appioweb.adapters.security;

import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public class SpringCurrentUserAdapter implements CurrentUserPort {

    private JwtAuthenticationToken auth() {
        return (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
    }

    @Override public UUID userId() { return UUID.fromString(auth().getToken().getSubject()); }

    @Override public UUID companyId() { return UUID.fromString(auth().getToken().getClaimAsString("cid")); }

    @Override public String email() {
        // Não colocamos email no token (opcional). Se quiser, inclua.
        return "n/a";
    }

    @Override public Set<String> roles() {
        var list = auth().getToken().getClaimAsStringList("roles");
        return list == null ? Set.of() : list.stream().collect(Collectors.toSet());
    }

    @Override public boolean impersonation() {
        Boolean claim = auth().getToken().getClaim("impersonation");
        return Boolean.TRUE.equals(claim);
    }

    @Override public UUID actorSuperAdminId() {
        String raw = auth().getToken().getClaimAsString("actorSuperAdminId");
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    @Override public UUID impersonatedTenantId() {
        String raw = auth().getToken().getClaimAsString("impersonatedTenantId");
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
