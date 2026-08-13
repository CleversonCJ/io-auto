package com.io.appioweb.application.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehiclePublicationRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAdRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.OlxAdRepositoryJpa;
import com.io.appioweb.application.ioauto.meli.MeliAdService;
import com.io.appioweb.application.ioauto.olx.OlxAdService;
import com.io.appioweb.application.ioauto.webmotors.WebmotorsAdsService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class VehicleAutoPublicationServiceTest {

    @Test
    void enqueueSynchronizeDelegatesUniqueProvidersWithoutBlockingCaller() {
        Fixture fixture = new Fixture(mock(Executor.class));
        ArgumentCaptor<Runnable> tasks = ArgumentCaptor.forClass(Runnable.class);

        fixture.service.enqueueSynchronize(
                fixture.companyId,
                fixture.vehicleId,
                List.of("mercado-livre", "mercadolivre", "olx", "web-motors")
        );

        verify(fixture.executor, times(3)).execute(tasks.capture());
        verifyNoInteractions(fixture.meliAdService, fixture.olxAdService, fixture.webmotorsAdsService);

        JpaMeliAdEntity meliAd = new JpaMeliAdEntity();
        meliAd.setMeliItemId("MLB123");
        when(fixture.meliAds.findByCompanyIdAndVehicleId(fixture.companyId, fixture.vehicleId))
                .thenReturn(Optional.of(meliAd));
        when(fixture.olxAds.findByCompanyIdAndVehicleId(fixture.companyId, fixture.vehicleId))
                .thenReturn(Optional.empty());

        tasks.getAllValues().forEach(Runnable::run);

        verify(fixture.meliAdService).updateVehicleAd(fixture.companyId, fixture.vehicleId);
        verify(fixture.meliAdService, never()).publishVehicle(fixture.companyId, fixture.vehicleId);
        verify(fixture.olxAdService).publishVehicle(fixture.companyId, fixture.vehicleId);
        verify(fixture.webmotorsAdsService).enqueuePublish(fixture.companyId, fixture.vehicleId, "default");
    }

    @Test
    void synchronizePublishesNewMeliAdAndUpdatesExistingOlxAd() {
        Fixture fixture = new Fixture(Runnable::run);
        when(fixture.meliAds.findByCompanyIdAndVehicleId(fixture.companyId, fixture.vehicleId))
                .thenReturn(Optional.empty());
        when(fixture.olxAds.findByCompanyIdAndVehicleId(fixture.companyId, fixture.vehicleId))
                .thenReturn(Optional.of(new JpaOlxAdEntity()));

        fixture.service.enqueueSynchronize(
                fixture.companyId,
                fixture.vehicleId,
                List.of("mercadolivre", "olx")
        );

        verify(fixture.meliAdService).publishVehicle(fixture.companyId, fixture.vehicleId);
        verify(fixture.meliAdService, never()).updateVehicleAd(fixture.companyId, fixture.vehicleId);
        verify(fixture.olxAdService).updateVehicleAd(fixture.companyId, fixture.vehicleId);
        verify(fixture.olxAdService, never()).publishVehicle(fixture.companyId, fixture.vehicleId);
    }

    private static final class Fixture {
        private final UUID companyId = UUID.randomUUID();
        private final UUID vehicleId = UUID.randomUUID();
        private final IoAutoVehiclePublicationRepositoryJpa publications = mock(IoAutoVehiclePublicationRepositoryJpa.class);
        private final MeliAdRepositoryJpa meliAds = mock(MeliAdRepositoryJpa.class);
        private final OlxAdRepositoryJpa olxAds = mock(OlxAdRepositoryJpa.class);
        private final MeliAdService meliAdService = mock(MeliAdService.class);
        private final OlxAdService olxAdService = mock(OlxAdService.class);
        private final WebmotorsAdsService webmotorsAdsService = mock(WebmotorsAdsService.class);
        private final Executor executor;
        private final VehicleAutoPublicationService service;

        private Fixture(Executor executor) {
            this.executor = executor;
            this.service = new VehicleAutoPublicationService(
                    publications,
                    meliAds,
                    olxAds,
                    meliAdService,
                    olxAdService,
                    webmotorsAdsService,
                    executor,
                    mock(PlatformTransactionManager.class)
            );
        }
    }
}
