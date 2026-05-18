package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.PartnerProgramService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@PreAuthorize("hasRole('SUPERADMIN')")
public class SuperAdminPartnerProgramController {

    private final PartnerProgramService partnerProgramService;

    public SuperAdminPartnerProgramController(PartnerProgramService partnerProgramService) {
        this.partnerProgramService = partnerProgramService;
    }

    @GetMapping("/api/superadmin/partners/dashboard")
    public ResponseEntity<PartnerProgramService.DashboardResponse> getDashboard() {
        return ResponseEntity.ok(partnerProgramService.getDashboard());
    }

    @GetMapping("/api/superadmin/partners/{partnerId}")
    public ResponseEntity<PartnerProgramService.PartnerDetailResponse> getPartnerDetail(@PathVariable UUID partnerId) {
        return ResponseEntity.ok(partnerProgramService.getPartnerDetail(partnerId));
    }

    @PostMapping("/api/superadmin/partners")
    public ResponseEntity<PartnerProgramService.PartnerRow> createPartner(
            @Valid @RequestBody SavePartnerHttpRequest request
    ) {
        return ResponseEntity.ok(partnerProgramService.createPartner(toSaveCommand(request)));
    }

    @PutMapping("/api/superadmin/partners/{partnerId}")
    public ResponseEntity<PartnerProgramService.PartnerRow> updatePartner(
            @PathVariable UUID partnerId,
            @Valid @RequestBody SavePartnerHttpRequest request
    ) {
        return ResponseEntity.ok(partnerProgramService.updatePartner(partnerId, toSaveCommand(request)));
    }

    @PatchMapping("/api/superadmin/partners/leads/{leadId}")
    public ResponseEntity<PartnerProgramService.LeadRow> updateLead(
            @PathVariable UUID leadId,
            @Valid @RequestBody UpdatePartnerLeadHttpRequest request
    ) {
        return ResponseEntity.ok(partnerProgramService.updateLead(
                leadId,
                new PartnerProgramService.UpdateLeadCommand(
                        request.leadStatus(),
                        request.salesOwner(),
                        request.notes(),
                        request.closedPlan(),
                        request.firstMonthlyFeeCents(),
                        request.closedAt(),
                        request.commissionStatus(),
                        request.commissionDueDate(),
                        request.commissionPaidAt()
                )
        ));
    }

    private PartnerProgramService.SavePartnerCommand toSaveCommand(SavePartnerHttpRequest request) {
        return new PartnerProgramService.SavePartnerCommand(
                request.partnerName(),
                request.companyName(),
                request.whatsapp(),
                request.email(),
                request.city(),
                request.state(),
                request.partnerType(),
                request.defaultCommissionBps(),
                request.status()
        );
    }

    public record SavePartnerHttpRequest(
            @NotBlank(message = "Informe o nome do parceiro.") String partnerName,
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

    public record UpdatePartnerLeadHttpRequest(
            String leadStatus,
            String salesOwner,
            String notes,
            String closedPlan,
            Long firstMonthlyFeeCents,
            Instant closedAt,
            String commissionStatus,
            LocalDate commissionDueDate,
            Instant commissionPaidAt
    ) {
    }
}
