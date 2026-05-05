package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxRateLimitException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OlxStatusSyncJob {

    private static final Logger log = LoggerFactory.getLogger(OlxStatusSyncJob.class);

    private final OlxAdService adService;

    public OlxStatusSyncJob(OlxAdService adService) {
        this.adService = adService;
    }

    @Scheduled(
            fixedDelayString = "${olx.sync.fixed-delay-ms:300000}",
            initialDelayString = "${olx.sync.initial-delay-ms:120000}"
    )
    public void syncPendingStatuses() {
        try {
            adService.syncPendingAdsBatch(10);
        } catch (OlxRateLimitException exception) {
            log.warn("OLX status sync hit rate limit: {}", exception.getMessage());
        } catch (Exception exception) {
            log.warn("OLX status sync failed", exception);
        }
    }
}
