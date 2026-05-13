package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.auth.JpaUserEntity;
import com.io.appioweb.adapters.persistence.auth.UserRepositoryJpa;
import com.io.appioweb.adapters.persistence.onboarding.JpaPasswordResetTokenEntity;
import com.io.appioweb.adapters.persistence.onboarding.PasswordResetTokenRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.JpaTenantAdminLogEntity;
import com.io.appioweb.adapters.persistence.superadmin.TenantAdminLogRepositoryJpa;
import com.io.appioweb.application.auth.dto.AuthTokens;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.TokenServicePort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SuperAdminTenantManagementService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final NamedParameterJdbcTemplate jdbc;
    private final CustomerHealthScoreService healthScoreService;
    private final TenantAdminLogRepositoryJpa logs;
    private final UserRepositoryJpa users;
    private final TokenServicePort tokens;
    private final CurrentUserPort currentUser;
    private final PasswordResetTokenRepositoryJpa passwordResetTokens;
    private final SuperAdminPlanManagementService planManagementService;

    public SuperAdminTenantManagementService(
            NamedParameterJdbcTemplate jdbc,
            CustomerHealthScoreService healthScoreService,
            TenantAdminLogRepositoryJpa logs,
            UserRepositoryJpa users,
            TokenServicePort tokens,
            CurrentUserPort currentUser,
            PasswordResetTokenRepositoryJpa passwordResetTokens,
            SuperAdminPlanManagementService planManagementService
    ) {
        this.jdbc = jdbc;
        this.healthScoreService = healthScoreService;
        this.logs = logs;
        this.users = users;
        this.tokens = tokens;
        this.currentUser = currentUser;
        this.passwordResetTokens = passwordResetTokens;
        this.planManagementService = planManagementService;
    }

    @Transactional(readOnly = true)
    public List<TenantRow> listTenants(SuperAdminFilter filter) {
        Map<UUID, CustomerHealthScoreService.CustomerHealthScoreRow> healthByTenant = healthScoreService.listHealthScores(filter).stream()
                .collect(Collectors.toMap(CustomerHealthScoreService.CustomerHealthScoreRow::tenantId, row -> row, (left, right) -> left));

        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" where 1=1 ");
        SuperAdminSqlFilterBuilder.appendCompanyFilters(where, params, filter, "c");
        SuperAdminSqlFilterBuilder.appendStockFilter(where, params, "stock", filter.stockSize());

        String sql = """
                with stock as (
                    select v.company_id, count(*) as stock_count
                    from ioauto_vehicles v
                    group by v.company_id
                ),
                ads as (
                    select p.company_id,
                           sum(case when upper(coalesce(p.status, '')) in ('ACTIVE', 'PUBLISHED', 'ONLINE', 'SYNCED') then 1 else 0 end) as active_ads
                    from ioauto_vehicle_publications p
                    group by p.company_id
                ),
                latest_billing as (
                    select distinct on (b.company_id)
                        b.company_id,
                        b.plan_name,
                        b.plan_key,
                        b.amount_cents,
                        b.billing_interval
                    from ioauto_billing_subscriptions b
                    order by b.company_id, b.updated_at desc
                )
                select
                    c.id,
                    c.name,
                    c.email,
                    c.cidade,
                    c.uf,
                    c.origin_source,
                    c.plan_id,
                    c.subscription_started_at,
                    c.created_at,
                    c.last_access_at,
                    upper(coalesce(nullif(c.subscription_status, ''), nullif(c.status, ''), 'ACTIVE')) as subscription_status,
                    coalesce(nullif(latest_billing.plan_name, ''), plan.plan_name, 'Start') as plan_name,
                    coalesce(nullif(latest_billing.plan_key, ''), plan.plan_key, 'start') as plan_key,
                    coalesce(
                        c.subscription_amount_cents,
                        latest_billing.amount_cents,
                        case
                            when upper(
                                coalesce(
                                    nullif(c.billing_recurrence, ''),
                                    case
                                        when upper(coalesce(latest_billing.billing_interval, '')) in ('YEAR', 'ANNUAL', 'YEARLY') then 'YEARLY'
                                        when upper(coalesce(latest_billing.billing_interval, '')) in ('WEEK', 'WEEKLY') then 'WEEKLY'
                                        else upper(nullif(latest_billing.billing_interval, ''))
                                    end,
                                    nullif(plan.billing_recurrence, ''),
                                    'MONTHLY'
                                )
                            ) in ('ANNUAL', 'YEARLY', 'YEAR')
                                then coalesce(plan.annual_price_cents, plan.price_cents, plan.monthly_price_cents, 0)
                            else coalesce(plan.monthly_price_cents, plan.price_cents, plan.annual_price_cents, 0)
                        end
                    ) as subscription_amount_cents,
                    upper(coalesce(
                        case
                            when upper(coalesce(latest_billing.billing_interval, '')) in ('YEAR', 'ANNUAL', 'YEARLY') then 'YEARLY'
                            when upper(coalesce(latest_billing.billing_interval, '')) in ('WEEK', 'WEEKLY') then 'WEEKLY'
                            when upper(coalesce(latest_billing.billing_interval, '')) in ('MONTH', 'MONTHLY') then 'MONTHLY'
                            else nullif(latest_billing.billing_interval, '')
                        end,
                        nullif(c.billing_recurrence, ''),
                        nullif(plan.billing_recurrence, ''),
                        'MONTHLY'
                    )) as recurrence,
                    coalesce(stock.stock_count, 0) as stock_count,
                    coalesce(ads.active_ads, 0) as active_ads
                from companies c
                left join ioauto_subscription_plans plan on plan.id = c.plan_id
                left join stock on stock.company_id = c.id
                left join ads on ads.company_id = c.id
                left join latest_billing on latest_billing.company_id = c.id
                %s
                order by c.name asc
                """.formatted(where);

        List<TenantRow> rows = new ArrayList<>();
        jdbc.query(sql, params, rs -> {
            UUID tenantId = UUID.fromString(rs.getString("id"));
            long subscriptionAmountCents = rs.getLong("subscription_amount_cents");
            String recurrence = rs.getString("recurrence");
            long mrrCents = toMrrCents(subscriptionAmountCents, recurrence);

            CustomerHealthScoreService.CustomerHealthScoreRow health = healthByTenant.get(tenantId);
            int healthScore = health == null ? 0 : health.score();
            String healthClassification = health == null ? "INTERMEDIARIO" : health.classification();

            rows.add(new TenantRow(
                    tenantId,
                    rs.getString("name"),
                    rs.getString("email"),
                    rs.getObject("plan_id") == null ? null : UUID.fromString(rs.getObject("plan_id").toString()),
                    rs.getString("plan_name"),
                    rs.getString("plan_key"),
                    rs.getString("subscription_status"),
                    subscriptionAmountCents,
                    recurrence,
                    rs.getTimestamp("subscription_started_at") == null
                            ? rs.getTimestamp("created_at").toInstant()
                            : rs.getTimestamp("subscription_started_at").toInstant(),
                    rs.getTimestamp("last_access_at") == null ? null : rs.getTimestamp("last_access_at").toInstant(),
                    mrrCents,
                    rs.getString("cidade"),
                    rs.getString("uf"),
                    rs.getString("origin_source"),
                    rs.getLong("stock_count"),
                    rs.getLong("active_ads"),
                    healthScore,
                    healthClassification
            ));
        });

        return rows;
    }

    @Transactional
    public ImpersonationResult impersonateTenant(UUID tenantId) {
        JpaUserEntity target = resolvePreferredTenantUser(tenantId);
        Set<String> roles = target.getRoles().stream().map(role -> role.getName().toUpperCase(Locale.ROOT)).collect(Collectors.toSet());
        if (roles.isEmpty()) {
            roles = Set.of("ADMIN");
        }

        User user = new User(
                target.getId(),
                target.getCompanyId(),
                target.getEmail(),
                target.getPasswordHash() == null ? "n/a" : target.getPasswordHash(),
                target.getFullName(),
                target.getProfileImageUrl(),
                target.getJobTitle(),
                target.getBirthDate(),
                target.getPermissionPreset(),
                parseModulePermissions(target.getModulePermissions()),
                target.getTeamId(),
                target.isActive(),
                target.getCreatedAt(),
                roles
        );

        AuthTokens issued = tokens.issueImpersonationTokens(user, currentUser.userId(), tenantId);

        logAction(
                tenantId,
                "TENANT_IMPERSONATION_STARTED",
                "Superadmin iniciou impersonacao da conta.",
                Map.of(
                        "targetUserId", target.getId().toString(),
                        "targetUserEmail", safe(target.getEmail())
                )
        );

        long expiresInSeconds = issued.accessExpiresInSeconds();
        return new ImpersonationResult(
                tenantId,
                target.getId(),
                safe(target.getFullName()),
                safe(target.getEmail()),
                issued.accessToken(),
                issued.refreshToken(),
                expiresInSeconds
        );
    }

    @Transactional
    public ImpersonationExitResult exitImpersonation() {
        if (!currentUser.impersonation()) {
            throw new BusinessException("IMPERSONATION_NOT_ACTIVE", "Nao existe impersonacao ativa para encerrar.");
        }

        UUID actorId = currentUser.actorSuperAdminId();
        if (actorId == null) {
            throw new BusinessException("IMPERSONATION_INVALID_ACTOR", "Nao foi possivel identificar o superadmin responsavel pela impersonacao.");
        }

        JpaUserEntity actor = users.findById(actorId)
                .orElseThrow(() -> new BusinessException("IMPERSONATION_ACTOR_NOT_FOUND", "Superadmin de origem nao encontrado."));

        boolean isSuperAdmin = actor.getRoles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role.getName()));
        if (!isSuperAdmin) {
            throw new BusinessException("IMPERSONATION_ACTOR_NOT_SUPERADMIN", "Usuario de origem nao possui perfil SUPERADMIN.");
        }

        Set<String> actorRoles = actor.getRoles().stream().map(role -> role.getName().toUpperCase(Locale.ROOT)).collect(Collectors.toSet());

        User actorUser = new User(
                actor.getId(),
                actor.getCompanyId(),
                actor.getEmail(),
                actor.getPasswordHash() == null ? "n/a" : actor.getPasswordHash(),
                actor.getFullName(),
                actor.getProfileImageUrl(),
                actor.getJobTitle(),
                actor.getBirthDate(),
                actor.getPermissionPreset(),
                parseModulePermissions(actor.getModulePermissions()),
                actor.getTeamId(),
                actor.isActive(),
                actor.getCreatedAt(),
                actorRoles
        );

        AuthTokens issued = tokens.issueTokens(actorUser);

        return new ImpersonationExitResult(
                actor.getId(),
                actor.getCompanyId(),
                safe(actor.getFullName()),
                safe(actor.getEmail()),
                issued.accessToken(),
                issued.refreshToken(),
                issued.accessExpiresInSeconds()
        );
    }

    @Transactional
    public TenantRow updatePlan(UUID tenantId, UpdateTenantPlanCommand command) {
        ensureTenantExists(tenantId);

        boolean hasPlanReference = command.planId() != null
                || normalizeNullable(command.planName()) != null
                || normalizeNullable(command.planKey()) != null;
        var resolvedPlan = planManagementService.resolveReferencedPlan(command.planId(), command.planKey(), command.planName());
        if (hasPlanReference && resolvedPlan.isEmpty()) {
            throw new BusinessException("PLAN_NOT_FOUND", "Selecione um plano valido para a conta.");
        }
        resolvedPlan.ifPresent(plan -> planManagementService.assertTenantFitsPlan(tenantId, plan));

        UUID resolvedPlanId = resolvedPlan.map(SuperAdminPlanManagementService.PlanSnapshot::planId).orElse(null);
        String resolvedPlanName = resolvedPlan.map(SuperAdminPlanManagementService.PlanSnapshot::planName).orElse(normalizeNullable(command.planName()));
        String resolvedPlanKey = resolvedPlan.map(SuperAdminPlanManagementService.PlanSnapshot::planKey).orElse(normalizeNullable(command.planKey()));
        String resolvedRecurrence = normalizeRecurrence(
                command.billingRecurrence() != null
                        ? command.billingRecurrence()
                        : resolvedPlan.map(SuperAdminPlanManagementService.PlanSnapshot::billingRecurrence).orElse(null)
        );
        Long resolvedAmountCents = command.subscriptionAmountCents() != null
                ? Math.max(command.subscriptionAmountCents(), 0L)
                : resolvedPlan.map(plan -> plan.priceForRecurrence(resolvedRecurrence)).orElse(null);

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("planId", resolvedPlanId)
                .addValue("amountCents", resolvedAmountCents)
                .addValue("recurrence", resolvedRecurrence)
                .addValue("status", normalizeSubscriptionStatus(command.subscriptionStatus()))
                .addValue("updatedAt", SuperAdminSqlValues.timestamp(Instant.now()));

        jdbc.update("""
                update companies
                set
                    plan_id = coalesce(:planId, plan_id),
                    subscription_amount_cents = coalesce(:amountCents, subscription_amount_cents),
                    billing_recurrence = coalesce(:recurrence, billing_recurrence),
                    subscription_status = coalesce(:status, subscription_status),
                    updated_at = :updatedAt
                where id = :tenantId
                """, params);

        if (resolvedPlanName != null || resolvedPlanKey != null || resolvedAmountCents != null) {
            MapSqlParameterSource billingParams = new MapSqlParameterSource()
                    .addValue("tenantId", tenantId)
                    .addValue("planName", resolvedPlanName)
                    .addValue("planKey", resolvedPlanKey)
                    .addValue("amountCents", resolvedAmountCents)
                    .addValue("billingInterval", mapBillingInterval(resolvedRecurrence))
                    .addValue("updatedAt", SuperAdminSqlValues.timestamp(Instant.now()));

            jdbc.update("""
                    update ioauto_billing_subscriptions b
                    set
                        plan_name = coalesce(:planName, b.plan_name),
                        plan_key = coalesce(:planKey, b.plan_key),
                        amount_cents = coalesce(:amountCents, b.amount_cents),
                        billing_interval = coalesce(:billingInterval, b.billing_interval),
                        updated_at = :updatedAt
                    where b.id = (
                        select id
                        from ioauto_billing_subscriptions
                        where company_id = :tenantId
                        order by updated_at desc
                        limit 1
                    )
                    """, billingParams);
        }

        logAction(
                tenantId,
                "TENANT_PLAN_UPDATED",
                "Plano da conta alterado pelo superadmin.",
                Map.of(
                        "planId", safeUuid(resolvedPlanId),
                        "planName", safe(resolvedPlanName),
                        "planKey", safe(resolvedPlanKey),
                        "subscriptionAmountCents", resolvedAmountCents == null ? "" : String.valueOf(resolvedAmountCents),
                        "billingRecurrence", safe(resolvedRecurrence)
                )
        );

        return listTenants(new SuperAdminFilter(null, null, null, null, null, null, null, null, null, null, null, null, null)).stream()
                .filter(row -> row.tenantId().equals(tenantId))
                .findFirst()
                .orElseThrow(() -> new BusinessException("TENANT_NOT_FOUND", "Tenant nao encontrado."));
    }

    @Transactional
    public void blockTenant(UUID tenantId, String reason) {
        ensureTenantExists(tenantId);
        Instant now = Instant.now();

        jdbc.update("""
                update companies
                set
                    status = 'BLOCKED',
                    subscription_status = 'BLOCKED',
                    blocked_at = :blockedAt,
                    updated_at = :blockedAt
                where id = :tenantId
                """,
                new MapSqlParameterSource()
                        .addValue("tenantId", tenantId)
                        .addValue("blockedAt", SuperAdminSqlValues.timestamp(now))
        );

        logAction(
                tenantId,
                "TENANT_BLOCKED",
                "Conta bloqueada pelo superadmin.",
                Map.of("reason", safe(reason))
        );
    }

    @Transactional
    public void unblockTenant(UUID tenantId, String reason) {
        ensureTenantExists(tenantId);
        Instant now = Instant.now();

        jdbc.update("""
                update companies
                set
                    status = 'ACTIVE',
                    subscription_status = case
                        when upper(coalesce(subscription_status, 'ACTIVE')) = 'BLOCKED' then 'ACTIVE'
                        else subscription_status
                    end,
                    blocked_at = null,
                    updated_at = :updatedAt
                where id = :tenantId
                """,
                new MapSqlParameterSource()
                        .addValue("tenantId", tenantId)
                        .addValue("updatedAt", SuperAdminSqlValues.timestamp(now))
        );

        logAction(
                tenantId,
                "TENANT_UNBLOCKED",
                "Conta desbloqueada pelo superadmin.",
                Map.of("reason", safe(reason))
        );
    }

    @Transactional
    public ResetPasswordResult resetUserPassword(UUID tenantId, UUID userId) {
        ensureTenantExists(tenantId);

        JpaUserEntity user = users.findByIdAndCompanyId(userId, tenantId)
                .orElseThrow(() -> new BusinessException("TENANT_USER_NOT_FOUND", "Usuario do tenant nao encontrado."));

        jdbc.update(
                "update password_reset_tokens set used = true where user_id = :userId and used = false",
                new MapSqlParameterSource("userId", userId)
        );

        Instant now = Instant.now();
        Instant expiresAt = now.plus(24, ChronoUnit.HOURS);
        String tokenValue = generateResetToken();

        JpaPasswordResetTokenEntity token = new JpaPasswordResetTokenEntity();
        token.setId(UUID.randomUUID());
        token.setUserId(userId);
        token.setToken(tokenValue);
        token.setExpiresAt(expiresAt);
        token.setUsed(false);
        token.setCreatedAt(now);
        passwordResetTokens.save(token);

        logAction(
                tenantId,
                "TENANT_USER_PASSWORD_RESET",
                "Superadmin solicitou reset de senha do usuario.",
                Map.of(
                        "userId", userId.toString(),
                        "userEmail", safe(user.getEmail())
                )
        );

        return new ResetPasswordResult(
                tenantId,
                userId,
                safe(user.getEmail()),
                tokenValue,
                expiresAt
        );
    }

    @Transactional
    public ResetPasswordResult resetPreferredUserPassword(UUID tenantId) {
        JpaUserEntity preferredUser = resolvePreferredTenantUser(tenantId);
        return resetUserPassword(tenantId, preferredUser.getId());
    }

    @Transactional(readOnly = true)
    public List<TenantAdminLogRow> listLogs(UUID tenantId) {
        return logs.findTop200ByCompanyIdOrderByCreatedAtDesc(tenantId).stream()
                .map(log -> new TenantAdminLogRow(
                        log.getId(),
                        log.getCompanyId(),
                        log.getActorUserId(),
                        log.getAction(),
                        log.getDescription(),
                        log.getMetadata(),
                        log.getCreatedAt()
                ))
                .toList();
    }

    private void ensureTenantExists(UUID tenantId) {
        Long exists = jdbc.queryForObject(
                "select count(*) from companies where id = :tenantId",
                new MapSqlParameterSource("tenantId", tenantId),
                Long.class
        );
        if (exists == null || exists == 0L) {
            throw new BusinessException("TENANT_NOT_FOUND", "Tenant nao encontrado.");
        }
    }

    private long toMrrCents(long amountCents, String recurrence) {
        String normalized = recurrence == null ? "MONTHLY" : recurrence.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ANNUAL", "YEARLY", "YEAR" -> Math.round(amountCents / 12.0D);
            case "QUARTERLY" -> Math.round(amountCents / 3.0D);
            case "SEMIANNUALLY" -> Math.round(amountCents / 6.0D);
            case "WEEKLY" -> Math.round(amountCents * (52.0D / 12.0D));
            case "BIWEEKLY" -> Math.round(amountCents * (26.0D / 12.0D));
            default -> amountCents;
        };
    }

    private Set<String> parseModulePermissions(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toCollection(HashSet::new));
    }

    private String normalizeRecurrence(String raw) {
        String normalized = normalizeNullable(raw);
        if (normalized == null) return null;
        String value = normalized.toUpperCase(Locale.ROOT);
        return switch (value) {
            case "MONTH", "MONTHLY", "MENSAL" -> "MONTHLY";
            case "YEAR", "YEARLY", "ANNUAL", "ANUAL" -> "YEARLY";
            case "WEEK", "WEEKLY", "SEMANAL" -> "WEEKLY";
            case "BIWEEKLY", "QUINZENAL" -> "BIWEEKLY";
            case "QUARTERLY", "TRIMESTRAL" -> "QUARTERLY";
            case "SEMIANNUALLY", "SEMIANNUAL", "SEMESTRAL" -> "SEMIANNUALLY";
            default -> throw new BusinessException(
                    "TENANT_PLAN_RECURRENCE_INVALID",
                    "Recorrencia invalida. Use MONTHLY, YEARLY, WEEKLY, BIWEEKLY, QUARTERLY ou SEMIANNUALLY."
            );
        };
    }

    private String mapBillingInterval(String recurrence) {
        if (recurrence == null) return null;
        return recurrence;
    }

    private String normalizeNullable(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String normalizeSubscriptionStatus(String raw) {
        String normalized = normalizeNullable(raw);
        if (normalized == null) return null;
        String upper = normalized.toUpperCase(Locale.ROOT);
        if ("TRIAL".equals(upper) || "TRIALING".equals(upper)) {
            throw new BusinessException("TENANT_PLAN_STATUS_INVALID", "Status TRIAL nao e permitido.");
        }
        return upper;
    }

    private String generateResetToken() {
        byte[] random = new byte[16];
        RANDOM.nextBytes(random);
        StringBuilder sb = new StringBuilder();
        for (byte value : random) {
            sb.append(String.format("%02x", value));
        }
        return UUID.randomUUID() + sb.toString();
    }

    private void logAction(UUID tenantId, String action, String description, Map<String, String> metadata) {
        try {
            JpaTenantAdminLogEntity entity = new JpaTenantAdminLogEntity();
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(tenantId);
            entity.setActorUserId(currentUser.userId());
            entity.setAction(action);
            entity.setDescription(description);
            Map<String, String> enriched = new HashMap<>(metadata == null ? Map.of() : metadata);
            enriched.put("actorUserId", safeUuid(currentUser.userId()));
            entity.setMetadata(OBJECT_MAPPER.writeValueAsString(enriched));
            entity.setCreatedAt(Instant.now());
            logs.save(entity);
        } catch (Exception ignored) {
            // keep admin action flow resilient even when log serialization fails
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String safeUuid(UUID value) {
        return value == null ? "" : value.toString();
    }

    private JpaUserEntity resolvePreferredTenantUser(UUID tenantId) {
        List<JpaUserEntity> tenantUsers = users.findAllByCompanyId(tenantId).stream()
                .filter(JpaUserEntity::isActive)
                .sorted(Comparator
                        .comparing((JpaUserEntity user) -> user.getRoles().stream().anyMatch(role -> "ADMIN".equalsIgnoreCase(role.getName()) || "SUPERADMIN".equalsIgnoreCase(role.getName())) ? 0 : 1)
                        .thenComparing(user -> user.isPrimary() ? 0 : 1)
                        .thenComparing(JpaUserEntity::getCreatedAt)
                )
                .toList();

        if (tenantUsers.isEmpty()) {
            throw new BusinessException("TENANT_IMPERSONATION_USER_NOT_FOUND", "Nao foi encontrado usuario ativo para este tenant.");
        }

        return tenantUsers.get(0);
    }

    public record TenantRow(
            UUID tenantId,
            String companyName,
            String companyEmail,
            UUID planId,
            String planName,
            String planKey,
            String status,
            long subscriptionAmountCents,
            String billingRecurrence,
            Instant entryDate,
            Instant lastAccessAt,
            long mrrCents,
            String city,
            String region,
            String originSource,
            long stockCount,
            long activeAdsCount,
            int healthScore,
            String healthClassification
    ) {
    }

    public record UpdateTenantPlanCommand(
            UUID planId,
            String planName,
            String planKey,
            Long subscriptionAmountCents,
            String billingRecurrence,
            String subscriptionStatus
    ) {
    }

    public record ImpersonationResult(
            UUID tenantId,
            UUID impersonatedUserId,
            String impersonatedUserName,
            String impersonatedUserEmail,
            String accessToken,
            String refreshToken,
            long accessExpiresInSeconds
    ) {
    }

    public record ImpersonationExitResult(
            UUID actorUserId,
            UUID actorTenantId,
            String actorName,
            String actorEmail,
            String accessToken,
            String refreshToken,
            long accessExpiresInSeconds
    ) {
    }

    public record ResetPasswordResult(
            UUID tenantId,
            UUID userId,
            String userEmail,
            String token,
            Instant expiresAt
    ) {
    }

    public record TenantAdminLogRow(
            UUID id,
            UUID tenantId,
            UUID actorUserId,
            String action,
            String description,
            String metadata,
            Instant createdAt
    ) {
    }
}

