package com.io.appioweb.application.auth.port.out;

import java.util.Set;
import java.util.UUID;

public interface CurrentUserPort {
    UUID userId();
    UUID companyId();
    String email();
    Set<String> roles();
}
