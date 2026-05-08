package com.io.appioweb.adapters.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;

/**
 * Security filter for the onboarding API endpoints (/v1/onboarding/**).
 * <p>
 * Validates the Authorization header against the internal API token from env var.
 * Uses constant-time comparison to prevent timing attacks.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class OnboardingSecurityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(OnboardingSecurityFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final String internalApiToken;

    public OnboardingSecurityFilter(
            @Value("${ONBOARDING_INTERNAL_API_TOKEN:}") String internalApiToken
    ) {
        this.internalApiToken = internalApiToken != null ? internalApiToken.trim() : "";
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/v1/onboarding");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (internalApiToken.isBlank()) {
            log.error("[OnboardingSecurity] ONBOARDING_INTERNAL_API_TOKEN not configured – rejecting request");
            sendUnauthorized(response, "Onboarding API token not configured.");
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            log.warn("[OnboardingSecurity] Missing or malformed Authorization header");
            sendUnauthorized(response, "Authorization header is required.");
            return;
        }

        String providedToken = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (!constantTimeEquals(internalApiToken, providedToken)) {
            log.warn("[OnboardingSecurity] Invalid token for onboarding request: {}", request.getRequestURI());
            sendUnauthorized(response, "Invalid authorization token.");
            return;
        }

        log.debug("[OnboardingSecurity] Token validated for: {}", request.getRequestURI());
        
        // Register a temporary internal authentication so other filters (like JWT) don't try to process this request
        org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth = 
            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                "onboarding-internal", null, 
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ONBOARDING_INTERNAL"))
            );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"ONBOARDING_UNAUTHORIZED\",\"message\":\"" + message + "\"}");
    }

    /**
     * Constant-time comparison to prevent timing attacks.
     */
    private boolean constantTimeEquals(String expected, String actual) {
        try {
            return MessageDigest.isEqual(
                    expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    actual.getBytes(java.nio.charset.StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }
}
