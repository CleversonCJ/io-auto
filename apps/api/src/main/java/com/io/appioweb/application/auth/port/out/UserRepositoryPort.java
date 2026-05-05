package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.domain.auth.entity.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepositoryPort {
    Optional<User> findByCompanyIdAndEmail(UUID companyId, String email);
    Optional<User> findByEmailGlobal(String email);
    Optional<User> findById(UUID userId);
    Optional<User> findByIdAndCompanyId(UUID userId, UUID companyId);
    List<User> findAllByCompanyId(UUID companyId);
    long countByCompanyIdAndTeamId(UUID companyId, UUID teamId);
    void deleteById(UUID userId);
    void deleteByCompanyId(UUID companyId);
    void save(User user);
}
