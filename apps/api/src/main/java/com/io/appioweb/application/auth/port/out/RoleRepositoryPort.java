package com.io.appioweb.application.auth.port.out;

import java.util.List;

public interface RoleRepositoryPort {
    List<String> findAllRoleNames();
    boolean existsByName(String roleName);
}
