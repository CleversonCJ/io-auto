package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SuperAdminSupportSettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SuperAdminSupportSettingsController {

    private final SuperAdminSupportSettingsService supportSettingsService;

    public SuperAdminSupportSettingsController(SuperAdminSupportSettingsService supportSettingsService) {
        this.supportSettingsService = supportSettingsService;
    }

    @GetMapping("/api/superadmin/support-settings")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminSupportSettingsService.SupportContactSettings> getSupportSettings() {
        return ResponseEntity.ok(supportSettingsService.getSupportContactSettings());
    }

    @PutMapping("/api/superadmin/support-settings")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminSupportSettingsService.SupportContactSettings> updateSupportSettings(
            @Valid @RequestBody UpdateSupportSettingsHttpRequest request
    ) {
        return ResponseEntity.ok(
                supportSettingsService.updateSupportContactSettings(
                        new SuperAdminSupportSettingsService.UpdateSupportContactCommand(request.whatsappNumber())
                )
        );
    }

    public record UpdateSupportSettingsHttpRequest(@NotBlank String whatsappNumber) {
    }
}
