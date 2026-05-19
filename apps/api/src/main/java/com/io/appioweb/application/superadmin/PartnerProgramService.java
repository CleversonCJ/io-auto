package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.superadmin.JpaPartnerProgramLeadEntity;
import com.io.appioweb.adapters.persistence.superadmin.JpaPartnerProgramPartnerEntity;
import com.io.appioweb.adapters.persistence.superadmin.PartnerProgramLeadRepositoryJpa;
import com.io.appioweb.adapters.persistence.superadmin.PartnerProgramPartnerRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PartnerProgramService {

    private static final int DEFAULT_COMMISSION_BPS = 2500;
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final String LEAD_STATUS_NEW = "NEW";
    private static final String LEAD_STATUS_CONTACTED = "CONTACTED";
    private static final String LEAD_STATUS_QUALIFIED = "QUALIFIED";
    private static final String LEAD_STATUS_CONVERTED = "CONVERTED";
    private static final String LEAD_STATUS_LOST = "LOST";
    private static final String BILLING_RECURRENCE_MONTHLY = "MONTHLY";
    private static final String BILLING_RECURRENCE_ANNUAL = "ANNUAL";
    private static final String COMMISSION_STATUS_PENDING = "PENDING";
    private static final String COMMISSION_STATUS_PAID = "PAID";
    private static final String COMMISSION_STATUS_CANCELED = "CANCELED";
    private static final ZoneId DEFAULT_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MM/yyyy");

    private final PartnerProgramPartnerRepositoryJpa partners;
    private final PartnerProgramLeadRepositoryJpa leads;

    public PartnerProgramService(
            PartnerProgramPartnerRepositoryJpa partners,
            PartnerProgramLeadRepositoryJpa leads
    ) {
        this.partners = partners;
        this.leads = leads;
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard() {
        List<JpaPartnerProgramPartnerEntity> partnerEntities = partners.findAllByOrderByCreatedAtDesc();
        List<JpaPartnerProgramLeadEntity> leadEntities = leads.findAllByOrderByCreatedAtDesc();
        Map<UUID, JpaPartnerProgramPartnerEntity> partnersById = partnerEntities.stream()
                .collect(Collectors.toMap(JpaPartnerProgramPartnerEntity::getId, item -> item, (left, right) -> left, LinkedHashMap::new));
        Map<UUID, List<JpaPartnerProgramLeadEntity>> leadsByPartner = groupLeadsByPartner(leadEntities);

        List<PartnerRow> partnerRows = partnerEntities.stream()
                .map(partner -> toPartnerRow(partner, leadsByPartner.getOrDefault(partner.getId(), List.of())))
                .toList();

        List<LeadRow> leadRows = leadEntities.stream()
                .map(lead -> toLeadRow(lead, partnersById.get(lead.getPartnerId())))
                .toList();

        long convertedLeads = leadEntities.stream().filter(this::isConvertedLead).count();
        long revenueCents = leadEntities.stream().mapToLong(this::revenueForLead).sum();
        long commissionTotalCents = leadEntities.stream().mapToLong(this::commissionGeneratedForLead).sum();
        long commissionPaidCents = leadEntities.stream().mapToLong(this::commissionPaidForLead).sum();
        long commissionPendingCents = leadEntities.stream().mapToLong(this::commissionPendingForLead).sum();

        DashboardSummary summary = new DashboardSummary(
                (int) partnerEntities.stream().filter(partner -> STATUS_ACTIVE.equals(partner.getStatus())).count(),
                leadEntities.size(),
                (int) convertedLeads,
                percentage(convertedLeads, leadEntities.size()),
                revenueCents,
                commissionTotalCents,
                commissionPaidCents,
                commissionPendingCents
        );

        Charts charts = new Charts(
                partnerRows.stream().map(row -> new MetricPoint(row.partnerName(), row.leadsSent())).toList(),
                partnerRows.stream().map(row -> new MetricPoint(row.partnerName(), row.salesClosed())).toList(),
                buildMonthlyMetricPoints(leadEntities, true),
                partnerRows.stream().map(row -> new MetricPoint(row.partnerName(), row.revenueGeneratedCents())).toList(),
                partnerRows.stream().map(row -> new DecimalMetricPoint(row.partnerName(), row.conversionRate())).toList(),
                buildMonthlyMetricPoints(leadEntities, false),
                partnerRows.stream()
                        .sorted(Comparator.comparingLong(PartnerRow::revenueGeneratedCents).reversed())
                        .map(row -> new MetricPoint(row.partnerName(), row.revenueGeneratedCents()))
                        .toList()
        );

        return new DashboardResponse(summary, partnerRows, leadRows, charts);
    }

    @Transactional(readOnly = true)
    public PartnerDetailResponse getPartnerDetail(UUID partnerId) {
        JpaPartnerProgramPartnerEntity partner = findPartner(partnerId);
        List<JpaPartnerProgramLeadEntity> partnerLeads = leads.findAllByPartnerIdOrderByCreatedAtDesc(partnerId);
        PartnerRow partnerRow = toPartnerRow(partner, partnerLeads);
        List<LeadRow> leadRows = partnerLeads.stream().map(lead -> toLeadRow(lead, partner)).toList();
        List<CommissionRow> commissions = partnerLeads.stream()
                .filter(this::isConvertedLead)
                .map(lead -> new CommissionRow(
                        lead.getId(),
                        normalizeText(lead.getStoreName()),
                        normalizeText(lead.getClosedPlan()),
                        normalizeText(lead.getClosedBillingRecurrence()),
                        lead.getFirstMonthlyFeeCents(),
                        lead.getCommissionCents(),
                        normalizeText(lead.getCommissionStatus()),
                        lead.getCommissionDueDate(),
                        lead.getClosedAt()
                ))
                .toList();

        PartnerDetailCharts charts = new PartnerDetailCharts(
                buildMonthlyMetricPoints(partnerLeads, false),
                buildMonthlyConversionPoints(partnerLeads),
                buildMonthlyMetricPoints(partnerLeads, true)
        );

        return new PartnerDetailResponse(partnerRow, leadRows, commissions, charts);
    }

    @Transactional
    public PartnerRow createPartner(SavePartnerCommand command) {
        Instant now = Instant.now();
        JpaPartnerProgramPartnerEntity entity = new JpaPartnerProgramPartnerEntity();
        entity.setId(UUID.randomUUID());
        entity.setReferenceCode(generateReferenceCode(command.partnerName(), command.companyName()));
        entity.setPartnerName(requireText(command.partnerName(), "Informe o nome do parceiro."));
        entity.setCompanyName(normalizeNullable(command.companyName(), 160));
        entity.setWhatsapp(normalizePhone(command.whatsapp(), false));
        entity.setEmail(normalizeNullable(command.email(), 180));
        entity.setCity(normalizeNullable(command.city(), 120));
        entity.setState(normalizeState(command.state()));
        entity.setPartnerType(normalizeNullable(command.partnerType(), 80));
        entity.setDefaultCommissionBps(normalizeCommissionBps(command.defaultCommissionBps()));
        entity.setStatus(normalizePartnerStatus(command.status()));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        partners.save(entity);
        return toPartnerRow(entity, List.of());
    }

    @Transactional
    public PartnerRow updatePartner(UUID partnerId, SavePartnerCommand command) {
        JpaPartnerProgramPartnerEntity entity = findPartner(partnerId);
        entity.setPartnerName(requireText(command.partnerName(), "Informe o nome do parceiro."));
        entity.setCompanyName(normalizeNullable(command.companyName(), 160));
        entity.setWhatsapp(normalizePhone(command.whatsapp(), false));
        entity.setEmail(normalizeNullable(command.email(), 180));
        entity.setCity(normalizeNullable(command.city(), 120));
        entity.setState(normalizeState(command.state()));
        entity.setPartnerType(normalizeNullable(command.partnerType(), 80));
        entity.setDefaultCommissionBps(normalizeCommissionBps(command.defaultCommissionBps()));
        entity.setStatus(normalizePartnerStatus(command.status()));
        entity.setUpdatedAt(Instant.now());
        partners.save(entity);
        return toPartnerRow(entity, leads.findAllByPartnerIdOrderByCreatedAtDesc(partnerId));
    }

    @Transactional
    public LeadRow updateLead(UUID leadId, UpdateLeadCommand command) {
        JpaPartnerProgramLeadEntity entity = leads.findById(leadId)
                .orElseThrow(() -> new BusinessException("PARTNER_LEAD_NOT_FOUND", "Lead do programa de parceiros nao encontrado."));

        String leadStatus = resolveEffectiveLeadStatus(command);
        entity.setLeadStatus(leadStatus);
        entity.setSalesOwner(normalizeNullable(command.salesOwner(), 160));
        entity.setNotes(normalizeLongText(command.notes()));

        if (LEAD_STATUS_CONVERTED.equals(leadStatus)) {
            JpaPartnerProgramPartnerEntity partner = findPartner(entity.getPartnerId());
            String closedPlan = requireText(command.closedPlan(), "Informe o plano fechado.");
            String closedBillingRecurrence = normalizeBillingRecurrence(command.closedBillingRecurrence());
            Long firstMonthlyFeeCents = requireMoney(command.firstMonthlyFeeCents(), "Informe o valor da primeira mensalidade.");
            Instant closedAt = requireInstant(command.closedAt(), "Informe a data de fechamento.");
            String commissionStatus = normalizeCommissionStatus(command.commissionStatus());
            LocalDate commissionDueDate = command.commissionDueDate() != null
                    ? command.commissionDueDate()
                    : closedAt.atZone(DEFAULT_ZONE).toLocalDate().plusDays(30);

            entity.setClosedPlan(closedPlan);
            entity.setClosedBillingRecurrence(closedBillingRecurrence);
            entity.setFirstMonthlyFeeCents(firstMonthlyFeeCents);
            entity.setClosedAt(closedAt);
            entity.setCommissionCents(calculateCommission(firstMonthlyFeeCents, partner.getDefaultCommissionBps()));
            entity.setCommissionStatus(commissionStatus);
            entity.setCommissionDueDate(commissionDueDate);
            entity.setCommissionPaidAt(COMMISSION_STATUS_PAID.equals(commissionStatus)
                    ? (command.commissionPaidAt() != null ? command.commissionPaidAt() : Instant.now())
                    : null);
        } else {
            entity.setClosedPlan(null);
            entity.setClosedBillingRecurrence(null);
            entity.setFirstMonthlyFeeCents(null);
            entity.setClosedAt(null);
            entity.setCommissionCents(null);
            entity.setCommissionStatus(null);
            entity.setCommissionDueDate(null);
            entity.setCommissionPaidAt(null);
        }

        entity.setUpdatedAt(Instant.now());
        leads.save(entity);
        JpaPartnerProgramPartnerEntity partner = partners.findById(entity.getPartnerId()).orElse(null);
        return toLeadRow(entity, partner);
    }

    @Transactional(readOnly = true)
    public PublicPartnerResponse getPublicPartner(String referenceCode) {
        JpaPartnerProgramPartnerEntity partner = findActivePartnerByReference(referenceCode);
        return new PublicPartnerResponse(
                partner.getReferenceCode(),
                normalizeText(partner.getPartnerName()),
                normalizeText(partner.getCompanyName())
        );
    }

    @Transactional
    public PublicLeadCaptureResponse capturePublicLead(String referenceCode, CapturePublicLeadCommand command) {
        JpaPartnerProgramPartnerEntity partner = findActivePartnerByReference(referenceCode);
        Instant now = Instant.now();
        JpaPartnerProgramLeadEntity entity = new JpaPartnerProgramLeadEntity();
        entity.setId(UUID.randomUUID());
        entity.setPartnerId(partner.getId());
        entity.setShopkeeperName(requireText(command.shopkeeperName(), "Informe o nome do lojista."));
        entity.setStoreName(requireText(command.storeName(), "Informe o nome da loja."));
        entity.setWhatsapp(normalizePhone(command.whatsapp(), true));
        entity.setEmail(normalizeNullable(command.email(), 180));
        entity.setCity(normalizeNullable(command.city(), 120));
        entity.setState(normalizeState(command.state()));
        entity.setApproximateStock(normalizeStock(command.approximateStock()));
        entity.setLeadStatus(LEAD_STATUS_NEW);
        entity.setSalesOwner(null);
        entity.setNotes(null);
        entity.setClosedPlan(null);
        entity.setClosedBillingRecurrence(null);
        entity.setFirstMonthlyFeeCents(null);
        entity.setClosedAt(null);
        entity.setCommissionCents(null);
        entity.setCommissionStatus(null);
        entity.setCommissionDueDate(null);
        entity.setCommissionPaidAt(null);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        leads.save(entity);
        return new PublicLeadCaptureResponse(entity.getId(), "Lead recebido com sucesso.");
    }

    private Map<UUID, List<JpaPartnerProgramLeadEntity>> groupLeadsByPartner(List<JpaPartnerProgramLeadEntity> leadEntities) {
        Map<UUID, List<JpaPartnerProgramLeadEntity>> grouped = new LinkedHashMap<>();
        for (JpaPartnerProgramLeadEntity lead : leadEntities) {
            grouped.computeIfAbsent(lead.getPartnerId(), ignored -> new ArrayList<>()).add(lead);
        }
        return grouped;
    }

    private List<MetricPoint> buildMonthlyMetricPoints(List<JpaPartnerProgramLeadEntity> leadEntities, boolean commissionMode) {
        Map<YearMonth, Long> values = lastSixMonths();
        for (JpaPartnerProgramLeadEntity lead : leadEntities) {
            Instant source = commissionMode ? lead.getClosedAt() : lead.getCreatedAt();
            if (source == null) continue;
            if (commissionMode && !isConvertedLead(lead)) continue;
            YearMonth key = YearMonth.from(source.atZone(DEFAULT_ZONE));
            if (!values.containsKey(key)) continue;
            long increment = commissionMode ? commissionGeneratedForLead(lead) : 1L;
            values.put(key, values.get(key) + increment);
        }
        return values.entrySet().stream().map(entry -> new MetricPoint(entry.getKey().format(MONTH_LABEL), entry.getValue())).toList();
    }

    private List<MetricPoint> buildMonthlyConversionPoints(List<JpaPartnerProgramLeadEntity> leadEntities) {
        Map<YearMonth, Long> values = lastSixMonths();
        for (JpaPartnerProgramLeadEntity lead : leadEntities) {
            if (!isConvertedLead(lead) || lead.getClosedAt() == null) continue;
            YearMonth key = YearMonth.from(lead.getClosedAt().atZone(DEFAULT_ZONE));
            if (!values.containsKey(key)) continue;
            values.put(key, values.get(key) + 1L);
        }
        return values.entrySet().stream().map(entry -> new MetricPoint(entry.getKey().format(MONTH_LABEL), entry.getValue())).toList();
    }

    private Map<YearMonth, Long> lastSixMonths() {
        Map<YearMonth, Long> values = new LinkedHashMap<>();
        YearMonth current = YearMonth.now(DEFAULT_ZONE);
        for (int index = 5; index >= 0; index--) {
            values.put(current.minusMonths(index), 0L);
        }
        return values;
    }

    private PartnerRow toPartnerRow(JpaPartnerProgramPartnerEntity partner, List<JpaPartnerProgramLeadEntity> partnerLeads) {
        long leadsSent = partnerLeads.size();
        long salesClosed = partnerLeads.stream().filter(this::isConvertedLead).count();
        long revenueGenerated = partnerLeads.stream().mapToLong(this::revenueForLead).sum();
        long commissionGenerated = partnerLeads.stream().mapToLong(this::commissionGeneratedForLead).sum();
        long commissionPaid = partnerLeads.stream().mapToLong(this::commissionPaidForLead).sum();
        long commissionPending = partnerLeads.stream().mapToLong(this::commissionPendingForLead).sum();
        return new PartnerRow(
                partner.getId(),
                normalizeText(partner.getPartnerName()),
                normalizeText(partner.getCompanyName()),
                normalizeText(partner.getWhatsapp()),
                normalizeText(partner.getEmail()),
                normalizeText(partner.getCity()),
                normalizeText(partner.getState()),
                normalizeText(partner.getPartnerType()),
                partner.getDefaultCommissionBps(),
                normalizeText(partner.getStatus()),
                normalizeText(partner.getReferenceCode()),
                (int) leadsSent,
                (int) salesClosed,
                percentage(salesClosed, leadsSent),
                revenueGenerated,
                commissionGenerated,
                commissionPaid,
                commissionPending,
                partner.getCreatedAt(),
                partner.getUpdatedAt()
        );
    }

    private LeadRow toLeadRow(JpaPartnerProgramLeadEntity lead, JpaPartnerProgramPartnerEntity partner) {
        return new LeadRow(
                lead.getId(),
                lead.getPartnerId(),
                partner == null ? "-" : normalizeText(partner.getPartnerName()),
                partner == null ? "-" : normalizeText(partner.getReferenceCode()),
                normalizeText(lead.getShopkeeperName()),
                normalizeText(lead.getStoreName()),
                normalizeText(lead.getWhatsapp()),
                normalizeText(lead.getEmail()),
                normalizeText(lead.getCity()),
                normalizeText(lead.getState()),
                lead.getApproximateStock(),
                normalizeText(lead.getLeadStatus()),
                normalizeText(lead.getSalesOwner()),
                normalizeText(lead.getNotes()),
                normalizeText(lead.getClosedPlan()),
                normalizeText(lead.getClosedBillingRecurrence()),
                lead.getFirstMonthlyFeeCents(),
                lead.getClosedAt(),
                lead.getCommissionCents(),
                normalizeText(lead.getCommissionStatus()),
                lead.getCommissionDueDate(),
                lead.getCommissionPaidAt(),
                lead.getCreatedAt(),
                lead.getUpdatedAt()
        );
    }

    private JpaPartnerProgramPartnerEntity findPartner(UUID partnerId) {
        return partners.findById(partnerId)
                .orElseThrow(() -> new BusinessException("PARTNER_NOT_FOUND", "Parceiro nao encontrado."));
    }

    private JpaPartnerProgramPartnerEntity findActivePartnerByReference(String referenceCode) {
        JpaPartnerProgramPartnerEntity partner = partners.findByReferenceCodeIgnoreCase(normalizeReference(referenceCode))
                .orElseThrow(() -> new BusinessException("PARTNER_NOT_FOUND", "Parceiro nao encontrado."));
        if (!STATUS_ACTIVE.equals(partner.getStatus())) {
            throw new BusinessException("PARTNER_INACTIVE", "Parceiro inativo no momento.");
        }
        return partner;
    }

    private long revenueForLead(JpaPartnerProgramLeadEntity lead) {
        return isConvertedLead(lead) && lead.getFirstMonthlyFeeCents() != null ? lead.getFirstMonthlyFeeCents() : 0L;
    }

    private long commissionGeneratedForLead(JpaPartnerProgramLeadEntity lead) {
        if (!isConvertedLead(lead)) return 0L;
        if (COMMISSION_STATUS_CANCELED.equals(normalizeText(lead.getCommissionStatus()))) return 0L;
        return lead.getCommissionCents() == null ? 0L : lead.getCommissionCents();
    }

    private long commissionPaidForLead(JpaPartnerProgramLeadEntity lead) {
        return COMMISSION_STATUS_PAID.equals(normalizeText(lead.getCommissionStatus())) && lead.getCommissionCents() != null
                ? lead.getCommissionCents()
                : 0L;
    }

    private long commissionPendingForLead(JpaPartnerProgramLeadEntity lead) {
        return COMMISSION_STATUS_PENDING.equals(normalizeText(lead.getCommissionStatus())) && lead.getCommissionCents() != null
                ? lead.getCommissionCents()
                : 0L;
    }

    private boolean isConvertedLead(JpaPartnerProgramLeadEntity lead) {
        return LEAD_STATUS_CONVERTED.equals(normalizeText(lead.getLeadStatus()));
    }

    private double percentage(long numerator, long denominator) {
        if (denominator <= 0) return 0D;
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private long calculateCommission(Long firstMonthlyFeeCents, Integer commissionBps) {
        return BigDecimal.valueOf(firstMonthlyFeeCents)
                .multiply(BigDecimal.valueOf(commissionBps == null ? DEFAULT_COMMISSION_BPS : commissionBps))
                .divide(BigDecimal.valueOf(10000), 0, RoundingMode.HALF_UP)
                .longValue();
    }

    private String generateReferenceCode(String partnerName, String companyName) {
        String seed = slugify(partnerName + "-" + companyName).replace("-", "");
        if (seed.isBlank()) {
            seed = "parceiro";
        }
        String base = seed.length() > 8 ? seed.substring(0, 8) : seed;
        String candidate = base.length() < 4 ? base + randomSuffix().substring(0, 4 - base.length()) : base;
        while (partners.existsByReferenceCodeIgnoreCase(candidate)) {
            candidate = base.substring(0, Math.min(base.length(), 6)) + randomSuffix().substring(0, 4);
        }
        return candidate.toLowerCase(Locale.ROOT);
    }

    private String randomSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    }

    private String slugify(String raw) {
        String normalized = Normalizer.normalize(Objects.toString(raw, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private String requireText(String raw, String message) {
        String normalized = normalizeNullable(raw, 160);
        if (normalized == null || normalized.isBlank()) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", message);
        }
        return normalized;
    }

    private Long requireMoney(Long value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", message);
        }
        return value;
    }

    private Instant requireInstant(Instant value, String message) {
        if (value == null) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", message);
        }
        return value;
    }

    private String normalizeNullable(String raw, int maxLength) {
        String value = raw == null ? null : raw.trim();
        if (value == null || value.isBlank()) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    private String normalizeLongText(String raw) {
        String value = raw == null ? null : raw.trim();
        return value == null || value.isBlank() ? null : value;
    }

    private String normalizeText(String raw) {
        return raw == null || raw.isBlank() ? "-" : raw;
    }

    private String normalizePhone(String raw, boolean required) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.isBlank()) {
            if (required) {
                throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Informe um WhatsApp valido.");
            }
            return null;
        }
        if (digits.length() < 10) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Informe um WhatsApp valido.");
        }
        return digits.length() > 30 ? digits.substring(0, 30) : digits;
    }

    private String normalizeState(String raw) {
        String state = normalizeNullable(raw, 2);
        return state == null ? null : state.toUpperCase(Locale.ROOT);
    }

    private Integer normalizeCommissionBps(Integer value) {
        int resolved = value == null || value <= 0 ? DEFAULT_COMMISSION_BPS : value;
        if (resolved > 10000) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "A comissao padrao nao pode ser maior que 100%.");
        }
        return resolved;
    }

    private Integer normalizeStock(Integer value) {
        if (value == null) return null;
        if (value < 0) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "O estoque aproximado nao pode ser negativo.");
        }
        return Math.min(value, 99999);
    }

    private String normalizeReference(String referenceCode) {
        String value = normalizeNullable(referenceCode, 40);
        if (value == null || value.isBlank()) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Informe a referencia do parceiro.");
        }
        return value;
    }

    private String normalizePartnerStatus(String raw) {
        String value = normalizeNullable(raw, 20);
        if (value == null) return STATUS_ACTIVE;
        String normalized = value.toUpperCase(Locale.ROOT);
        if (!STATUS_ACTIVE.equals(normalized) && !STATUS_INACTIVE.equals(normalized)) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Status de parceiro invalido.");
        }
        return normalized;
    }

    private String normalizeLeadStatus(String raw) {
        String value = normalizeNullable(raw, 30);
        if (value == null) return LEAD_STATUS_NEW;
        String normalized = value.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case LEAD_STATUS_NEW, LEAD_STATUS_CONTACTED, LEAD_STATUS_QUALIFIED, LEAD_STATUS_CONVERTED, LEAD_STATUS_LOST -> normalized;
            default -> throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Status de lead invalido.");
        };
    }

    private String normalizeCommissionStatus(String raw) {
        String value = normalizeNullable(raw, 30);
        if (value == null) return COMMISSION_STATUS_PENDING;
        String normalized = value.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case COMMISSION_STATUS_PENDING, COMMISSION_STATUS_PAID, COMMISSION_STATUS_CANCELED -> normalized;
            default -> throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Status de comissao invalido.");
        };
    }

    private String normalizeBillingRecurrence(String raw) {
        String value = normalizeNullable(raw, 20);
        if (value == null) {
            throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Informe a recorrencia do pagamento.");
        }
        String normalized = value.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case BILLING_RECURRENCE_MONTHLY, "MONTH" -> BILLING_RECURRENCE_MONTHLY;
            case BILLING_RECURRENCE_ANNUAL, "YEARLY", "YEAR" -> BILLING_RECURRENCE_ANNUAL;
            default -> throw new BusinessException("PARTNER_PROGRAM_VALIDATION", "Recorrencia de pagamento invalida.");
        };
    }

    private String resolveEffectiveLeadStatus(UpdateLeadCommand command) {
        String normalizedLeadStatus = normalizeLeadStatus(command.leadStatus());
        boolean hasSalePayload =
                normalizeNullable(command.closedPlan(), 120) != null
                        || normalizeNullable(command.closedBillingRecurrence(), 20) != null
                        || command.firstMonthlyFeeCents() != null
                        || command.closedAt() != null
                        || normalizeNullable(command.commissionStatus(), 30) != null
                        || command.commissionDueDate() != null
                        || command.commissionPaidAt() != null;

        return hasSalePayload ? LEAD_STATUS_CONVERTED : normalizedLeadStatus;
    }

    public record SavePartnerCommand(
            String partnerName,
            String companyName,
            String whatsapp,
            String email,
            String city,
            String state,
            String partnerType,
            Integer defaultCommissionBps,
            String status
    ) {
    }

    public record UpdateLeadCommand(
            String leadStatus,
            String salesOwner,
            String notes,
            String closedPlan,
            String closedBillingRecurrence,
            Long firstMonthlyFeeCents,
            Instant closedAt,
            String commissionStatus,
            LocalDate commissionDueDate,
            Instant commissionPaidAt
    ) {
    }

    public record CapturePublicLeadCommand(
            String shopkeeperName,
            String storeName,
            String whatsapp,
            String email,
            String city,
            String state,
            Integer approximateStock
    ) {
    }

    public record DashboardResponse(
            DashboardSummary summary,
            List<PartnerRow> partners,
            List<LeadRow> leads,
            Charts charts
    ) {
    }

    public record DashboardSummary(
            int activePartners,
            int leadsGenerated,
            int leadsConverted,
            double conversionRate,
            long revenueGeneratedCents,
            long commissionTotalCents,
            long commissionPaidCents,
            long commissionPendingCents
    ) {
    }

    public record Charts(
            List<MetricPoint> leadsByPartner,
            List<MetricPoint> conversionsByPartner,
            List<MetricPoint> commissionByMonth,
            List<MetricPoint> revenueByPartner,
            List<DecimalMetricPoint> conversionRateByPartner,
            List<MetricPoint> leadsOverTime,
            List<MetricPoint> rankingByRevenue
    ) {
    }

    public record PartnerRow(
            UUID partnerId,
            String partnerName,
            String companyName,
            String whatsapp,
            String email,
            String city,
            String state,
            String partnerType,
            Integer defaultCommissionBps,
            String status,
            String referenceCode,
            int leadsSent,
            int salesClosed,
            double conversionRate,
            long revenueGeneratedCents,
            long commissionGeneratedCents,
            long commissionPaidCents,
            long commissionPendingCents,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record LeadRow(
            UUID leadId,
            UUID partnerId,
            String partnerName,
            String partnerReferenceCode,
            String shopkeeperName,
            String storeName,
            String whatsapp,
            String email,
            String city,
            String state,
            Integer approximateStock,
            String leadStatus,
            String salesOwner,
            String notes,
            String closedPlan,
            String closedBillingRecurrence,
            Long firstMonthlyFeeCents,
            Instant closedAt,
            Long commissionCents,
            String commissionStatus,
            LocalDate commissionDueDate,
            Instant commissionPaidAt,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record PartnerDetailResponse(
            PartnerRow partner,
            List<LeadRow> leads,
            List<CommissionRow> commissions,
            PartnerDetailCharts charts
    ) {
    }

    public record CommissionRow(
            UUID leadId,
            String closedClient,
            String closedPlan,
            String closedBillingRecurrence,
            Long firstMonthlyFeeCents,
            Long commissionCents,
            String status,
            LocalDate commissionDueDate,
            Instant closedAt
    ) {
    }

    public record PartnerDetailCharts(
            List<MetricPoint> leadsByMonth,
            List<MetricPoint> conversionsByMonth,
            List<MetricPoint> commissionByMonth
    ) {
    }

    public record MetricPoint(
            String label,
            long value
    ) {
    }

    public record DecimalMetricPoint(
            String label,
            double value
    ) {
    }

    public record PublicPartnerResponse(
            String referenceCode,
            String partnerName,
            String companyName
    ) {
    }

    public record PublicLeadCaptureResponse(
            UUID leadId,
            String message
    ) {
    }
}
