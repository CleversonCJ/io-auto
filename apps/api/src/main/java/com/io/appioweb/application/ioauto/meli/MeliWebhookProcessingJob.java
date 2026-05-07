package com.io.appioweb.application.ioauto.meli;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MeliWebhookProcessingJob {

    private static final Logger log = LoggerFactory.getLogger(MeliWebhookProcessingJob.class);

    private final MeliWebhookService webhookService;

    public MeliWebhookProcessingJob(MeliWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @Scheduled(
            fixedDelayString = "${meli.webhook.process.fixed-delay-ms:60000}",
            initialDelayString = "${meli.webhook.process.initial-delay-ms:60000}"
    )
    public void processPendingWebhooks() {
        try {
            webhookService.processPendingEventsBatch(20);
        } catch (Exception exception) {
            log.warn("Mercado Livre webhook processing failed", exception);
        }
    }
}
