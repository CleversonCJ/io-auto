package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class SuperAdminPlanController {

    private final SuperAdminPlanManagementService planManagementService;

    public SuperAdminPlanController(SuperAdminPlanManagementService planManagementService) {
        this.planManagementService = planManagementService;
    }

    @GetMapping("/api/superadmin/plans")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<SuperAdminPlanManagementService.PlanRow>> listPlans() {
        return ResponseEntity.ok(planManagementService.listPlans());
    }

    @GetMapping("/api/superadmin/plans/options")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<SuperAdminPlanManagementService.PlanOptionRow>> listPlanOptions() {
        return ResponseEntity.ok(planManagementService.listActivePlanOptions());
    }

    @PostMapping("/api/superadmin/plans")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminPlanManagementService.PlanRow> createPlan(
            @Valid @RequestBody SavePlanHttpRequest request
    ) {
        return ResponseEntity.ok(planManagementService.createPlan(toCommand(request)));
    }

    @PutMapping("/api/superadmin/plans/{planId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<SuperAdminPlanManagementService.PlanRow> updatePlan(
            @PathVariable UUID planId,
            @Valid @RequestBody SavePlanHttpRequest request
    ) {
        return ResponseEntity.ok(planManagementService.updatePlan(planId, toCommand(request)));
    }

    @DeleteMapping("/api/superadmin/plans/{planId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> deletePlan(@PathVariable UUID planId) {
        planManagementService.deletePlan(planId);
        return ResponseEntity.noContent().build();
    }

    private SuperAdminPlanManagementService.SavePlanCommand toCommand(SavePlanHttpRequest request) {
        return new SuperAdminPlanManagementService.SavePlanCommand(
                request.planName(),
                request.planKey(),
                request.description(),
                request.billingRecurrence(),
                request.priceCents(),
                request.monthlyPriceCents(),
                request.annualPriceCents(),
                request.customPlan(),
                request.systemPlan(),
                request.active(),
                request.sortOrder(),
                request.usersLimit(),
                request.vehiclesLimit(),
                request.activeAdsLimit(),
                request.featureCatalogBioLink(),
                request.featureWhatsappSharing(),
                request.featureStorefrontPage(),
                request.featureWebmotors(),
                request.featureOlx(),
                request.featureIcarros(),
                request.featureCrmKanban(),
                request.featureLeadManagement(),
                request.featureFinance(),
                request.featureReports(),
                request.featureTrackableLinks(),
                request.featureMultiunits(),
                request.featureAdvancedMultiuser(),
                request.featureExecutiveDashboard(),
                request.featureIntegrationsApi(),
                request.featureAssistedOnboarding(),
                request.featurePrioritySupport(),
                request.featureCustomizations()
        );
    }

    public record SavePlanHttpRequest(
            String planName,
            String planKey,
            String description,
            String billingRecurrence,
            Long priceCents,
            Long monthlyPriceCents,
            Long annualPriceCents,
            Boolean customPlan,
            Boolean systemPlan,
            Boolean active,
            Integer sortOrder,
            Integer usersLimit,
            Integer vehiclesLimit,
            Integer activeAdsLimit,
            Boolean featureCatalogBioLink,
            Boolean featureWhatsappSharing,
            Boolean featureStorefrontPage,
            Boolean featureWebmotors,
            Boolean featureOlx,
            Boolean featureIcarros,
            Boolean featureCrmKanban,
            Boolean featureLeadManagement,
            Boolean featureFinance,
            Boolean featureReports,
            Boolean featureTrackableLinks,
            Boolean featureMultiunits,
            Boolean featureAdvancedMultiuser,
            Boolean featureExecutiveDashboard,
            Boolean featureIntegrationsApi,
            Boolean featureAssistedOnboarding,
            Boolean featurePrioritySupport,
            Boolean featureCustomizations
    ) {
    }
}
