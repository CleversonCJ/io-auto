package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SupportTicketService;
import com.io.appioweb.application.superadmin.SuperAdminFilter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
@PreAuthorize("hasRole('SUPERADMIN')")
public class SuperAdminSupportTicketController {

    private final SupportTicketService supportTicketService;

    public SuperAdminSupportTicketController(SupportTicketService supportTicketService) {
        this.supportTicketService = supportTicketService;
    }

    @GetMapping("/api/superadmin/support/tickets")
    public ResponseEntity<List<SupportTicketService.TicketSummary>> listTickets(
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
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "ticketStatus", required = false) String ticketStatus,
            @RequestParam(name = "ticketCategory", required = false) String ticketCategory
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
        return ResponseEntity.ok(supportTicketService.listSuperAdminTickets(filter, ticketStatus, ticketCategory, search));
    }

    @PatchMapping("/api/superadmin/support/tickets/{id}/status")
    public ResponseEntity<SupportTicketService.TicketDetail> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTicketStatusHttpRequest request
    ) {
        return ResponseEntity.ok(supportTicketService.updateStatus(id, request.status()));
    }

    @PostMapping("/api/superadmin/support/tickets/{id}/messages")
    public ResponseEntity<SupportTicketService.TicketMessage> addMessage(
            @PathVariable UUID id,
            @Valid @RequestBody CreateSupportMessageHttpRequest request
    ) {
        return ResponseEntity.ok(supportTicketService.addSupportMessage(id, request.message()));
    }

    @GetMapping("/api/superadmin/support/tickets/{id}")
    public ResponseEntity<SupportTicketService.TicketDetail> getTicket(@PathVariable UUID id) {
        return ResponseEntity.ok(supportTicketService.getTicket(id));
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return LocalDate.parse(raw.trim());
    }

    public record UpdateTicketStatusHttpRequest(@NotBlank String status) {
    }

    public record CreateSupportMessageHttpRequest(@NotBlank String message) {
    }
}
