package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.atendimentos.AtendimentoSessionRepositoryJpa;
import com.io.appioweb.adapters.persistence.atendimentos.JpaAtendimentoSessionEntity;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoDreSubcategoryRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoFinancialEntryRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoDreSubcategoryEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoFinancialEntryEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
import com.io.appioweb.application.superadmin.FeatureUsageService;
import com.io.appioweb.application.superadmin.SuperAdminPlanManagementService;
import com.io.appioweb.shared.errors.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
public class IoAutoFinancialController {

    private static final ZoneId FINANCIAL_ZONE = ZoneId.of("America/Sao_Paulo");

    private static final String ENTRY_TYPE_RECEIVABLE = "RECEIVABLE";
    private static final String ENTRY_TYPE_PAYABLE = "PAYABLE";
    private static final String ENTRY_TYPE_BOTH = "BOTH";

    private static final String SOURCE_MANUAL = "MANUAL";
    private static final String SOURCE_VEHICLE_SALE = "VEHICLE_SALE";

    private static final String SECTION_GROSS_REVENUE = "GROSS_REVENUE";
    private static final String SECTION_GROSS_REVENUE_DEDUCTIONS = "GROSS_REVENUE_DEDUCTIONS";
    private static final String SECTION_COST_OF_SALES = "COST_OF_SALES";
    private static final String SECTION_SALES_EXPENSES = "SALES_EXPENSES";
    private static final String SECTION_ADMINISTRATIVE_EXPENSES = "ADMINISTRATIVE_EXPENSES";
    private static final String SECTION_FINANCIAL_REVENUES = "FINANCIAL_REVENUES";
    private static final String SECTION_FINANCIAL_EXPENSES = "FINANCIAL_EXPENSES";
    private static final String SECTION_OTHER_OPERATING_RESULTS = "OTHER_OPERATING_RESULTS";

    private static final String SUBCATEGORY_VEHICLE_SALES = "vehicle-sales";
    private static final String SUBCATEGORY_SERVICE_COMMISSIONS = "service-commissions";
    private static final String SUBCATEGORY_SALES_TAXES = "sales-taxes";
    private static final String SUBCATEGORY_VEHICLE_ACQUISITION = "vehicle-acquisition";
    private static final String SUBCATEGORY_RECONDITIONING = "vehicle-reconditioning";
    private static final String SUBCATEGORY_SALES_EXPENSES = "sales-expenses-general";
    private static final String SUBCATEGORY_ADMIN_EXPENSES = "administrative-expenses-general";
    private static final String SUBCATEGORY_FINANCIAL_REVENUE = "financial-income";
    private static final String SUBCATEGORY_FINANCIAL_EXPENSE = "financial-expense";
    private static final String SUBCATEGORY_OTHER_OPERATING_REVENUE = "other-operating-revenue";
    private static final String SUBCATEGORY_OTHER_OPERATING_EXPENSE = "other-operating-expense";

    private static final List<DreSectionDefinition> DRE_SECTIONS = List.of(
            new DreSectionDefinition(SECTION_GROSS_REVENUE, "Receita Bruta", "Entradas que compoem o faturamento bruto da operacao.", ENTRY_TYPE_RECEIVABLE, true, 10),
            new DreSectionDefinition(SECTION_GROSS_REVENUE_DEDUCTIONS, "Deducoes da Receita Bruta", "Impostos, taxas e abatimentos incidentes sobre a receita.", ENTRY_TYPE_PAYABLE, true, 20),
            new DreSectionDefinition(SECTION_COST_OF_SALES, "Custos das Vendas (CMV)", "Custos diretamente ligados a aquisicao e preparacao dos veiculos.", ENTRY_TYPE_PAYABLE, true, 30),
            new DreSectionDefinition(SECTION_SALES_EXPENSES, "Despesas com Vendas", "Despesas comerciais para originacao e fechamento das vendas.", ENTRY_TYPE_PAYABLE, true, 40),
            new DreSectionDefinition(SECTION_ADMINISTRATIVE_EXPENSES, "Despesas Administrativas", "Despesas de estrutura, equipe e operacao administrativa.", ENTRY_TYPE_PAYABLE, true, 50),
            new DreSectionDefinition(SECTION_FINANCIAL_REVENUES, "Receitas Financeiras", "Rendimentos e ganhos financeiros da operacao.", ENTRY_TYPE_RECEIVABLE, true, 60),
            new DreSectionDefinition(SECTION_FINANCIAL_EXPENSES, "Despesas Financeiras", "Juros, tarifas e demais gastos financeiros.", ENTRY_TYPE_PAYABLE, true, 70),
            new DreSectionDefinition(SECTION_OTHER_OPERATING_RESULTS, "Outras Receitas/Despesas Operacionais", "Ajustes operacionais diversos que impactam o resultado.", ENTRY_TYPE_BOTH, true, 80)
    );

    private static final Map<String, DreSectionDefinition> DRE_SECTION_BY_CODE = DRE_SECTIONS.stream()
            .collect(LinkedHashMap::new, (map, section) -> map.put(section.code(), section), LinkedHashMap::putAll);

