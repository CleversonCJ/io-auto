package com.io.appioweb.application.auth.usecase;

import com.io.appioweb.application.auth.dto.MeResponse;
import com.io.appioweb.application.auth.port.in.UserAdminUseCase;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;

public class MeUseCase implements UserAdminUseCase {
    private final CurrentUserPort current;
    private final UserRepositoryPort users;
    private final TeamRepositoryPort teams;
    private final CompanyRepositoryPort companies;

    public MeUseCase(CurrentUserPort current, UserRepositoryPort users, TeamRepositoryPort teams, CompanyRepositoryPort companies) {
        this.current = current;
        this.users = users;
        this.teams = teams;
        this.companies = companies;
    }

    @Override
    public void createUser(com.io.appioweb.application.auth.dto.CreateUserCommand command) {
        throw new UnsupportedOperationException();
    }

    @Override
    public MeResponse me() {
        User user = users.findById(current.userId())
                .orElseThrow(() -> new BusinessException("AUTH_NOT_FOUND", "Usuario nao encontrado"));
        var team = teams.findByIdAndCompanyId(user.teamId(), user.companyId()).orElse(null);
        String companyName = companies.findNameById(user.companyId()).orElse(null);

        return new MeResponse(
                user.id(),
                user.companyId(),
                companyName,
                user.email(),
                user.fullName(),
                user.profileImageUrl(),
                user.permissionPreset(),
                user.modulePermissions(),
                user.teamId(),
                team == null ? null : team.name(),
                user.createdAt(),
                user.roles(),
                current.impersonation(),
                current.actorSuperAdminId(),
                current.impersonatedTenantId()
        );
    }
}
