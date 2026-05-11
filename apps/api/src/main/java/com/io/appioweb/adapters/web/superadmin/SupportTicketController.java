package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.SupportTicketService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    public record CreateSupportTicketHttpRequest(
            @NotBlank @Size(max = 220) String title,
            @NotBlank String description,
            String category,
            String urgency,
            @Size(max = 120) String bugArea,
            List<GuidedAnswerHttpRequest> guidedAnswers
    ) {
    }

    public record GuidedAnswerHttpRequest(
            @Size(max = 220) String question,
            @Size(max = 300) String answer
    ) {
    }
}
