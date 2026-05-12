package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SuperAdminFilter;
import com.io.appioweb.application.superadmin.SuperAdminTenantManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class SuperAdminTenantController {

    private final SuperAdminTenantManagementService tenantManagementService;

    public SuperAdminTenantController(SuperAdminTenantManagementService tenantManagementService) {
        this.tenantManagementService = tenantManagementService;
    }

    @GetMapping("/api/superadmin/tenants")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<SuperAdminTenantManagementService.TenantRow>> listTenants(
            @RequestParam(name = "startDate", required = false) String startDate,
            @RequestParam(name = "endDate", required = false) String endDate,
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "month", required = false) Integer month,
            @RequestParam(name = "planId", required = false) UUID planId,
            @RequestParam(name = "plan", required = false) String plan,
            @RequestParam(name = "city", required = false) String city,
            @RequestParam(name = "region", required = false) String region,
            @RequestParam(name = "recurrence", required = false) String recurrence,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "origin", required = false) String origin,
            @RequestParam(name = "stockSize", required = false) String stockSize,
            @RequestParam(name = "search", required = false) String search
    ) {
        SuperAdminFilter filter = new SuperAdminFilter(
                parseDate(startDate),
                parseDate(endDate),
                year,
                month,
                planId,
                plan,
                city,
                region,
                recurrence,
                status,
                origin,
                stockSize,
                search
        );
        return ResponseEntity.ok(tenantManagementService.listTenants(filter));
    }

    @PostMapping("/api/superadmin/tenants/{tenantId}/impersonate")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminTenantManagementService.ImpersonationResult> impersonateTenant(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(tenantManagementService.impersonateTenant(tenantId));
    }

    @PostMapping("/api/impersonation/exit")
    public ResponseEntity<SuperAdminTenantManagementService.ImpersonationExitResult> exitImpersonation() {
        return ResponseEntity.ok(tenantManagementService.exitImpersonation());
    }

    @PatchMapping("/api/superadmin/tenants/{tenantId}/plan")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminTenantManagementService.TenantRow> updateTenantPlan(
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpdatePlanHttpRequest request
    ) {
        SuperAdminTenantManagementService.UpdateTenantPlanCommand command = new SuperAdminTenantManagementService.UpdateTenantPlanCommand(
                request.planId(),
                request.planName(),
                request.planKey(),
                request.subscriptionAmountCents(),
                request.billingRecurrence(),
                request.subscriptionStatus()
        );
        return ResponseEntity.ok(tenantManagementService.updatePlan(tenantId, command));
    }

    @PatchMapping("/api/superadmin/tenants/{tenantId}/block")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> blockTenant(
            @PathVariable UUID tenantId,
            @RequestBody(required = false) BlockHttpRequest request
    ) {
        tenantManagementService.blockTenant(tenantId, request == null ? null : request.reason());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/api/superadmin/tenants/{tenantId}/unblock")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> unblockTenant(
            @PathVariable UUID tenantId,
            @RequestBody(required = false) BlockHttpRequest request
    ) {
        tenantManagementService.unblockTenant(tenantId, request == null ? null : request.reason());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/superadmin/tenants/{tenantId}/users/{userId}/reset-password")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminTenantManagementService.ResetPasswordResult> resetPassword(
            @PathVariable UUID tenantId,
            @PathVariable UUID userId
    ) {
        return ResponseEntity.ok(tenantManagementService.resetUserPassword(tenantId, userId));
    }

    @PostMapping("/api/superadmin/tenants/{tenantId}/reset-password")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminTenantManagementService.ResetPasswordResult> resetPrimaryPassword(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(tenantManagementService.resetPreferredUserPassword(tenantId));
    }

    @GetMapping("/api/superadmin/tenants/{tenantId}/logs")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<SuperAdminTenantManagementService.TenantAdminLogRow>> listTenantLogs(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(tenantManagementService.listLogs(tenantId));
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return LocalDate.parse(raw.trim());
    }

    public record UpdatePlanHttpRequest(
            UUID planId,
            String planName,
            String planKey,
            Long subscriptionAmountCents,
            String billingRecurrence,
            String subscriptionStatus
    ) {
    }

    public record BlockHttpRequest(String reason) {
    }
}
