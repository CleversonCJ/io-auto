package com.io.appioweb.application.auth.port.out;

import com.io.appioweb.domain.auth.entity.Team;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamRepositoryPort {
    Optional<Team> findByIdAndCompanyId(UUID teamId, UUID companyId);
    List<Team> findAllByCompanyId(UUID companyId);
    boolean existsByCompanyIdAndNameIgnoreCase(UUID companyId, String name);
    void save(Team team);
    void deleteById(UUID teamId);
}
