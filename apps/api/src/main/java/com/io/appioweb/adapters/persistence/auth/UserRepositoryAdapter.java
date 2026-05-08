package com.io.appioweb.adapters.persistence.auth;

import com.io.appioweb.adapters.persistence.auth.mapper.UserMapper;
import com.io.appioweb.application.auth.port.out.UserRepositoryPort;
import com.io.appioweb.domain.auth.entity.User;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

public class UserRepositoryAdapter implements UserRepositoryPort {
    private final UserRepositoryJpa jpa;
    private final RoleRepositoryJpa roleJpa;

    public UserRepositoryAdapter(UserRepositoryJpa jpa, RoleRepositoryJpa roleJpa) {
        this.jpa = jpa;
        this.roleJpa = roleJpa;
    }

    @Override
    public Optional<User> findByCompanyIdAndEmail(UUID companyId, String email) {
        return jpa.findByCompanyIdAndEmail(companyId, email.toLowerCase()).map(UserMapper::toDomain);
    }

    @Override
    public Optional<User> findByEmailGlobal(String email) {
        List<JpaUserEntity> list = jpa.findAllByEmail(email.toLowerCase());
        if (list.isEmpty()) {
            return Optional.empty();
        }

        list.sort(Comparator.comparing(JpaUserEntity::getCreatedAt));
        return Optional.of(UserMapper.toDomain(list.get(0)));
    }

    @Override
    public Optional<User> findById(UUID userId) {
        return jpa.findById(userId).map(UserMapper::toDomain);
    }

    @Override
    public Optional<User> findByIdAndCompanyId(UUID userId, UUID companyId) {
        return jpa.findByIdAndCompanyId(userId, companyId).map(UserMapper::toDomain);
    }

    @Override
    public List<User> findAllByCompanyId(UUID companyId) {
        return jpa.findAllByCompanyId(companyId).stream().map(UserMapper::toDomain).toList();
    }

    @Override
    public long countByCompanyIdAndTeamId(UUID companyId, UUID teamId) {
        return jpa.countByCompanyIdAndTeamId(companyId, teamId);
    }

    @Override
    public void deleteById(UUID userId) {
        jpa.deleteById(userId);
    }

    @Override
    public void deleteByCompanyId(UUID companyId) {
        jpa.deleteByCompanyId(companyId);
    }

    @Override
    @Transactional
    public void save(User user) {
        JpaUserEntity entity = jpa.findById(user.id()).orElseGet(JpaUserEntity::new);
        boolean isNew = entity.getId() == null;

        entity.setId(user.id());
        entity.setCompanyId(user.companyId());
        entity.setEmail(user.email().toLowerCase());
        entity.setPasswordHash(user.passwordHash());
        entity.setFullName(user.fullName());
        entity.setProfileImageUrl(user.profileImageUrl());
        entity.setJobTitle(user.jobTitle());
        entity.setBirthDate(user.birthDate());
        entity.setPermissionPreset(user.permissionPreset());
        entity.setModulePermissions(user.modulePermissions() == null
                ? null
                : user.modulePermissions().stream().sorted().collect(Collectors.joining(",")));
        entity.setTeamId(user.teamId());
        entity.setActive(user.isActive());
        entity.setCreatedAt(isNew ? user.createdAt() : entity.getCreatedAt());
        entity.setUpdatedAt(Instant.now());
        entity.setNome((entity.getNome() == null || entity.getNome().isBlank()) ? user.fullName() : entity.getNome());
        if (isNew) {
            entity.setPrimary(jpa.findAllByCompanyId(user.companyId()).isEmpty());
        }

        entity.getRoles().clear();
        for (String roleName : user.roles()) {
            JpaRoleEntity role = roleJpa.findByName(roleName)
                    .orElseThrow(() -> new BusinessException("ROLE_INVALID", "Role invalida: " + roleName));
            entity.getRoles().add(role);
        }

        jpa.save(entity);
    }
}
