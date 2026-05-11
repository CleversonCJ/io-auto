package com.io.appioweb.bootstrap;

import com.io.appioweb.adapters.cache.RedisTokenStore;
import com.io.appioweb.adapters.persistence.auth.*;
import com.io.appioweb.adapters.security.*;
import com.io.appioweb.application.auth.port.in.*;
import com.io.appioweb.application.auth.port.out.*;
import com.io.appioweb.application.auth.usecase.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

import java.time.Duration;

@Configuration
public class AuthBootstrap {

    @Bean
    RedisTokenStore redisTokenStore(StringRedisTemplate redis) {
        return new RedisTokenStore(redis);
    }

    @Bean
    PasswordHasherPort passwordHasherPort() {
        return new BcryptPasswordHasher();
    }

    @Bean
    UserRepositoryPort userRepositoryPort(UserRepositoryJpa jpa, RoleRepositoryJpa roleJpa) {
        return new UserRepositoryAdapter(jpa, roleJpa);
    }

    @Bean
    TeamRepositoryPort teamRepositoryPort(TeamRepositoryJpa jpa) {
        return new TeamRepositoryAdapter(jpa);
    }

    @Bean
    RoleRepositoryPort roleRepositoryPort(RoleRepositoryJpa jpa) {
        return new RoleRepositoryAdapter(jpa);
    }

    @Bean
    CompanyRepositoryPort companyRepositoryPort(CompanyRepositoryJpa jpa) {
        return new CompanyRepositoryAdapter(jpa);
    }

    @Bean
    CurrentUserPort currentUserPort() {
        return new SpringCurrentUserAdapter();
    }

    @Bean
    TokenServicePort tokenServicePort(
            JwtEncoder encoder,
            JwtDecoder decoder,
            RedisTokenStore store,
            @Value("${app.security.jwt.issuer}") String issuer,
            @Value("${app.security.jwt.access-ttl-minutes}") long accessMin,
            @Value("${app.security.jwt.refresh-ttl-days}") long refreshDays
    ) {
        return new JwtTokenService(
                encoder, decoder, store, issuer,
                Duration.ofMinutes(accessMin),
                Duration.ofDays(refreshDays)
        );
    }

    @Bean
    AuthUseCase authUseCase(UserRepositoryPort users, CompanyRepositoryPort companies, PasswordHasherPort hasher, TokenServicePort tokens) {
        return new LoginUseCase(users, companies, hasher, tokens);
    }

    @Bean
    RoleQueryUseCase roleQueryUseCase(RoleRepositoryPort roles) {
        return new ListRolesUseCase(roles);
    }

    @Bean
    UserAdminUseCase meUseCase(CurrentUserPort current, UserRepositoryPort users, TeamRepositoryPort teams, CompanyRepositoryPort companies) {
        return new MeUseCase(current, users, teams, companies);
    }

    @Bean(name = "createUserUseCase")
    UserAdminUseCase createUserUseCase(UserRepositoryPort users, RoleRepositoryPort roles, PasswordHasherPort hasher, CurrentUserPort current, TeamRepositoryPort teams) {
        return new CreateUserUseCase(users, roles, hasher, current, teams);
    }

    @Bean
    CompanyAdminUseCase companyAdminUseCase(
            CompanyRepositoryPort companies,
            UserRepositoryPort users,
            RoleRepositoryPort roles,
            PasswordHasherPort hasher,
            TeamRepositoryPort teams
    ) {
        return new CreateCompanyUseCase(companies, users, roles, hasher, teams);
    }
}
