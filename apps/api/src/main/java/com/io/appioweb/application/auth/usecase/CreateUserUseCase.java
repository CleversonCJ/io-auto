package com.io.appioweb.application.auth.usecase;

import com.io.appioweb.application.auth.dto.CreateUserCommand;
import com.io.appioweb.application.auth.port.in.UserAdminUseCase;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.PasswordHasherPort;
import com.io.appioweb.application.auth.port.out.RoleRepositoryPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;

import java.time.Instant;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;

public class CreateUserUseCase implements UserAdminUseCase {
    private final UserRepositoryPort users;
    private final RoleRepositoryPort roles;
    private final PasswordHasherPort hasher;
    private final CurrentUserPort current;
    private final TeamRepositoryPort teams;

    public CreateUserUseCase(
            UserRepositoryPort users,
            RoleRepositoryPort roles,
            PasswordHasherPort hasher,
            CurrentUserPort current,
            TeamRepositoryPort teams
    ) {
        this.users = users;
        this.roles = roles;
        this.hasher = hasher;
        this.current = current;
        this.teams = teams;
    }

    @Override
    public void createUser(CreateUserCommand command) {
        if (!current.companyId().equals(command.companyId())) {
            throw new BusinessException("TENANT_FORBIDDEN", "Voce nao pode criar usuario em outra empresa");
        }

        boolean currentIsSuperAdmin = current.roles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role));
        boolean targetHasSuperAdmin = command.roles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role));
        if (targetHasSuperAdmin && !currentIsSuperAdmin) {
            throw new BusinessException("ROLE_FORBIDDEN", "Apenas SUPERADMIN pode atribuir a role SUPERADMIN");
        }

        for (String role : command.roles()) {
            if (!roles.existsByName(role)) {
                throw new BusinessException("ROLE_INVALID", "Role invalida: " + role);
            }
        }

        teams.findByIdAndCompanyId(command.teamId(), command.companyId())
                .orElseThrow(() -> new BusinessException("TEAM_NOT_FOUND", "Equipe nao encontrada"));

        String normalizedEmail = command.email().trim().toLowerCase();
        if (users.findByEmailGlobal(normalizedEmail).isPresent()) {
            throw new BusinessException("USER_EMAIL_ALREADY_EXISTS", "Ja existe usuario com este e-mail");
        }

        String hash = hasher.hash(command.password());

        User user = new User(
                UUID.randomUUID(),
                command.companyId(),
                normalizedEmail,
                hash,
                command.fullName(),
                command.profileImageUrl(),
                command.jobTitle(),
                command.birthDate(),
                command.permissionPreset(),
                command.modulePermissions() == null ? Collections.emptySet() : Set.copyOf(command.modulePermissions()),
                command.teamId(),
                true,
                Instant.now(),
                Set.copyOf(command.roles())
        );

        users.save(user);
    }

    @Override
    public com.io.appioweb.application.auth.dto.MeResponse me() {
        return new com.io.appioweb.application.auth.dto.MeResponse(
                current.userId(),
                current.companyId(),
                null,
                current.email(),
                "N/A",
                null,
                null,
                Collections.emptySet(),
                null,
                null,
                null,
                current.roles(),
                current.impersonation(),
                current.actorSuperAdminId(),
                current.impersonatedTenantId()
        );
    }
}
