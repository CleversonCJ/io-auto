package com.io.appioweb.adapters.web.auth;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoConversationRepositoryJpa;
import com.io.appioweb.adapters.web.auth.request.*;
import com.io.appioweb.adapters.web.auth.response.CompanySummaryHttpResponse;
import com.io.appioweb.adapters.web.auth.response.CreateCompanyHttpResponse;
import com.io.appioweb.adapters.web.auth.response.LoginResponse;
import com.io.appioweb.adapters.web.auth.response.TeamSummaryHttpResponse;
import com.io.appioweb.adapters.web.auth.response.UserSummaryHttpResponse;
import com.io.appioweb.application.auth.dto.CreateCompanyCommand;
import com.io.appioweb.application.auth.dto.CreateUserCommand;
import com.io.appioweb.application.auth.dto.LoginCommand;
import com.io.appioweb.application.auth.port.in.AuthUseCase;
import com.io.appioweb.application.auth.port.in.CompanyAdminUseCase;
import com.io.appioweb.application.auth.port.in.RoleQueryUseCase;
import com.io.appioweb.application.auth.port.in.UserAdminUseCase;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.PasswordHasherPort;
import com.io.appioweb.application.auth.port.out.RoleRepositoryPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.Team;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class AuthController {

    private static final Pattern REFRESH_JSON = Pattern.compile("\"refreshToken\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern REFRESH_FORM = Pattern.compile("(?i)(?:^|&)refreshToken=([^&]+)");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final List<String> WEEK_DAYS = List.of("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday");

    private final AuthUseCase auth;
    private final RoleQueryUseCase roles;
    private final CompanyAdminUseCase companies;
    private final UserAdminUseCase meUseCase;
    private final UserAdminUseCase createUserUseCase;
    private final UserRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final CompanyRepositoryPort companyRepository;
    private final AtendimentoConversationRepositoryJpa conversations;
    private final RoleRepositoryPort roleRepository;
    private final CurrentUserPort currentUser;
    private final PasswordHasherPort hasher;

    public AuthController(AuthUseCase auth, RoleQueryUseCase roles, CompanyAdminUseCase companies,
                          UserAdminUseCase meUseCase,
                          @org.springframework.beans.factory.annotation.Qualifier("createUserUseCase") UserAdminUseCase createUserUseCase,
                          UserRepositoryPort users,
                          TeamRepositoryPort teams,
                          CompanyRepositoryPort companyRepository,
                          AtendimentoConversationRepositoryJpa conversations,
                          RoleRepositoryPort roleRepository,
                          CurrentUserPort currentUser,
                          PasswordHasherPort hasher) {
        this.auth = auth;
        this.roles = roles;
        this.companies = companies;
        this.meUseCase = meUseCase;
        this.createUserUseCase = createUserUseCase;
        this.users = users;
        this.teams = teams;
        this.companyRepository = companyRepository;
        this.conversations = conversations;
        this.roleRepository = roleRepository;
        this.currentUser = currentUser;
        this.hasher = hasher;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        var tokens = auth.login(new LoginCommand(req.email(), req.password()));
        return ResponseEntity.ok(new LoginResponse(tokens.accessToken(), tokens.refreshToken(), tokens.accessExpiresInSeconds()));
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshRequest req) {
        var tokens = auth.refresh(req.refreshToken());
        return ResponseEntity.ok(new LoginResponse(tokens.accessToken(), tokens.refreshToken(), tokens.accessExpiresInSeconds()));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestParam(name = "refreshToken", required = false) String refreshToken,
            @RequestBody(required = false) String body
    ) {
        String access = stripBearer(authorization);
        String refresh = refreshToken;
        if (refresh == null) refresh = extractRefreshToken(body);
        auth.logout(access, refresh);
        return ResponseEntity.noContent().build();
    }

    private String stripBearer(String token) {
        if (token == null) return null;
        return token.startsWith("Bearer ") ? token.substring(7) : token;
    }

    private String extractRefreshToken(String body) {
        if (body == null) return null;
        String trimmed = body.trim();
        if (trimmed.isEmpty()) return null;

        if (trimmed.startsWith("{")) {
            Matcher m = REFRESH_JSON.matcher(trimmed);
            if (m.find()) return m.group(1);
            throw new BusinessException("INVALID_JSON", "JSON inválido");
        }

        Matcher m = REFRESH_FORM.matcher(trimmed);
        if (m.find()) {
            return URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
        }

        if (trimmed.contains(".")) return trimmed; // aceita token cru
        throw new BusinessException("INVALID_JSON", "JSON inválido");
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        return ResponseEntity.ok(meUseCase.me());
    }

    @PutMapping("/users/me/profile-image")
    public ResponseEntity<UpdateMyProfileImageHttpResponse> updateMyProfileImage(@Valid @RequestBody UpdateMyProfileImageHttpRequest req) {
        UUID companyId = currentUser.companyId();
        UUID userId = currentUser.userId();

        User existingUser = users.findByIdAndCompanyId(userId, companyId)
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuário não encontrado"));

        String normalizedImageUrl = normalizeProfileImageUrl(req.profileImageUrl());

        User updatedUser = new User(
                existingUser.id(),
                existingUser.companyId(),
                existingUser.email(),
                existingUser.passwordHash(),
                existingUser.fullName(),
                normalizedImageUrl,
                existingUser.jobTitle(),
                existingUser.birthDate(),
                existingUser.permissionPreset(),
                existingUser.modulePermissions(),
                existingUser.teamId(),
                existingUser.isActive(),
                existingUser.createdAt(),
                existingUser.roles()
        );
        users.save(updatedUser);

        boolean companyLogoUpdated = Boolean.TRUE.equals(req.syncCompanyLogo());
        if (companyLogoUpdated) {
            var existingCompany = companyRepository.findById(companyId)
                    .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada"));

            companyRepository.save(new com.io.appioweb.domain.auth.entity.Company(
                    existingCompany.id(),
                    existingCompany.name(),
                    normalizedImageUrl,
                    existingCompany.email(),
                    existingCompany.contractEndDate(),
                    existingCompany.cnpj(),
                    existingCompany.openedAt(),
                    existingCompany.whatsappNumber(),
                    existingCompany.businessHoursStart(),
                    existingCompany.businessHoursEnd(),
                    existingCompany.businessHoursWeeklyJson(),
                    existingCompany.publicStockBannerMode(),
                    existingCompany.publicStockBannerImagesJson(),
                    existingCompany.createdAt()
            ));
        }

        return ResponseEntity.ok(new UpdateMyProfileImageHttpResponse(normalizedImageUrl, companyLogoUpdated));
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<?> listRoles() {
        return ResponseEntity.ok(roles.listRoles());
    }

    @PostMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> createUser(@Valid @RequestBody CreateUserHttpRequest req) {
        createUserUseCase.createUser(new CreateUserCommand(
                req.companyId(),
                req.email(),
                req.fullName(),
                req.profileImageUrl(),
                req.jobTitle(),
                req.birthDate(),
                req.password(),
                req.permissionPreset(),
                req.modulePermissions(),
                req.teamId(),
                req.roles()
        ));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<List<UserSummaryHttpResponse>> listUsers() {
        UUID companyId = currentUser.companyId();
        var teamsById = teams.findAllByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(Team::id, team -> team));
        var data = users.findAllByCompanyId(companyId).stream()
                .map(user -> new UserSummaryHttpResponse(
                        user.id(),
                        user.companyId(),
                        user.email(),
                        user.fullName(),
                        user.profileImageUrl(),
                        user.jobTitle(),
                        user.birthDate(),
                        user.permissionPreset(),
                        user.modulePermissions(),
                        user.teamId(),
                        teamsById.containsKey(user.teamId()) ? teamsById.get(user.teamId()).name() : null,
                        user.isActive(),
                        user.createdAt(),
                        user.roles()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PutMapping("/users/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> updateUser(@PathVariable UUID userId, @Valid @RequestBody UpdateUserHttpRequest req) {
        UUID companyId = currentUser.companyId();
        User existing = users.findByIdAndCompanyId(userId, companyId)
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuário não encontrado"));
        String normalizedEmail = req.email().trim().toLowerCase();
        users.findByEmailGlobal(normalizedEmail).ifPresent(found -> {
            if (!found.id().equals(existing.id())) {
                throw new BusinessException("USER_EMAIL_ALREADY_EXISTS", "Já existe usuário com este e-mail");
            }
        });

        validateRoleAssignment(req.roles());
        teams.findByIdAndCompanyId(req.teamId(), companyId)
                .orElseThrow(() -> new BusinessException("TEAM_NOT_FOUND", "Equipe não encontrada"));

        String passwordHash = (req.password() != null && !req.password().isBlank())
                ? hasher.hash(req.password())
                : existing.passwordHash();

        User updated = new User(
                existing.id(),
                existing.companyId(),
                normalizedEmail,
                passwordHash,
                req.fullName(),
                req.profileImageUrl() != null ? req.profileImageUrl() : existing.profileImageUrl(),
                req.jobTitle() != null ? req.jobTitle() : existing.jobTitle(),
                req.birthDate() != null ? req.birthDate() : existing.birthDate(),
                req.permissionPreset() != null ? req.permissionPreset() : existing.permissionPreset(),
                req.modulePermissions() != null ? Set.copyOf(req.modulePermissions()) : existing.modulePermissions(),
                req.teamId(),
                existing.isActive(),
                existing.createdAt(),
                Set.copyOf(req.roles())
        );

        users.save(updated);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teams")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<List<TeamSummaryHttpResponse>> listTeams() {
        UUID companyId = currentUser.companyId();
        var data = teams.findAllByCompanyId(companyId).stream()
                .map(team -> new TeamSummaryHttpResponse(
                        team.id(),
                        team.companyId(),
                        team.name(),
                        team.createdAt(),
                        team.updatedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PostMapping("/teams")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> createTeam(@Valid @RequestBody CreateTeamHttpRequest req) {
        UUID companyId = currentUser.companyId();
        String normalizedName = normalizeTeamName(req.name());
        validateTeamName(companyId, normalizedName, null);
        Instant now = java.time.Instant.now();
        teams.save(new Team(
                UUID.randomUUID(),
                companyId,
                normalizedName,
                now,
                now
        ));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/teams/{teamId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> updateTeam(@PathVariable UUID teamId, @Valid @RequestBody UpdateTeamHttpRequest req) {
        UUID companyId = currentUser.companyId();
        Team existing = teams.findByIdAndCompanyId(teamId, companyId)
                .orElseThrow(() -> new BusinessException("TEAM_NOT_FOUND", "Equipe não encontrada"));
        String normalizedName = normalizeTeamName(req.name());
        validateTeamName(companyId, normalizedName, existing.id());
        teams.save(new Team(
                existing.id(),
                existing.companyId(),
                normalizedName,
                existing.createdAt(),
                java.time.Instant.now()
        ));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/teams/{teamId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID teamId) {
        UUID companyId = currentUser.companyId();
        Team existing = teams.findByIdAndCompanyId(teamId, companyId)
                .orElseThrow(() -> new BusinessException("TEAM_NOT_FOUND", "Equipe não encontrada"));

        if (users.countByCompanyIdAndTeamId(companyId, existing.id()) > 0) {
            throw new BusinessException("TEAM_HAS_USERS", "Não é possível excluir uma equipe com usuários vinculados");
        }
        if (conversations.existsByCompanyIdAndAssignedTeamId(companyId, existing.id())) {
            throw new BusinessException("TEAM_HAS_CONVERSATIONS", "Não é possível excluir uma equipe com leads vinculados");
        }

        teams.deleteById(existing.id());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        UUID companyId = currentUser.companyId();
        User existing = users.findByIdAndCompanyId(userId, companyId)
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuário não encontrado"));

        if (existing.id().equals(currentUser.userId())) {
            throw new BusinessException("USER_DELETE_FORBIDDEN", "Você não pode excluir seu próprio usuário");
        }

        users.deleteById(existing.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/companies")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<CreateCompanyHttpResponse> createCompany(@Valid @RequestBody CreateCompanyHttpRequest req) {
        String businessHoursWeeklyJson = normalizeBusinessHoursWeekly(req.businessHoursWeekly(), req.businessHoursStart(), req.businessHoursEnd());
        var result = companies.createCompany(new CreateCompanyCommand(
                req.companyName(),
                req.profileImageUrl(),
                req.companyEmail(),
                req.contractEndDate(),
                req.cnpj(),
                req.openedAt(),
                req.whatsappNumber(),
                req.password(),
                req.businessHoursStart(),
                req.businessHoursEnd(),
                businessHoursWeeklyJson
        ));

        return ResponseEntity.ok(new CreateCompanyHttpResponse(
                result.companyId(),
                result.ownerUserId(),
                result.ownerEmail()
        ));
    }

    @GetMapping("/companies")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<CompanySummaryHttpResponse>> listCompanies() {
        var data = companyRepository.findAll().stream()
                .map(company -> new CompanySummaryHttpResponse(
                        company.id(),
                        company.name(),
                        company.profileImageUrl(),
                        company.email(),
                        company.contractEndDate(),
                        company.cnpj(),
                        company.openedAt(),
                        company.whatsappNumber(),
                        company.businessHoursStart(),
                        company.businessHoursEnd(),
                        parseJson(company.businessHoursWeeklyJson()),
                        company.createdAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PutMapping("/companies/{companyId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> updateCompany(@PathVariable UUID companyId, @Valid @RequestBody UpdateCompanyHttpRequest req) {
        var existing = companyRepository.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada"));
        String normalizedEmail = req.companyEmail().trim().toLowerCase();
        companyRepository.findByEmail(normalizedEmail).ifPresent(found -> {
            if (!found.id().equals(existing.id())) {
                throw new BusinessException("COMPANY_EMAIL_ALREADY_EXISTS", "Ja existe empresa com este e-mail");
            }
        });
        users.findByEmailGlobal(normalizedEmail).ifPresent(found -> {
            if (!found.companyId().equals(existing.id())) {
                throw new BusinessException("USER_EMAIL_ALREADY_EXISTS", "Já existe usuário com este e-mail");
            }
        });

        String cnpjDigits = req.cnpj().replaceAll("\\D", "");
        if (cnpjDigits.length() != 14) {
            throw new BusinessException("COMPANY_INVALID_CNPJ", "CNPJ invalido");
        }
        String whatsappDigits = req.whatsappNumber().replaceAll("\\D", "");
        if (whatsappDigits.length() < 10 || whatsappDigits.length() > 11) {
            throw new BusinessException("COMPANY_INVALID_WHATSAPP", "Telefone da empresa invalido");
        }
        String businessHoursWeeklyJson = normalizeBusinessHoursWeekly(req.businessHoursWeekly(), req.businessHoursStart(), req.businessHoursEnd());

        companyRepository.save(new com.io.appioweb.domain.auth.entity.Company(
                existing.id(),
                req.companyName().trim(),
                req.profileImageUrl(),
                normalizedEmail,
                req.contractEndDate(),
                cnpjDigits,
                req.openedAt(),
                whatsappDigits,
                req.businessHoursStart().trim(),
                req.businessHoursEnd().trim(),
                businessHoursWeeklyJson,
                existing.publicStockBannerMode(),
                existing.publicStockBannerImagesJson(),
                existing.createdAt()
        ));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/companies/{companyId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteCompany(@PathVariable UUID companyId) {
        if (companyId.equals(currentUser.companyId())) {
            throw new BusinessException("COMPANY_DELETE_FORBIDDEN", "Você não pode excluir sua própria empresa");
        }

        var existing = companyRepository.findById(companyId)
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_FOUND", "Empresa não encontrada"));

        users.deleteByCompanyId(existing.id());
        companyRepository.deleteById(existing.id());
        return ResponseEntity.noContent().build();
    }

    private void validateRoleAssignment(Set<String> requestRoles) {
        boolean currentIsSuperAdmin = currentUser.roles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role));
        boolean targetHasSuperAdmin = requestRoles.stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role));
        if (targetHasSuperAdmin && !currentIsSuperAdmin) {
            throw new BusinessException("ROLE_FORBIDDEN", "Apenas SUPERADMIN pode atribuir a role SUPERADMIN");
        }

        for (String role : requestRoles) {
            if (!roleRepository.existsByName(role)) {
                throw new BusinessException("ROLE_INVALID", "Role invalida: " + role);
            }
        }
    }

    private void validateTeamName(UUID companyId, String teamName, UUID currentTeamId) {
        boolean duplicated = teams.findAllByCompanyId(companyId).stream()
                .anyMatch(team -> !team.id().equals(currentTeamId) && team.name().trim().equalsIgnoreCase(teamName));
        if (duplicated) {
            throw new BusinessException("TEAM_NAME_ALREADY_EXISTS", "Ja existe uma equipe com este nome");
        }
    }

    private String normalizeTeamName(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            throw new BusinessException("TEAM_INVALID_NAME", "Nome da equipe obrigatorio");
        }
        return normalized;
    }

    private String normalizeProfileImageUrl(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            throw new BusinessException("PROFILE_IMAGE_REQUIRED", "Informe uma imagem de perfil valida.");
        }
        String lower = normalized.toLowerCase();
        if (!lower.startsWith("data:image/") && !lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new BusinessException("PROFILE_IMAGE_INVALID", "Informe uma URL ou imagem valida para o perfil.");
        }
        return normalized;
    }

    private String normalizeBusinessHoursWeekly(JsonNode rawWeekly, String fallbackStart, String fallbackEnd) {
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        JsonNode source = rawWeekly == null ? OBJECT_MAPPER.createObjectNode() : rawWeekly;
        for (String day : WEEK_DAYS) {
            JsonNode node = source.path(day);
            boolean active = node != null && node.path("active").asBoolean(false);
            String start = trimOr(node == null ? "" : node.path("start").asText(""), fallbackStart);
            String lunchStart = trimOr(node == null ? "" : node.path("lunchStart").asText(""), "12:00");
            String lunchEnd = trimOr(node == null ? "" : node.path("lunchEnd").asText(""), "13:00");
            String end = trimOr(node == null ? "" : node.path("end").asText(""), fallbackEnd);
            if (active) {
                validateBusinessHourValue(start, day + ".start");
                validateBusinessHourValue(lunchStart, day + ".lunchStart");
                validateBusinessHourValue(lunchEnd, day + ".lunchEnd");
                validateBusinessHourValue(end, day + ".end");
                if (!(start.compareTo(lunchStart) < 0 && lunchStart.compareTo(lunchEnd) < 0 && lunchEnd.compareTo(end) < 0)) {
                    throw new BusinessException("COMPANY_BUSINESS_HOURS_INVALID", "Horario invalido para " + day);
                }
            }
            ObjectNode normalized = OBJECT_MAPPER.createObjectNode();
            normalized.put("active", active);
            normalized.put("start", start);
            normalized.put("lunchStart", lunchStart);
            normalized.put("lunchEnd", lunchEnd);
            normalized.put("end", end);
            root.set(day, normalized);
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(root);
        } catch (Exception ex) {
            throw new BusinessException("COMPANY_BUSINESS_HOURS_INVALID", "Não foi possível processar horários de funcionamento");
        }
    }

    private JsonNode parseJson(String raw) {
        String value = trimOr(raw, "{}");
        try {
            return OBJECT_MAPPER.readTree(value);
        } catch (Exception ignored) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    private void validateBusinessHourValue(String value, String field) {
        if (!value.matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
            throw new BusinessException("COMPANY_BUSINESS_HOURS_INVALID", "Valor invalido para " + field);
        }
    }

    private String trimOr(String value, String fallback) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isBlank() ? fallback : normalized;
    }

    public record UpdateMyProfileImageHttpResponse(
            String profileImageUrl,
            boolean companyLogoUpdated
    ) {
    }
}
