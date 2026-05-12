package com.io.appioweb.adapters.web.relatorios;

import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.superadmin.FeatureUsageService;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
public class AtendimentoReportsController {

    private final CurrentUserPort currentUser;
    private final FeatureUsageService featureUsageService;
    private final AtendimentoReportsService reportsService;
    private final SuperAdminPlanManagementService planManagementService;

    public AtendimentoReportsController(
            CurrentUserPort currentUser,
            FeatureUsageService featureUsageService,
            AtendimentoReportsService reportsService,
            SuperAdminPlanManagementService planManagementService
    ) {
        this.currentUser = currentUser;
        this.featureUsageService = featureUsageService;
        this.reportsService = reportsService;
        this.planManagementService = planManagementService;
    }

    @GetMapping("/reports/atendimentos/overview")
    public AtendimentoOverviewHttpResponse overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String channelId,
            @RequestParam(required = false) String timeZone
    ) {
        planManagementService.assertFeatureEnabled(currentUser.companyId(), SuperAdminPlanManagementService.FEATURE_REPORTS);
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_REPORTS, java.util.Map.of("action", "OVERVIEW"));
        return reportsService.loadOverview(currentUser.companyId(), new AtendimentoReportsService.AtendimentoReportFilter(
                startDate,
                endDate,
                userId,
                teamId,
                channelId,
                timeZone
        ));
    }

    @GetMapping("/reports/atendimentos/users")
    public AtendimentoUserReportHttpResponse users(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String channelId,
            @RequestParam(required = false) String timeZone
    ) {
        planManagementService.assertFeatureEnabled(currentUser.companyId(), SuperAdminPlanManagementService.FEATURE_REPORTS);
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_REPORTS, java.util.Map.of("action", "USERS"));
        return reportsService.loadUserReport(currentUser.companyId(), new AtendimentoReportsService.AtendimentoReportFilter(
                startDate,
                endDate,
                userId,
                teamId,
                channelId,
                timeZone
        ));
    }

    @GetMapping("/reports/atendimentos/results")
    public AtendimentoResultsReportHttpResponse results(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String channelId,
            @RequestParam(required = false) String timeZone
    ) {
        planManagementService.assertFeatureEnabled(currentUser.companyId(), SuperAdminPlanManagementService.FEATURE_REPORTS);
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_REPORTS, java.util.Map.of("action", "RESULTS"));
        return reportsService.loadResults(currentUser.companyId(), new AtendimentoReportsService.AtendimentoReportFilter(
                startDate,
                endDate,
                userId,
                teamId,
                channelId,
                timeZone
        ));
    }
}
