package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoFinancialEntryRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoFinancialEntryEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.application.auth.port.out.CurrentUserPort;
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
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
public class IoAutoFinancialController {

    private static final ZoneId FINANCIAL_ZONE = ZoneId.of("America/Sao_Paulo");

    private final CurrentUserPort currentUser;
    private final IoAutoFinancialEntryRepositoryJpa financialEntries;
    private final IoAutoVehicleRepositoryJpa vehicles;

    public IoAutoFinancialController(
            CurrentUserPort currentUser,
            IoAutoFinancialEntryRepositoryJpa financialEntries,
            IoAutoVehicleRepositoryJpa vehicles
    ) {
        this.currentUser = currentUser;
        this.financialEntries = financialEntries;
        this.vehicles = vehicles;
    }

    @GetMapping("/ioauto/financial/overview")
    public ResponseEntity<FinancialOverviewHttpResponse> getOverview() {
        UUID companyId = currentUser.companyId();
        List<FinancialEntryView> allEntries = buildFinancialEntries(companyId);

        long receivableOpenAmount = sumAmounts(allEntries, "RECEIVABLE", true);
        long payableOpenAmount = sumAmounts(allEntries, "PAYABLE", true);
        long grossRevenue = sumAmounts(allEntries, "RECEIVABLE", false);
        long vehicleSalesRevenue = allEntries.stream()
                .filter(entry -> "RECEIVABLE".equals(entry.type()))
                .filter(entry -> "VEHICLE_SALE".equals(entry.category()))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
        long otherRevenue = grossRevenue - vehicleSalesRevenue;
        long taxExpenses = allEntries.stream()
                .filter(entry -> "PAYABLE".equals(entry.type()))
                .filter(entry -> "TAXES".equals(entry.category()))
                .mapToLong(FinancialEntryView::amountCents)
                .sum();
        long operatingExpenses = allEntries.stream()
                .filter(entry -> "PAYABLE".equals(entry.type()))
                .filter(entry -> "TAXES".equals(entry.category()) == false)
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
                        otherRevenue,
                        grossRevenue,
                        taxExpenses,
                        operatingExpenses,
                        grossRevenue - taxExpenses - operatingExpenses
                ),
                inventoryValueCents,
                buildAccountSummary(allEntries, "RECEIVABLE"),
                buildAccountSummary(allEntries, "PAYABLE"),
                responseEntries
        ));
    }

    @PostMapping("/ioauto/financial/entries")
    @Transactional
    public ResponseEntity<FinancialEntryHttpResponse> createEntry(@Valid @RequestBody SaveFinancialEntryHttpRequest request) {
        return ResponseEntity.ok(saveEntry(null, request));
    }

    @PutMapping("/ioauto/financial/entries/{entryId}")
    @Transactional
    public ResponseEntity<FinancialEntryHttpResponse> updateEntry(
            @PathVariable UUID entryId,
            @Valid @RequestBody SaveFinancialEntryHttpRequest request
    ) {
        return ResponseEntity.ok(saveEntry(entryId, request));
    }

    @DeleteMapping("/ioauto/financial/entries/{entryId}")
    @Transactional
    public ResponseEntity<Void> deleteEntry(@PathVariable UUID entryId) {
        UUID companyId = currentUser.companyId();
        JpaIoAutoFinancialEntryEntity entity = financialEntries.findByIdAndCompanyId(entryId, companyId)
                .orElseThrow(() -> new BusinessException("FINANCIAL_ENTRY_NOT_FOUND", "Lancamento financeiro nao encontrado."));

        financialEntries.delete(entity);
        return ResponseEntity.noContent().build();
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
        entity.setDescription(requireText(request.description(), "Informe a descricao do lancamento."));
        entity.setEntryType(entryType);
        entity.setCategory(normalizeCategory(entryType, request.category()));
        entity.setAmountCents(requirePositiveAmount(request.amountCents()));
        entity.setDueDate(request.dueDate());
        entity.setCounterparty(normalizeNullableText(request.counterparty()));
        entity.setNotes(normalizeNullableText(request.notes()));
        entity.setSettledAt(Boolean.TRUE.equals(request.settled()) ? (entity.getSettledAt() == null ? now : entity.getSettledAt()) : null);
        entity.setUpdatedAt(now);
        financialEntries.save(entity);

        return toHttpResponse(toView(entity));
    }

    private List<FinancialEntryView> buildFinancialEntries(UUID companyId) {
        List<FinancialEntryView> entries = new ArrayList<>();

        for (JpaIoAutoFinancialEntryEntity entity : financialEntries.findAllByCompanyIdOrderByDueDateAscUpdatedAtDesc(companyId)) {
            entries.add(toView(entity));
        }

        for (JpaIoAutoVehicleEntity vehicle : vehicles.findAllByCompanyIdOrderByUpdatedAtDesc(companyId)) {
            String status = normalizeText(vehicle.getStatus(), "DRAFT").toUpperCase(Locale.ROOT);
            if ("SOLD".equals(status) == false) {
                continue;
            }

            entries.add(new FinancialEntryView(
                    vehicle.getId(),
                    vehicle.getTitle(),
                    "RECEIVABLE",
                    "VEHICLE_SALE",
                    vehicle.getPriceCents() == null ? 0L : Math.max(vehicle.getPriceCents(), 0L),
                    vehicle.getUpdatedAt() == null ? null : vehicle.getUpdatedAt().atZone(FINANCIAL_ZONE).toLocalDate(),
                    null,
                    null,
                    "Veiculo marcado como vendido no estoque.",
                    "VEHICLE_SALE",
                    vehicle.getId(),
                    vehicle.getTitle(),
                    vehicle.getUpdatedAt(),
                    vehicle.getUpdatedAt()
            ));
        }

        return entries;
    }

    private FinancialEntryView toView(JpaIoAutoFinancialEntryEntity entity) {
        return new FinancialEntryView(
                entity.getId(),
                normalizeText(entity.getDescription(), "Lancamento financeiro"),
                normalizeEntryType(entity.getEntryType()),
                normalizeCategory(normalizeEntryType(entity.getEntryType()), entity.getCategory()),
                entity.getAmountCents() == null ? 0L : Math.max(entity.getAmountCents(), 0L),
                entity.getDueDate(),
                entity.getSettledAt(),
                normalizeNullableText(entity.getCounterparty()),
                normalizeNullableText(entity.getNotes()),
                "MANUAL",
                null,
                null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
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
                entry.updatedAt()
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

    private String normalizeEntryType(String raw) {
        String normalized = normalizeText(raw).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PAYABLE", "RECEIVABLE" -> normalized;
            default -> throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Tipo de lancamento invalido.");
        };
    }

    private String normalizeCategory(String entryType, String raw) {
        String normalized = normalizeText(raw).toUpperCase(Locale.ROOT);
        if ("RECEIVABLE".equals(entryType)) {
            return switch (normalized) {
                case "", "OTHER_REVENUE" -> "OTHER_REVENUE";
                case "SERVICE_REVENUE" -> "SERVICE_REVENUE";
                case "VEHICLE_SALE" -> "VEHICLE_SALE";
                default -> throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Categoria invalida para contas a receber.");
            };
        }

        return switch (normalized) {
            case "", "OPERATING_EXPENSE" -> "OPERATING_EXPENSE";
            case "SUPPLIER" -> "SUPPLIER";
            case "ADMINISTRATIVE_EXPENSE" -> "ADMINISTRATIVE_EXPENSE";
            case "TAXES" -> "TAXES";
            case "OTHER_EXPENSE" -> "OTHER_EXPENSE";
            default -> throw new BusinessException("FINANCIAL_ENTRY_INVALID", "Categoria invalida para contas a pagar.");
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
            Instant updatedAt
    ) {
    }

    public record FinancialOverviewHttpResponse(
            CashFlowSummary cashFlow,
            DreSummary dre,
            long inventoryValueCents,
            AccountSummary accountsReceivable,
            AccountSummary accountsPayable,
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
            Instant updatedAt
    ) {
    }

    public record SaveFinancialEntryHttpRequest(
            @NotBlank(message = "Informe a descricao.") String description,
            @NotBlank(message = "Informe o tipo.") String type,
            String category,
            @NotNull(message = "Informe o valor.") Long amountCents,
            LocalDate dueDate,
            String counterparty,
            String notes,
            Boolean settled
    ) {
    }
}
