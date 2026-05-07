package com.io.appioweb.adapters.web.integrations.mercadolivre;

import com.io.appioweb.application.ioauto.meli.MeliWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MercadoLivreWebhookController {

    private final MeliWebhookService webhookService;

    public MercadoLivreWebhookController(MeliWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/api/webhooks/mercadolivre")
    public ResponseEntity<Void> handleWebhook(
            @RequestBody(required = false) String payload,
            @RequestHeader(name = "X-Webhook-Secret", required = false) String secretHeader,
            @RequestParam(name = "secret", required = false) String secretQuery
    ) {
        webhookService.registerWebhook(payload, secretHeader == null || secretHeader.isBlank() ? secretQuery : secretHeader);
        return ResponseEntity.ok().build();
    }
}
