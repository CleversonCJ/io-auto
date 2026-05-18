package com.io.appioweb.adapters.web.superadmin;

import com.io.appioweb.application.superadmin.PartnerProgramService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicPartnerProgramController {

    private final PartnerProgramService partnerProgramService;

    public PublicPartnerProgramController(PartnerProgramService partnerProgramService) {
        this.partnerProgramService = partnerProgramService;
    }

    @GetMapping("/public/partners")
    public ResponseEntity<PartnerProgramService.PublicPartnerResponse> getPartner(
            @RequestParam("ref") String referenceCode
    ) {
        return ResponseEntity.ok(partnerProgramService.getPublicPartner(referenceCode));
    }

    @PostMapping("/public/partners/lead")
    public ResponseEntity<PartnerProgramService.PublicLeadCaptureResponse> captureLead(
            @RequestParam("ref") String referenceCode,
            @Valid @RequestBody CapturePartnerLeadHttpRequest request
    ) {
        return ResponseEntity.ok(partnerProgramService.capturePublicLead(
                referenceCode,
                new PartnerProgramService.CapturePublicLeadCommand(
                        request.shopkeeperName(),
                        request.storeName(),
                        request.whatsapp(),
                        request.email(),
                        request.city(),
                        request.state(),
                        request.approximateStock()
                )
        ));
    }

    public record CapturePartnerLeadHttpRequest(
            @NotBlank(message = "Informe o nome do lojista.") String shopkeeperName,
            @NotBlank(message = "Informe o nome da loja.") String storeName,
            @NotBlank(message = "Informe o WhatsApp.") String whatsapp,
            String email,
            String city,
            String state,
            Integer approximateStock
    ) {
    }
}
