package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SupportTicketService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    public SupportTicketController(SupportTicketService supportTicketService) {
        this.supportTicketService = supportTicketService;
    }

    @PostMapping("/api/support/tickets")
    public ResponseEntity<SupportTicketService.TicketDetail> createTicket(@Valid @RequestBody CreateSupportTicketHttpRequest request) {
        SupportTicketService.CreateTicketCommand command = new SupportTicketService.CreateTicketCommand(
                request.title(),
                request.description(),
                request.category(),
                request.urgency(),
                request.bugArea(),
                request.evidenceFileName(),
                request.evidenceContentType(),
                request.evidenceDataUrl(),
                request.guidedAnswers() == null
                        ? List.of()
                        : request.guidedAnswers().stream()
                        .map(item -> new SupportTicketService.GuidedAnswer(item.question(), item.answer()))
                        .toList()
        );
        return ResponseEntity.ok(supportTicketService.createTicket(command));
    }

    @GetMapping("/api/support/tickets/my")
    public ResponseEntity<List<SupportTicketService.TicketSummary>> listMyTickets() {
        return ResponseEntity.ok(supportTicketService.listMyTickets());
    }

    @GetMapping("/api/support/tickets")
    public ResponseEntity<List<SupportTicketService.TicketSummary>> listCompanyTickets() {
        return ResponseEntity.ok(supportTicketService.listCompanyTickets());
    }

    @GetMapping("/api/support/tickets/{ticketId}")
    public ResponseEntity<SupportTicketService.TicketDetail> getCompanyTicket(@PathVariable UUID ticketId) {
        return ResponseEntity.ok(supportTicketService.getCompanyTicket(ticketId));
    }

    public record CreateSupportTicketHttpRequest(
            @NotBlank @Size(max = 220) String title,
            @NotBlank String description,
            @NotBlank String category,
            String urgency,
            @NotBlank @Size(max = 120) String bugArea,
            @NotBlank @Size(max = 255) String evidenceFileName,
            @NotBlank @Size(max = 120) String evidenceContentType,
            @NotBlank String evidenceDataUrl,
            @NotEmpty List<@Valid GuidedAnswerHttpRequest> guidedAnswers
    ) {
    }

    public record GuidedAnswerHttpRequest(
            @NotBlank @Size(max = 220) String question,
            @NotBlank @Size(max = 300) String answer
    ) {
    }
}
