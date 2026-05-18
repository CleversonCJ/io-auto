package com.io.appioweb.config;

import com.io.appioweb.adapters.security.AccessBlacklistFilter;
import com.io.appioweb.adapters.security.OnboardingSecurityFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("roles");
        authoritiesConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return authenticationConverter;
    }

    /**
     * HIGH PRIORITY chain for Onboarding API.
     * This chain DOES NOT use OAuth2/JWT resource server, so it won't conflict with the Bearer token.
     */
    @Bean
    @Order(1)
    SecurityFilterChain onboardingFilterChain(
            HttpSecurity http,
            OnboardingSecurityFilter onboardingSecurityFilter
    ) throws Exception {
        http
                .securityMatcher("/v1/onboarding/**")
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(onboardingSecurityFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );

        return http.build();
    }

    /**
     * Standard chain for the rest of the application.
     */
    @Bean
    @Order(2)
    SecurityFilterChain defaultFilterChain(
            HttpSecurity http,
            AccessBlacklistFilter blacklistFilter,
            JwtAuthenticationConverter jwtAuthenticationConverter
    ) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.POST, "/public/stock/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/public/partners").permitAll()
                        .requestMatchers(HttpMethod.POST, "/public/partners/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/public/password-setup/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/stock/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/partners").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/partners/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/password-setup/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/integrations/google/oauth/callback").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/integrations/olx/oauth/callback").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/integrations/mercadolivre/oauth/callback").permitAll()
                        .requestMatchers("/webhooks/**").permitAll()
                        .requestMatchers("/api/webhooks/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));

        http.addFilterBefore(blacklistFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
