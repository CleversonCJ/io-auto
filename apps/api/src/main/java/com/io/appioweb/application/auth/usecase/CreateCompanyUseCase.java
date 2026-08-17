package com.io.appioweb.application.auth.usecase;

import com.io.appioweb.application.auth.dto.CreateCompanyCommand;
import com.io.appioweb.application.auth.dto.CreateCompanyResult;
import com.io.appioweb.application.auth.port.in.CompanyAdminUseCase;
import com.io.appioweb.application.auth.port.out.CompanyRepositoryPort;
import com.io.appioweb.application.auth.port.out.PasswordHasherPort;
import com.io.appioweb.application.auth.port.out.RoleRepositoryPort;
import com.io.appioweb.application.auth.port.out.TeamRepositoryPort;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.Company;
import com.io.appioweb.domain.auth.entity.Team;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;

public class CreateCompanyUseCase implements CompanyAdminUseCase {
    private final CompanyRepositoryPort companies;
    private final UserRepositoryPort users;
    private final RoleRepositoryPort roles;
    private final PasswordHasherPort hasher;
    private final TeamRepositoryPort teams;

    public CreateCompanyUseCase(
            CompanyRepositoryPort companies,
            UserRepositoryPort users,
            RoleRepositoryPort roles,
            PasswordHasherPort hasher,
            TeamRepositoryPort teams
    ) {
        this.companies = companies;
        this.users = users;
        this.roles = roles;
        this.hasher = hasher;
        this.teams = teams;
    }

    @Override
    @Transactional
    public CreateCompanyResult createCompany(CreateCompanyCommand command) {
        if (!roles.existsByName("ADMIN")) {
            throw new BusinessException("ROLE_INVALID", "Role ADMIN nao cadastrada");
        }
        String normalizedEmail = command.companyEmail().trim().toLowerCase();
        if (companies.findByEmail(normalizedEmail).isPresent()) {
            throw new BusinessException("COMPANY_EMAIL_ALREADY_EXISTS", "Ja existe uma empresa criada com este e-mail");
        }
        if (users.findByEmailGlobal(normalizedEmail).isPresent()) {
            throw new BusinessException("USER_EMAIL_ALREADY_EXISTS", "Ja existe um usuario criado com este e-mail");
        }

        String cnpjDigits = onlyDigits(command.cnpj());
        if (cnpjDigits.length() != 14) {
            throw new BusinessException("COMPANY_INVALID_CNPJ", "CNPJ invalido");
        }
        String whatsappDigits = onlyDigits(command.whatsappNumber());
        if (whatsappDigits.length() < 10 || whatsappDigits.length() > 11) {
            throw new BusinessException("COMPANY_INVALID_WHATSAPP", "Telefone da empresa invalido");
        }

        UUID companyId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Instant now = Instant.now();

        Company company = new Company(
                companyId,
                command.companyName().trim(),
                command.profileImageUrl(),
                command.companyEmail().toLowerCase(),
                command.contractEndDate(),
                cnpjDigits,
                command.openedAt(),
                whatsappDigits,
                command.businessHoursStart().trim(),
                command.businessHoursEnd().trim(),
                command.businessHoursWeeklyJson().trim(),
                "VEHICLES",
                "[]",
                now
        );
        companies.save(company);

        teams.save(new Team(
                teamId,
                companyId,
                "Equipe Geral",
                now,
                now
        ));

        User owner = new User(
                ownerId,
                companyId,
                normalizedEmail,
                hasher.hash(command.password()),
                command.companyName().trim(),
                command.profileImageUrl(),
                "Administrador",
                null,
                "admin",
                Collections.emptySet(),
                teamId,
                true,
                now,
                Set.of("ADMIN")
        );
        users.save(owner);

        return new CreateCompanyResult(companyId, ownerId, owner.email());
    }

    private String onlyDigits(String value) {
        if (value == null) return "";
        return value.replaceAll("\\D", "");
    }
}