    private static final List<DreSubcategorySeed> DEFAULT_DRE_SUBCATEGORIES = List.of(
            new DreSubcategorySeed(SUBCATEGORY_VEHICLE_SALES, SECTION_GROSS_REVENUE, "Venda de Veiculos", ENTRY_TYPE_RECEIVABLE, true, true, 10),
            new DreSubcategorySeed(SUBCATEGORY_SERVICE_COMMISSIONS, SECTION_GROSS_REVENUE, "Servicos/Comissoes", ENTRY_TYPE_RECEIVABLE, true, false, 20),
            new DreSubcategorySeed(SUBCATEGORY_SALES_TAXES, SECTION_GROSS_REVENUE_DEDUCTIONS, "Impostos e Taxas sobre Vendas", ENTRY_TYPE_PAYABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_VEHICLE_ACQUISITION, SECTION_COST_OF_SALES, "Custo de Aquisicao (Veiculos)", ENTRY_TYPE_PAYABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_RECONDITIONING, SECTION_COST_OF_SALES, "Reformas/Preparacao", ENTRY_TYPE_PAYABLE, true, false, 20),
            new DreSubcategorySeed(SUBCATEGORY_SALES_EXPENSES, SECTION_SALES_EXPENSES, "Despesas Comerciais Gerais", ENTRY_TYPE_PAYABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_ADMIN_EXPENSES, SECTION_ADMINISTRATIVE_EXPENSES, "Despesas Administrativas Gerais", ENTRY_TYPE_PAYABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_FINANCIAL_REVENUE, SECTION_FINANCIAL_REVENUES, "Rendimentos Financeiros", ENTRY_TYPE_RECEIVABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_FINANCIAL_EXPENSE, SECTION_FINANCIAL_EXPENSES, "Juros e Tarifas", ENTRY_TYPE_PAYABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_OTHER_OPERATING_REVENUE, SECTION_OTHER_OPERATING_RESULTS, "Outras Receitas Operacionais", ENTRY_TYPE_RECEIVABLE, true, false, 10),
            new DreSubcategorySeed(SUBCATEGORY_OTHER_OPERATING_EXPENSE, SECTION_OTHER_OPERATING_RESULTS, "Outras Despesas Operacionais", ENTRY_TYPE_PAYABLE, true, false, 20)
    );

    private final CurrentUserPort currentUser;
    private final FeatureUsageService featureUsageService;
    private final IoAutoFinancialEntryRepositoryJpa financialEntries;
    private final IoAutoVehicleRepositoryJpa vehicles;
    private final AtendimentoSessionRepositoryJpa sessions;
    private final IoAutoDreSubcategoryRepositoryJpa dreSubcategories;
    private final SuperAdminPlanManagementService planManagementService;

    public IoAutoFinancialController(
            CurrentUserPort currentUser,
            FeatureUsageService featureUsageService,
            IoAutoFinancialEntryRepositoryJpa financialEntries,
            IoAutoVehicleRepositoryJpa vehicles,
            AtendimentoSessionRepositoryJpa sessions,
            IoAutoDreSubcategoryRepositoryJpa dreSubcategories,
            SuperAdminPlanManagementService planManagementService
    ) {
        this.currentUser = currentUser;
        this.featureUsageService = featureUsageService;
        this.financialEntries = financialEntries;
        this.vehicles = vehicles;
        this.sessions = sessions;
        this.dreSubcategories = dreSubcategories;
        this.planManagementService = planManagementService;
    }

    @GetMapping("/ioauto/financial/overview")
    @Transactional
    public ResponseEntity<FinancialOverviewHttpResponse> getOverview() {
        UUID companyId = currentUser.companyId();
        enforceFinancePlan(companyId);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_FINANCE, Map.of("action", "GET_OVERVIEW"));
        List<JpaIoAutoDreSubcategoryEntity> allSubcategories = ensureDreStructure(companyId);
        List<FinancialEntryView> allEntries = buildFinancialEntries(companyId, allSubcategories);

        long receivableOpenAmount = sumAmounts(allEntries, ENTRY_TYPE_RECEIVABLE, true);
        long payableOpenAmount = sumAmounts(allEntries, ENTRY_TYPE_PAYABLE, true);
        long grossRevenue = sumSection(allEntries, SECTION_GROSS_REVENUE);
        long grossRevenueDeductions = sumSection(allEntries, SECTION_GROSS_REVENUE_DEDUCTIONS);
        long costOfSales = sumSection(allEntries, SECTION_COST_OF_SALES);
        long salesExpenses = sumSection(allEntries, SECTION_SALES_EXPENSES);
        long administrativeExpenses = sumSection(allEntries, SECTION_ADMINISTRATIVE_EXPENSES);
        long financialRevenue = sumSection(allEntries, SECTION_FINANCIAL_REVENUES);
        long financialExpenses = sumSection(allEntries, SECTION_FINANCIAL_EXPENSES);
        long otherOperatingRevenue = sumSection(allEntries, SECTION_OTHER_OPERATING_RESULTS, ENTRY_TYPE_RECEIVABLE);
        long otherOperatingExpense = sumSection(allEntries, SECTION_OTHER_OPERATING_RESULTS, ENTRY_TYPE_PAYABLE);

        long netRevenue = grossRevenue - grossRevenueDeductions;
        long grossProfit = netRevenue - costOfSales;
        long operatingExpenses = salesExpenses + administrativeExpenses + otherOperatingExpense;
        long operatingResult = grossProfit + otherOperatingRevenue - operatingExpenses;
        long netResult = operatingResult + financialRevenue - financialExpenses;

        long vehicleSalesRevenue = allEntries.stream()
                .filter(entry -> SOURCE_VEHICLE_SALE.equals(entry.source()))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();

