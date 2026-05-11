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
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Security filter for the onboarding API endpoints (/v1/onboarding/**).
 * <p>
 * Default authentication: Authorization Bearer ONBOARDING_INTERNAL_API_TOKEN.
 * Special case: /v1/onboarding/asaas/payment-event also accepts asaas-access-token.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class OnboardingSecurityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(OnboardingSecurityFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String ASAAS_TOKEN_HEADER = "asaas-access-token";
    private static final String PAYMENT_EVENT_PATH = "/v1/onboarding/asaas/payment-event";

    private final String internalApiToken;
    private final String asaasWebhookToken;
    private final Set<String> allowedIps;

    public OnboardingSecurityFilter(
            @Value("${ONBOARDING_INTERNAL_API_TOKEN:}") String internalApiToken,
            @Value("${ASAAS_WEBHOOK_TOKEN:}") String asaasWebhookToken,
            @Value("${ONBOARDING_ALLOWED_IPS:}") String allowedIps
    ) {
        this.internalApiToken = internalApiToken != null ? internalApiToken.trim() : "";
        this.asaasWebhookToken = asaasWebhookToken != null ? asaasWebhookToken.trim() : "";
        this.allowedIps = parseAllowedIps(allowedIps);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/v1/onboarding");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        boolean paymentEventPath = isPaymentEventPath(path);

        if (!paymentEventPath && internalApiToken.isBlank()) {
            log.error("[OnboardingSecurity] ONBOARDING_INTERNAL_API_TOKEN not configured - rejecting request");
            sendUnauthorized(response, "Onboarding API token not configured.");
            return;
        }

        boolean authenticated;
        if (paymentEventPath) {
            authenticated = validateBearerToken(request) || validateAsaasWebhookToken(request);
            if (!authenticated) {
                log.warn("[OnboardingSecurity] Missing or invalid token for payment-event endpoint");
                sendUnauthorized(response, "Authorization header or asaas-access-token is required.");
                return;
            }
        } else {
            authenticated = validateBearerToken(request);
            if (!authenticated) {
                log.warn("[OnboardingSecurity] Missing or invalid Authorization token");
                sendUnauthorized(response, "Authorization header is required.");
                return;
            }
        }

        String requesterIp = resolveRequesterIp(request);
        if (!isAllowedIp(requesterIp)) {
            log.warn("[OnboardingSecurity] Blocked IP {} for onboarding request: {}", requesterIp, request.getRequestURI());
            sendUnauthorized(response, "IP not allowed.");
            return;
        }

        log.debug("[OnboardingSecurity] Token validated for: {}", request.getRequestURI());

        org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "onboarding-internal",
                        null,
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

    private Set<String> parseAllowedIps(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return Set.of();
        }

        Set<String> ips = new LinkedHashSet<>();
        Arrays.stream(rawValue.split(","))
                .map(String::trim)
                .filter(ip -> !ip.isBlank())
                .forEach(ips::add);
        return ips;
    }

    private String resolveRequesterIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] values = forwardedFor.split(",");
            if (values.length > 0 && values[0] != null && !values[0].isBlank()) {
                return values[0].trim();
            }
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr() != null ? request.getRemoteAddr().trim() : "";
    }

    private boolean isAllowedIp(String requesterIp) {
        if (allowedIps.isEmpty()) {
            return true;
        }

        return requesterIp != null && allowedIps.contains(requesterIp.trim());
    }

    private boolean isPaymentEventPath(String path) {
        if (path == null || path.isBlank()) {
            return false;
        }

        String normalized = path.trim();
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        return normalized.equals(PAYMENT_EVENT_PATH) || normalized.endsWith(PAYMENT_EVENT_PATH);
    }

    private boolean validateBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return false;
        }
        if (internalApiToken.isBlank()) {
            return false;
        }

        String providedToken = authHeader.substring(BEARER_PREFIX.length()).trim();
        return constantTimeEquals(internalApiToken, providedToken);
    }

    private boolean validateAsaasWebhookToken(HttpServletRequest request) {
        String provided = request.getHeader(ASAAS_TOKEN_HEADER);
        if (provided == null || provided.isBlank()) {
            return false;
        }
        if (asaasWebhookToken.isBlank()) {
            return false;
        }
        return constantTimeEquals(asaasWebhookToken, provided.trim());
    }
}
