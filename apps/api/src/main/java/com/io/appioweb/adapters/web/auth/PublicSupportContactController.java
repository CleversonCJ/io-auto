package com.io.appioweb.adapters.web.auth;

import com.io.appioweb.application.superadmin.SuperAdminSupportSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicSupportContactController {

    private final SuperAdminSupportSettingsService supportSettingsService;

    public PublicSupportContactController(SuperAdminSupportSettingsService supportSettingsService) {
        this.supportSettingsService = supportSettingsService;
    }

    @GetMapping("/auth/support-contact")
    public ResponseEntity<SuperAdminSupportSettingsService.SupportContactSettings> getSupportContact() {
        return ResponseEntity.ok(supportSettingsService.getSupportContactSettings());
    }
}
