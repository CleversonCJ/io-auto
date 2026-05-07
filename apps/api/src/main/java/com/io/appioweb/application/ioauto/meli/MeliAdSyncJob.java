package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliRateLimitException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MeliAdSyncJob {

    private static final Logger log = LoggerFactory.getLogger(MeliAdSyncJob.class);

    private final MeliAdService adService;

    public MeliAdSyncJob(MeliAdService adService) {
        this.adService = adService;
    }

    @Scheduled(
            fixedDelayString = "${meli.sync.fixed-delay-ms:300000}",
            initialDelayString = "${meli.sync.initial-delay-ms:180000}"
    )
    public void syncTrackedAds() {
        try {
            adService.syncActiveAdsBatch(10);
        } catch (MeliRateLimitException exception) {
            log.warn("Mercado Livre sync hit rate limit: {}", exception.getMessage());
        } catch (Exception exception) {
            log.warn("Mercado Livre sync failed", exception);
        }
    }
}