        long inventoryValueCents = vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId).stream()
                .filter(vehicle -> "SOLD".equalsIgnoreCase(vehicle.getStatus()) == false)
                .mapToLong(vehicle -> vehicle.getPriceCents() == null ? 0L : Math.max(vehicle.getPriceCents(), 0L))
                .sum();

        List<FinancialEntryHttpResponse> responseEntries = allEntries.stream()
                .sorted(financialEntryComparator())
                .map(this::toHttpResponse)
                .toList();

        return ResponseEntity.ok(new FinancialOverviewHttpResponse(
                new CashFlowSummary(
                        receivableOpenAmount,
                        payableOpenAmount,
                        receivableOpenAmount - payableOpenAmount
                ),
                new DreSummary(
                        vehicleSalesRevenue,
                        (grossRevenue - vehicleSalesRevenue) + financialRevenue + otherOperatingRevenue,
                        grossRevenue,
                        grossRevenueDeductions,
                        operatingExpenses,
                        netResult
                ),
                inventoryValueCents,
                buildAccountSummary(allEntries, ENTRY_TYPE_RECEIVABLE),
                buildAccountSummary(allEntries, ENTRY_TYPE_PAYABLE),
                buildDreStructure(allSubcategories),
                responseEntries
        ));
    }

    @PostMapping("/ioauto/financial/entries")
    @Transactional
    public ResponseEntity<FinancialEntryHttpResponse> createEntry(@Valid @RequestBody SaveFinancialEntryHttpRequest request) {
        enforceFinancePlan(currentUser.companyId());
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_FINANCE, Map.of("action", "CREATE_ENTRY"));
        return ResponseEntity.ok(saveEntry(null, request));
    }

    @PutMapping("/ioauto/financial/entries/{entryId}")
    @Transactional
    public ResponseEntity<FinancialEntryHttpResponse> updateEntry(
            @PathVariable UUID entryId,
            @Valid @RequestBody SaveFinancialEntryHttpRequest request
    ) {
        enforceFinancePlan(currentUser.companyId());
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_FINANCE, Map.of("action", "UPDATE_ENTRY"));
        return ResponseEntity.ok(saveEntry(entryId, request));
    }

    @DeleteMapping("/ioauto/financial/entries/{entryId}")
    @Transactional
    public ResponseEntity<Void> deleteEntry(@PathVariable UUID entryId) {
        UUID companyId = currentUser.companyId();
        enforceFinancePlan(companyId);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_FINANCE, Map.of("action", "DELETE_ENTRY"));
        JpaIoAutoFinancialEntryEntity entity = financialEntries.findByIdAndCompanyId(entryId, companyId)
                .orElseThrow(() -> new BusinessException("FINANCIAL_ENTRY_NOT_FOUND", "Lancamento financeiro nao encontrado."));

        financialEntries.delete(entity);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/ioauto/financial/dre/subcategories")
    @Transactional
    public ResponseEntity<DreSubcategoryHttpResponse> createDreSubcategory(@Valid @RequestBody SaveDreSubcategoryHttpRequest request) {
        enforceFinancePlan(currentUser.companyId());
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_FINANCE, Map.of("action", "CREATE_DRE_SUBCATEGORY"));
        return ResponseEntity.ok(saveDreSubcategory(null, request));
    }

    @PutMapping("/ioauto/financial/dre/subcategories/{subcategoryId}")
    @Transactional
    public ResponseEntity<DreSubcategoryHttpResponse> updateDreSubcategory(
            @PathVariable UUID subcategoryId,
            @Valid @RequestBody SaveDreSubcategoryHttpRequest request
    ) {
        enforceFinancePlan(currentUser.companyId());
        featureUsageService.registerUsage(currentUser.companyId(), FeatureUsageService.FEATURE_FINANCE, Map.of("action", "UPDATE_DRE_SUBCATEGORY"));
        return ResponseEntity.ok(saveDreSubcategory(subcategoryId, request));
    }

    @DeleteMapping("/ioauto/financial/dre/subcategories/{subcategoryId}")
    @Transactional
    public ResponseEntity<Void> deleteDreSubcategory(@PathVariable UUID subcategoryId) {
        UUID companyId = currentUser.companyId();
        enforceFinancePlan(companyId);
        featureUsageService.registerUsage(companyId, FeatureUsageService.FEATURE_FINANCE, Map.of("action", "DELETE_DRE_SUBCATEGORY"));
        JpaIoAutoDreSubcategoryEntity entity = dreSubcategories.findByIdAndCompanyId(subcategoryId, companyId)
                .orElseThrow(() -> new BusinessException("DRE_SUBCATEGORY_NOT_FOUND", "Subcategoria do DRE nao encontrada."));

        if (entity.isLocked()) {
            throw new BusinessException("DRE_SUBCATEGORY_LOCKED", "Esta subcategoria padrao nao pode ser removida.");
        }

        if (financialEntries.existsByCompanyIdAndDreSubcategoryId(companyId, subcategoryId)) {
            throw new BusinessException("DRE_SUBCATEGORY_IN_USE", "Nao e possivel excluir uma subcategoria vinculada a lancamentos.");
        }

        dreSubcategories.delete(entity);
        return ResponseEntity.noContent().build();
    }

    private void enforceFinancePlan(UUID companyId) {
        planManagementService.assertFeatureEnabled(companyId, SuperAdminPlanManagementService.FEATURE_FINANCE);
    }

    private FinancialEntryHttpResponse saveEntry(UUID entryId, SaveFinancialEntryHttpRequest request) {
        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();

        JpaIoAutoFinancialEntryEntity entity = entryId == null
                ? new JpaIoAutoFinancialEntryEntity()
                : financialEntries.findByIdAndCompanyId(entryId, companyId)
                .orElseThrow(() -> new BusinessException("FINANCIAL_ENTRY_NOT_FOUND", "Lancamento financeiro nao encontrado."));

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setCreatedAt(now);
        }

        String entryType = normalizeEntryType(request.type());
        JpaIoAutoDreSubcategoryEntity dreSubcategory = resolveDreSubcategoryForSave(companyId, request, entryType);

        entity.setDescription(requireText(request.description(), "Informe a descricao do lancamento."));
        entity.setEntryType(entryType);
        entity.setCategory(resolveLegacyCategory(dreSubcategory));
        entity.setDreSubcategoryId(dreSubcategory.getId());
        entity.setAmountCents(requirePositiveAmount(request.amountCents()));
        entity.setDueDate(request.dueDate());
        entity.setCounterparty(normalizeNullableText(request.counterparty()));
        entity.setNotes(normalizeNullableText(request.notes()));
        entity.setSettledAt(Boolean.TRUE.equals(request.settled()) ? (entity.getSettledAt() == null ? now : entity.getSettledAt()) : null);
        entity.setUpdatedAt(now);
        financialEntries.save(entity);

        return toHttpResponse(toView(entity, dreSubcategory));
    }

    private DreSubcategoryHttpResponse saveDreSubcategory(UUID subcategoryId, SaveDreSubcategoryHttpRequest request) {
        UUID companyId = currentUser.companyId();
        Instant now = Instant.now();
        DreSectionDefinition section = requireSection(request.sectionCode());
        if (!section.acceptsEntries()) {
            throw new BusinessException("DRE_SECTION_INVALID", "Esta secao do DRE nao aceita subcategorias.");
        }

        JpaIoAutoDreSubcategoryEntity entity = subcategoryId == null
                ? new JpaIoAutoDreSubcategoryEntity()
                : dreSubcategories.findByIdAndCompanyId(subcategoryId, companyId)
                .orElseThrow(() -> new BusinessException("DRE_SUBCATEGORY_NOT_FOUND", "Subcategoria do DRE nao encontrada."));

        if (subcategoryId != null && entity.isLocked()) {
            throw new BusinessException("DRE_SUBCATEGORY_LOCKED", "Esta subcategoria padrao nao pode ser editada.");
        }

        String name = requireText(request.name(), "Informe o nome da subcategoria.");
        String entryType = resolveSectionEntryType(section, request.entryType());

        for (JpaIoAutoDreSubcategoryEntity existing : ensureDreStructure(companyId)) {
            if (subcategoryId != null && existing.getId().equals(subcategoryId)) {
                continue;
            }
            if (companyId.equals(existing.getCompanyId())
                    && existing.getSectionCode().equals(section.code())
                    && existing.getEntryType().equals(entryType)
                    && existing.getName() != null
                    && existing.getName().trim().equalsIgnoreCase(name)) {
                throw new BusinessException("DRE_SUBCATEGORY_DUPLICATED", "Ja existe uma subcategoria com este nome nesta secao.");
            }
        }

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCompanyId(companyId);
            entity.setCode("custom-" + entity.getId());
            entity.setSystem(false);
            entity.setLocked(false);
            entity.setCreatedAt(now);
            entity.setSortOrder(nextSortOrder(companyId, section.code()));
        }

        entity.setSectionCode(section.code());
        entity.setName(name);
        entity.setEntryType(entryType);
        entity.setUpdatedAt(now);

        dreSubcategories.save(entity);
        return toDreSubcategoryResponse(entity);
    }

    private List<JpaIoAutoDreSubcategoryEntity> ensureDreStructure(UUID companyId) {
        List<JpaIoAutoDreSubcategoryEntity> existing = new ArrayList<>(dreSubcategories.findAllByCompanyIdOrderBySectionCodeAscSortOrderAscNameAsc(companyId));
        Map<String, JpaIoAutoDreSubcategoryEntity> byCode = existing.stream()
                .filter(entity -> entity.getCode() != null && entity.getCode().isBlank() == false)
                .collect(LinkedHashMap::new, (map, entity) -> map.put(entity.getCode(), entity), LinkedHashMap::putAll);

        List<JpaIoAutoDreSubcategoryEntity> toSave = new ArrayList<>();
        Instant now = Instant.now();

        for (DreSubcategorySeed seed : DEFAULT_DRE_SUBCATEGORIES) {
            JpaIoAutoDreSubcategoryEntity entity = byCode.get(seed.code());
            boolean changed = false;
            if (entity == null) {
                entity = new JpaIoAutoDreSubcategoryEntity();
                entity.setId(UUID.randomUUID());
                entity.setCompanyId(companyId);
                entity.setCreatedAt(now);
                entity.setCode(seed.code());
                byCode.put(seed.code(), entity);
                existing.add(entity);
                changed = true;
            }

            String currentName = entity.getName() == null ? "" : entity.getName().trim();
            if (seed.sectionCode().equals(entity.getSectionCode()) == false) {
                entity.setSectionCode(seed.sectionCode());
                changed = true;
            }
            if (currentName.isBlank()) {
                entity.setName(seed.name());
                changed = true;
            } else if (currentName.equals(entity.getName()) == false) {
                entity.setName(currentName);
                changed = true;
            }
            if (seed.entryType().equals(entity.getEntryType()) == false) {
                entity.setEntryType(seed.entryType());
                changed = true;
            }
            if (seed.system() != entity.isSystem()) {
                entity.setSystem(seed.system());
                changed = true;
            }
            if (seed.locked() != entity.isLocked()) {
                entity.setLocked(seed.locked());
                changed = true;
            }
            if (entity.getSortOrder() == null || entity.getSortOrder() != seed.sortOrder()) {
                entity.setSortOrder(seed.sortOrder());
                changed = true;
            }
            if (changed) {
                entity.setUpdatedAt(now);
                toSave.add(entity);
            }
        }

        if (toSave.isEmpty() == false) {
            dreSubcategories.saveAll(toSave);
            existing = new ArrayList<>(dreSubcategories.findAllByCompanyIdOrderBySectionCodeAscSortOrderAscNameAsc(companyId));
        }

        return existing;
    }

    private List<FinancialEntryView> buildFinancialEntries(UUID companyId, List<JpaIoAutoDreSubcategoryEntity> allSubcategories) {
        Map<UUID, JpaIoAutoDreSubcategoryEntity> byId = allSubcategories.stream()
                .collect(LinkedHashMap::new, (map, entity) -> map.put(entity.getId(), entity), LinkedHashMap::putAll);
        Map<String, JpaIoAutoDreSubcategoryEntity> byCode = allSubcategories.stream()
                .collect(LinkedHashMap::new, (map, entity) -> map.put(entity.getCode(), entity), LinkedHashMap::putAll);

        List<FinancialEntryView> entries = new ArrayList<>();

        for (JpaIoAutoFinancialEntryEntity entity : financialEntries.findAllByCompanyIdOrderByDueDateAscUpdatedAtDesc(companyId)) {
            entries.add(toView(entity, resolveDreSubcategory(entity, byId, byCode)));
        }

        JpaIoAutoDreSubcategoryEntity vehicleSalesSubcategory = byCode.get(SUBCATEGORY_VEHICLE_SALES);
        DreSectionDefinition grossRevenueSection = requireSection(SECTION_GROSS_REVENUE);
        Map<UUID, JpaAtendimentoSessionEntity> settledSalesByVehicle = new LinkedHashMap<>();
        for (JpaAtendimentoSessionEntity session : sessions.findAllByCompanyIdAndSaleCompletedIsTrueOrderBySaleCompletedAtDesc(companyId)) {
            if (session.getSoldVehicleId() == null || settledSalesByVehicle.containsKey(session.getSoldVehicleId())) {
                continue;
            }
            settledSalesByVehicle.put(session.getSoldVehicleId(), session);
        }

        for (JpaIoAutoVehicleEntity vehicle : vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId)) {
            String status = normalizeText(vehicle.getStatus(), "DRAFT").toUpperCase(Locale.ROOT);
            if ("SOLD".equals(status) == false) {
                continue;
            }

            JpaAtendimentoSessionEntity settledSale = settledSalesByVehicle.get(vehicle.getId());
            Instant saleCompletedAt = settledSale == null ? null : settledSale.getSaleCompletedAt();
            Instant entryUpdatedAt = saleCompletedAt != null ? saleCompletedAt : vehicle.getUpdatedAt();

            entries.add(new FinancialEntryView(
                    vehicle.getId(),
                    normalizeText(vehicle.getTitle(), "Venda de veiculo"),
                    ENTRY_TYPE_RECEIVABLE,
                    "VEHICLE_SALE",
                    vehicle.getPriceCents() == null ? 0L : Math.max(vehicle.getPriceCents(), 0L),
                    entryUpdatedAt == null ? null : entryUpdatedAt.atZone(FINANCIAL_ZONE).toLocalDate(),
                    saleCompletedAt,
                    null,
                    saleCompletedAt == null
                            ? "Veiculo marcado como vendido no estoque."
                            : "Venda concluida e liquidada pelo fluxo comercial.",
                    SOURCE_VEHICLE_SALE,
                    vehicle.getId(),
                    vehicle.getTitle(),
                    entryUpdatedAt,
                    entryUpdatedAt,
                    grossRevenueSection.code(),
                    grossRevenueSection.label(),
                    vehicleSalesSubcategory == null ? null : vehicleSalesSubcategory.getId(),
                    vehicleSalesSubcategory == null ? "Venda de Veiculos" : vehicleSalesSubcategory.getName()
            ));
        }

        return entries;
    }

    private FinancialEntryView toView(JpaIoAutoFinancialEntryEntity entity, JpaIoAutoDreSubcategoryEntity dreSubcategory) {
        DreSectionDefinition section = requireSection(dreSubcategory == null ? SECTION_OTHER_OPERATING_RESULTS : dreSubcategory.getSectionCode());
        return new FinancialEntryView(
                entity.getId(),
                normalizeText(entity.getDescription(), "Lancamento financeiro"),
                normalizeEntryType(entity.getEntryType()),
                normalizeLegacyCategory(normalizeEntryType(entity.getEntryType()), entity.getCategory()),
                entity.getAmountCents() == null ? 0L : Math.max(entity.getAmountCents(), 0L),
                entity.getDueDate(),
                entity.getSettledAt(),
                normalizeNullableText(entity.getCounterparty()),
                normalizeNullableText(entity.getNotes()),
                SOURCE_MANUAL,
                null,
                null,
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                section.code(),
                section.label(),
                dreSubcategory == null ? null : dreSubcategory.getId(),
                dreSubcategory == null ? null : dreSubcategory.getName()
        );
    }

    private FinancialEntryHttpResponse toHttpResponse(FinancialEntryView entry) {
        return new FinancialEntryHttpResponse(
                entry.id(),
                entry.description(),
                entry.type(),
                entry.category(),
                entry.amountCents(),
                entry.dueDate(),
                entry.settledAt(),
                resolveStatus(entry),
                entry.counterparty(),
                entry.notes(),
                entry.source(),
                entry.vehicleId(),
                entry.vehicleTitle(),
                entry.createdAt(),
                entry.updatedAt(),
                entry.dreSectionCode(),
                entry.dreSectionLabel(),
                entry.dreSubcategoryId(),
                entry.dreSubcategoryName()
        );
    }

    private DreStructureHttpResponse buildDreStructure(List<JpaIoAutoDreSubcategoryEntity> allSubcategories) {
        List<DreSectionHttpResponse> sections = new ArrayList<>();

        for (DreSectionDefinition section : DRE_SECTIONS) {
            List<DreSubcategoryHttpResponse> subcategories = allSubcategories.stream()
                    .filter(entity -> section.code().equals(entity.getSectionCode()))
                    .sorted(Comparator.comparing(JpaIoAutoDreSubcategoryEntity::getSortOrder).thenComparing(JpaIoAutoDreSubcategoryEntity::getName, String.CASE_INSENSITIVE_ORDER))
                    .map(this::toDreSubcategoryResponse)
                    .toList();

            sections.add(new DreSectionHttpResponse(
                    section.code(),
                    section.label(),
                    section.description(),
                    section.entryTypeMode(),
                    section.acceptsEntries(),
                    section.sortOrder(),
                    subcategories
            ));
        }

        return new DreStructureHttpResponse(sections);
    }

    private DreSubcategoryHttpResponse toDreSubcategoryResponse(JpaIoAutoDreSubcategoryEntity entity) {
        return new DreSubcategoryHttpResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getSectionCode(),
                entity.getEntryType(),
                entity.isSystem(),
                entity.isLocked(),
                entity.getSortOrder() == null ? 0 : entity.getSortOrder()
        );
    }

    private AccountSummary buildAccountSummary(List<FinancialEntryView> entries, String entryType) {
        long openAmount = entries.stream()
                .filter(entry -> entryType.equals(entry.type()))
                .filter(entry -> "SETTLED".equals(resolveStatus(entry)) == false)
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
        long settledAmount = entries.stream()
                .filter(entry -> entryType.equals(entry.type()))
                .filter(entry -> "SETTLED".equals(resolveStatus(entry)))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
        long openCount = entries.stream()
                .filter(entry -> entryType.equals(entry.type()))
                .filter(entry -> "OPEN".equals(resolveStatus(entry)))
                .count();
        long overdueCount = entries.stream()
                .filter(entry -> entryType.equals(entry.type()))
                .filter(entry -> "OVERDUE".equals(resolveStatus(entry)))
                .count();

        return new AccountSummary(openAmount, settledAmount, openCount, overdueCount);
    }

    private long sumAmounts(List<FinancialEntryView> entries, String entryType, boolean onlyOpen) {
        return entries.stream()
                .filter(entry -> entryType.equals(entry.type()))
                .filter(entry -> onlyOpen == false || "SETTLED".equals(resolveStatus(entry)) == false)
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
    }

    private long sumSection(List<FinancialEntryView> entries, String sectionCode) {
        return entries.stream()
                .filter(entry -> sectionCode.equals(entry.dreSectionCode()))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
    }

    private long sumSection(List<FinancialEntryView> entries, String sectionCode, String entryType) {
        return entries.stream()
                .filter(entry -> sectionCode.equals(entry.dreSectionCode()))
                .filter(entry -> entryType.equals(entry.type()))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
    }

    private Comparator<FinancialEntryView> financialEntryComparator() {
        return Comparator
                .comparing((FinancialEntryView entry) -> statusOrder(resolveStatus(entry)))
                .thenComparing(FinancialEntryView::dueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(FinancialEntryView::updatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(FinancialEntryView::description, String.CASE_INSENSITIVE_ORDER);
    }

    private int statusOrder(String status) {
        return switch (status) {
            case "OVERDUE" -> 0;
            case "OPEN" -> 1;
            default -> 2;
        };
    }

    private String resolveStatus(FinancialEntryView entry) {
        if (entry.settledAt() != null) {
            return "SETTLED";
        }

        LocalDate today = LocalDate.now(FINANCIAL_ZONE);
        if (entry.dueDate() != null && entry.dueDate().isBefore(today)) {
            return "OVERDUE";
        }

        return "OPEN";
    }

    private JpaIoAutoDreSubcategoryEntity resolveDreSubcategoryForSave(UUID companyId, SaveFinancialEntryHttpRequest request, String entryType) {
        List<JpaIoAutoDreSubcategoryEntity> allSubcategories = ensureDreStructure(companyId);
        Map<String, JpaIoAutoDreSubcategoryEntity> byCode = allSubcategories.stream()
                .collect(LinkedHashMap::new, (map, entity) -> map.put(entity.getCode(), entity), LinkedHashMap::putAll);

        JpaIoAutoDreSubcategoryEntity dreSubcategory = null;
        if (request.dreSubcategoryId() != null) {
            dreSubcategory = dreSubcategories.findByIdAndCompanyId(request.dreSubcategoryId(), companyId).orElse(null);
        } else {
            String fallbackCode = legacyCategoryToDefaultSubcategoryCode(entryType, request.category());
            if (fallbackCode != null) {
                dreSubcategory = byCode.get(fallbackCode);
            }
        }

        if (dreSubcategory == null) {
            throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Selecione uma subcategoria do DRE.");
        }

        if (entryType.equals(dreSubcategory.getEntryType()) == false) {
            throw new BusinessException("FINANCIAL_ENTRY_INVALID", "A subcategoria escolhida nao e compativel com o tipo do lancamento.");
        }

        return dreSubcategory;
    }

    private JpaIoAutoDreSubcategoryEntity resolveDreSubcategory(
            JpaIoAutoFinancialEntryEntity entity,
            Map<UUID, JpaIoAutoDreSubcategoryEntity> byId,
            Map<String, JpaIoAutoDreSubcategoryEntity> byCode
    ) {
        if (entity.getDreSubcategoryId() != null && byId.containsKey(entity.getDreSubcategoryId())) {
            return byId.get(entity.getDreSubcategoryId());
        }

        String fallbackCode = legacyCategoryToDefaultSubcategoryCode(normalizeEntryType(entity.getEntryType()), entity.getCategory());
        if (fallbackCode == null) {
            fallbackCode = ENTRY_TYPE_RECEIVABLE.equals(normalizeEntryType(entity.getEntryType()))
                    ? SUBCATEGORY_OTHER_OPERATING_REVENUE
                    : SUBCATEGORY_OTHER_OPERATING_EXPENSE;
        }
        return byCode.get(fallbackCode);
    }

    private DreSectionDefinition requireSection(String rawCode) {
        String code = normalizeText(rawCode).toUpperCase(Locale.ROOT);
        DreSectionDefinition section = DRE_SECTION_BY_CODE.get(code);
        if (section == null) {
            throw new BusinessException("DRE_SECTION_INVALID", "Secao do DRE invalida.");
        }
        return section;
    }

    private String resolveSectionEntryType(DreSectionDefinition section, String requestedEntryType) {
        if (ENTRY_TYPE_BOTH.equals(section.entryTypeMode()) == false) {
            return section.entryTypeMode();
        }
        return normalizeEntryType(requestedEntryType);
    }

    private int nextSortOrder(UUID companyId, String sectionCode) {
        return dreSubcategories.findAllByCompanyIdOrderBySectionCodeAscSortOrderAscNameAsc(companyId).stream()
                .filter(entity -> sectionCode.equals(entity.getSectionCode()))
                .map(JpaIoAutoDreSubcategoryEntity::getSortOrder)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .orElse(0) + 10;
    }

    private String resolveLegacyCategory(JpaIoAutoDreSubcategoryEntity subcategory) {
        if (SECTION_GROSS_REVENUE.equals(subcategory.getSectionCode())) {
            return SUBCATEGORY_VEHICLE_SALES.equals(subcategory.getCode()) ? "VEHICLE_SALE" : "SERVICE_REVENUE";
        }
        if (SECTION_GROSS_REVENUE_DEDUCTIONS.equals(subcategory.getSectionCode())) {
            return "TAXES";
        }
        if (SECTION_COST_OF_SALES.equals(subcategory.getSectionCode())) {
            return "SUPPLIER";
        }
        if (SECTION_ADMINISTRATIVE_EXPENSES.equals(subcategory.getSectionCode())) {
            return "ADMINISTRATIVE_EXPENSE";
        }
        if (SECTION_SALES_EXPENSES.equals(subcategory.getSectionCode())) {
            return "OPERATING_EXPENSE";
        }
        if (SECTION_FINANCIAL_REVENUES.equals(subcategory.getSectionCode())) {
            return "OTHER_REVENUE";
        }
        if (SECTION_FINANCIAL_EXPENSES.equals(subcategory.getSectionCode())) {
            return "OTHER_EXPENSE";
        }
        return ENTRY_TYPE_RECEIVABLE.equals(subcategory.getEntryType()) ? "OTHER_REVENUE" : "OTHER_EXPENSE";
    }

    private String legacyCategoryToDefaultSubcategoryCode(String entryType, String category) {
        String normalized = normalizeText(category).toUpperCase(Locale.ROOT);
        if ("VEHICLE_SALE".equals(normalized)) {
            return SUBCATEGORY_VEHICLE_SALES;
        }
        if ("SERVICE_REVENUE".equals(normalized)) {
            return SUBCATEGORY_SERVICE_COMMISSIONS;
        }
        if ("TAXES".equals(normalized)) {
            return SUBCATEGORY_SALES_TAXES;
        }
        if ("SUPPLIER".equals(normalized)) {
            return SUBCATEGORY_VEHICLE_ACQUISITION;
        }
        if ("ADMINISTRATIVE_EXPENSE".equals(normalized)) {
            return SUBCATEGORY_ADMIN_EXPENSES;
        }
        if ("OPERATING_EXPENSE".equals(normalized)) {
            return SUBCATEGORY_OTHER_OPERATING_EXPENSE;
        }
        if ("OTHER_REVENUE".equals(normalized)) {
            return ENTRY_TYPE_RECEIVABLE.equals(entryType) ? SUBCATEGORY_OTHER_OPERATING_REVENUE : null;
        }
        if ("OTHER_EXPENSE".equals(normalized)) {
            return ENTRY_TYPE_PAYABLE.equals(entryType) ? SUBCATEGORY_OTHER_OPERATING_EXPENSE : null;
        }
        return ENTRY_TYPE_RECEIVABLE.equals(entryType) ? SUBCATEGORY_OTHER_OPERATING_REVENUE : SUBCATEGORY_OTHER_OPERATING_EXPENSE;
    }

    private String normalizeEntryType(String raw) {
        String normalized = normalizeText(raw).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case ENTRY_TYPE_PAYABLE, ENTRY_TYPE_RECEIVABLE -> normalized;
            default -> throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Tipo de lancamento invalido.");
        };
    }

    private String normalizeLegacyCategory(String entryType, String raw) {
        String normalized = normalizeText(raw).toUpperCase(Locale.ROOT);
        if (ENTRY_TYPE_RECEIVABLE.equals(entryType)) {
            return switch (normalized) {
                case "", "OTHER_REVENUE" -> "OTHER_REVENUE";
                case "SERVICE_REVENUE" -> "SERVICE_REVENUE";
                case "VEHICLE_SALE" -> "VEHICLE_SALE";
                default -> "OTHER_REVENUE";
            };
        }

        return switch (normalized) {
            case "", "OPERATING_EXPENSE" -> "OPERATING_EXPENSE";
            case "SUPPLIER" -> "SUPPLIER";
            case "ADMINISTRATIVE_EXPENSE" -> "ADMINISTRATIVE_EXPENSE";
            case "TAXES" -> "TAXES";
            case "OTHER_EXPENSE" -> "OTHER_EXPENSE";
            default -> "OTHER_EXPENSE";
        };
    }

    private Long requirePositiveAmount(Long value) {
        if (value == null || value <= 0) {
            throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Informe um valor maior que zero.");
        }
        return value;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) {
            throw new BusinessException("FINANCIAL_ENTRY_INVALID", message);
        }
        return normalized;
    }

    private String normalizeNullableText(String value) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private record FinancialEntryView(
            UUID id,
            String description,
            String type,
            String category,
            long amountCents,
            LocalDate dueDate,
            Instant settledAt,
            String counterparty,
            String notes,
            String source,
            UUID vehicleId,
            String vehicleTitle,
            Instant createdAt,
            Instant updatedAt,
            String dreSectionCode,
            String dreSectionLabel,
            UUID dreSubcategoryId,
            String dreSubcategoryName
    ) {
    }

    private record DreSectionDefinition(
            String code,
            String label,
            String description,
            String entryTypeMode,
            boolean acceptsEntries,
            int sortOrder
    ) {
    }

    private record DreSubcategorySeed(
            String code,
            String sectionCode,
            String name,
            String entryType,
            boolean system,
            boolean locked,
            int sortOrder
    ) {
    }

    public record FinancialOverviewHttpResponse(
            CashFlowSummary cashFlow,
            DreSummary dre,
            long inventoryValueCents,
            AccountSummary accountsReceivable,
            AccountSummary accountsPayable,
            DreStructureHttpResponse dreStructure,
            List<FinancialEntryHttpResponse> entries
    ) {
    }

    public record CashFlowSummary(
            long entryCents,
            long exitCents,
            long balanceCents
    ) {
    }

    public record DreSummary(
            long vehicleSalesRevenueCents,
            long otherRevenueCents,
            long grossRevenueCents,
            long taxExpensesCents,
            long operatingExpensesCents,
            long netResultCents
    ) {
    }

    public record AccountSummary(
            long openAmountCents,
            long settledAmountCents,
            long openCount,
            long overdueCount
    ) {
    }

    public record DreStructureHttpResponse(
            List<DreSectionHttpResponse> sections
    ) {
    }

    public record DreSectionHttpResponse(
            String code,
            String label,
            String description,
            String entryTypeMode,
            boolean acceptsEntries,
            int sortOrder,
            List<DreSubcategoryHttpResponse> subcategories
    ) {
    }

    public record DreSubcategoryHttpResponse(
            UUID id,
            String code,
            String name,
            String sectionCode,
            String entryType,
            boolean system,
            boolean locked,
            int sortOrder
    ) {
    }

    public record FinancialEntryHttpResponse(
            UUID id,
            String description,
            String type,
            String category,
            long amountCents,
            LocalDate dueDate,
            Instant settledAt,
            String status,
            String counterparty,
            String notes,
            String source,
            UUID vehicleId,
            String vehicleTitle,
            Instant createdAt,
            Instant updatedAt,
            String dreSectionCode,
            String dreSectionLabel,
            UUID dreSubcategoryId,
            String dreSubcategoryName
    ) {
    }

    public record SaveFinancialEntryHttpRequest(
            @NotBlank(message = "Informe a descricao.") String description,
            @NotBlank(message = "Informe o tipo.") String type,
            String category,
            UUID dreSubcategoryId,
            @NotNull(message = "Informe o valor.") Long amountCents,
            LocalDate dueDate,
            String counterparty,
            String notes,
            Boolean settled
    ) {
    }

    public record SaveDreSubcategoryHttpRequest(
            @NotBlank(message = "Informe a secao do DRE.") String sectionCode,
            @NotBlank(message = "Informe o nome da subcategoria.") String name,
            String entryType
    ) {
    }
}
