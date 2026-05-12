package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.CustomerHealthScoreService;
import com.io.appioweb.application.superadmin.SuperAdminBillingDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminCustomerDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminFilter;
import com.io.appioweb.application.superadmin.SuperAdminFinancialDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminGrowthDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminInsightsService;
import com.io.appioweb.application.superadmin.SuperAdminMarketplaceDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminOperationsDashboardService;
import com.io.appioweb.application.superadmin.SuperAdminProductUsageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@PreAuthorize("hasRole('SUPERADMIN')")
public class SuperAdminDashboardController {

    private final SuperAdminFinancialDashboardService financialDashboardService;
    private final SuperAdminCustomerDashboardService customerDashboardService;
    private final CustomerHealthScoreService customerHealthScoreService;
    private final SuperAdminProductUsageService productUsageService;
    private final SuperAdminMarketplaceDashboardService marketplaceDashboardService;
    private final SuperAdminGrowthDashboardService growthDashboardService;
    private final SuperAdminBillingDashboardService billingDashboardService;
    private final SuperAdminOperationsDashboardService operationsDashboardService;
    private final SuperAdminInsightsService insightsService;

    public SuperAdminDashboardController(
            SuperAdminFinancialDashboardService financialDashboardService,
            SuperAdminCustomerDashboardService customerDashboardService,
            CustomerHealthScoreService customerHealthScoreService,
            SuperAdminProductUsageService productUsageService,
            SuperAdminMarketplaceDashboardService marketplaceDashboardService,
            SuperAdminGrowthDashboardService growthDashboardService,
            SuperAdminBillingDashboardService billingDashboardService,
            SuperAdminOperationsDashboardService operationsDashboardService,
            SuperAdminInsightsService insightsService
    ) {
        this.financialDashboardService = financialDashboardService;
        this.customerDashboardService = customerDashboardService;
        this.customerHealthScoreService = customerHealthScoreService;
        this.productUsageService = productUsageService;
        this.marketplaceDashboardService = marketplaceDashboardService;
        this.growthDashboardService = growthDashboardService;
        this.billingDashboardService = billingDashboardService;
        this.operationsDashboardService = operationsDashboardService;
        this.insightsService = insightsService;
    }

    @GetMapping("/api/superadmin/dashboard/financial")
    public ResponseEntity<SuperAdminFinancialDashboardService.FinancialDashboardResponse> getFinancialDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(financialDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/dashboard/customers")
    public ResponseEntity<SuperAdminCustomerDashboardService.CustomerDashboardResponse> getCustomerDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(customerDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/customers/health-score")
    public ResponseEntity<List<CustomerHealthScoreService.CustomerHealthScoreRow>> listCustomerHealthScore(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(customerHealthScoreService.listHealthScores(filter));
    }

    @GetMapping("/api/superadmin/dashboard/product-usage")
    public ResponseEntity<SuperAdminProductUsageService.ProductUsageDashboardResponse> getProductUsageDashboard(
            @RequestParam(name = "periodPreset", required = false) String periodPreset,
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(productUsageService.getDashboard(filter, periodPreset));
    }

    @GetMapping("/api/superadmin/dashboard/marketplaces")
    public ResponseEntity<SuperAdminMarketplaceDashboardService.MarketplaceDashboardResponse> getMarketplaceDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(marketplaceDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/dashboard/growth")
    public ResponseEntity<SuperAdminGrowthDashboardService.GrowthDashboardResponse> getGrowthDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(growthDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/catalog-leads")
    public ResponseEntity<SuperAdminGrowthDashboardService.CatalogLeadsPage> listCatalogLeads(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(growthDashboardService.listCatalogLeads(filter));
    }

    @GetMapping("/api/superadmin/dashboard/billing")
    public ResponseEntity<SuperAdminBillingDashboardService.BillingDashboardResponse> getBillingDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(billingDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/dashboard/operations")
    public ResponseEntity<SuperAdminOperationsDashboardService.OperationsDashboardResponse> getOperationsDashboard(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(operationsDashboardService.getDashboard(filter));
    }

    @GetMapping("/api/superadmin/dashboard/insights")
    public ResponseEntity<SuperAdminInsightsService.InsightsDashboardResponse> getInsights(
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
        SuperAdminFilter filter = buildFilter(startDate, endDate, year, month, planId, plan, city, region, recurrence, status, origin, stockSize, search);
        return ResponseEntity.ok(insightsService.getInsights(filter));
    }

    private SuperAdminFilter buildFilter(
            String startDate,
            String endDate,
            Integer year,
            Integer month,
            UUID planId,
            String plan,
            String city,
            String region,
            String recurrence,
            String status,
            String origin,
            String stockSize,
            String search
    ) {
        return new SuperAdminFilter(
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
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return LocalDate.parse(raw.trim());
    }
}
