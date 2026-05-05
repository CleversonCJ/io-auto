package com.io.appioweb.adapters.web.integrations.olx;

import com.io.appioweb.application.ioauto.olx.OlxWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OlxWebhookController {

    private final OlxWebhookService webhookService;

    public OlxWebhookController(OlxWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/api/webhooks/olx/ad-status")
    @Transactional
    public ResponseEntity<Void> handleAdStatus(
            @RequestBody(required = false) String payload,
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestHeader(name = "X-OLX-Token", required = false) String olxToken,
            @RequestHeader(name = "X-Webhook-Token", required = false) String webhookToken,
            @RequestHeader(name = "token", required = false) String plainTokenHeader,
            @RequestParam(name = "token", required = false) String tokenQuery
    ) {
        webhookService.handleAdStatus(payload, resolveToken(authorization, olxToken, webhookToken, plainTokenHeader, tokenQuery));
        return ResponseEntity.ok().build();
    }

    private String resolveToken(String authorization, String olxToken, String webhookToken, String plainTokenHeader, String tokenQuery) {
        if (authorization != null && authorization.toLowerCase().startsWith("bearer ")) {
            return authorization.substring(7).trim();
        }
        if (olxToken != null && !olxToken.isBlank()) {
            return olxToken.trim();
        }
        if (webhookToken != null && !webhookToken.isBlank()) {
            return webhookToken.trim();
        }
        if (plainTokenHeader != null && !plainTokenHeader.isBlank()) {
            return plainTokenHeader.trim();
        }
        return tokenQuery == null ? "" : tokenQuery.trim();
    }
}
