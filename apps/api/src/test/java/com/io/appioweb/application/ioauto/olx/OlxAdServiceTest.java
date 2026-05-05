package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.integrations.olx.OlxApiClient;
import com.io.appioweb.adapters.integrations.olx.OlxResponseParser;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaOlxAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.OlxAdRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OlxAdServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void publishVehicleMapsPermissionErrorIntoFriendlyMessage() throws Exception {
        IoAutoVehicleRepositoryJpa vehicles = mock(IoAutoVehicleRepositoryJpa.class);
        OlxAdRepositoryJpa ads = mock(OlxAdRepositoryJpa.class);
        OlxAccountService accountService = mock(OlxAccountService.class);
        OlxAdMapper mapper = mock(OlxAdMapper.class);
        OlxApiClient apiClient = mock(OlxApiClient.class);
        OlxPublicationStatusService publicationStatusService = mock(OlxPublicationStatusService.class);

        UUID companyId = UUID.randomUUID();
        UUID vehicleId = UUID.randomUUID();
        JpaIoAutoVehicleEntity vehicle = new JpaIoAutoVehicleEntity();
        vehicle.setId(vehicleId);
        vehicle.setCompanyId(companyId);
        vehicle.setCreatedAt(Instant.now());
        vehicle.setUpdatedAt(Instant.now());

        when(vehicles.findByIdAndCompanyId(vehicleId, companyId)).thenReturn(Optional.of(vehicle));
        when(ads.findByCompanyIdAndVehicleId(companyId, vehicleId)).thenReturn(Optional.empty());
        when(ads.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(accountService.requireAccessToken(companyId)).thenReturn("token-123");
        when(mapper.buildInsertPayload(companyId, vehicle, "token-123", null, "insert"))
                .thenReturn(new OlxAdMapper.OlxPayload("caaaaaa_bbbbbbbbbbb", "{\"ok\":true}"));
        when(apiClient.importAds("{\"ok\":true}")).thenReturn(OBJECT_MAPPER.readTree("""
                {"statusCode":-6,"statusMessage":"Without permission"}
                """));
        when(publicationStatusService.sync(any())).thenReturn(new JpaIoAutoVehiclePublicationEntity());

        OlxAdService service = new OlxAdService(
                vehicles,
                ads,
                accountService,
                mapper,
                apiClient,
                new OlxResponseParser(),
                publicationStatusService
        );

        assertThatThrownBy(() -> service.publishVehicle(companyId, vehicleId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("plano profissional empresa");

        ArgumentCaptor<JpaOlxAdEntity> captor = ArgumentCaptor.forClass(JpaOlxAdEntity.class);
        verify(ads).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("ERROR");
    }

    @Test
    void checkImportStatusPersistsAcceptedListingAndPublishedUrl() throws Exception {
        IoAutoVehicleRepositoryJpa vehicles = mock(IoAutoVehicleRepositoryJpa.class);
        OlxAdRepositoryJpa ads = mock(OlxAdRepositoryJpa.class);
        OlxAccountService accountService = mock(OlxAccountService.class);
        OlxAdMapper mapper = mock(OlxAdMapper.class);
        OlxApiClient apiClient = mock(OlxApiClient.class);
        OlxPublicationStatusService publicationStatusService = mock(OlxPublicationStatusService.class);

        UUID companyId = UUID.randomUUID();
        UUID adId = UUID.randomUUID();
        JpaOlxAdEntity ad = new JpaOlxAdEntity();
        ad.setId(adId);
        ad.setCompanyId(companyId);
        ad.setVehicleId(UUID.randomUUID());
        ad.setLocalAdId("caaaaaa_bbbbbbbbbbb");
        ad.setImportToken("import-123");
        ad.setOperation("insert");
        ad.setStatus("IMPORT_PENDING");
        ad.setCreatedAt(Instant.now());
        ad.setUpdatedAt(Instant.now());

        when(ads.findByIdAndCompanyId(adId, companyId)).thenReturn(Optional.of(ad));
        when(ads.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(accountService.requireAccessToken(companyId)).thenReturn("token-123");
        when(apiClient.getImportStatus("import-123", "token-123")).thenReturn(OBJECT_MAPPER.readTree("""
                {
                  "autoupload_status": "queued",
                  "ads": {
                    "caaaaaa_bbbbbbbbbbb": {
                      "status": "accepted",
                      "operation": "insert",
                      "list_id": "9001",
                      "url": "https://www.olx.com.br/ad/9001"
                    }
                  }
                }
                """));
        when(apiClient.getPublishedAd("9001", "token-123")).thenReturn(OBJECT_MAPPER.readTree("""
                {
                  "status": "active",
                  "url": "https://www.olx.com.br/ad/9001",
                  "list_id": "9001",
                  "message": "ok"
                }
                """));
        when(publicationStatusService.sync(any())).thenReturn(new JpaIoAutoVehiclePublicationEntity());

        OlxAdService service = new OlxAdService(
                vehicles,
                ads,
                accountService,
                mapper,
                apiClient,
                new OlxResponseParser(),
                publicationStatusService
        );

        OlxAdService.OlxAdSnapshot snapshot = service.checkImportStatus(companyId, adId);

        assertThat(snapshot.status()).isEqualTo("PUBLISHED");
        assertThat(snapshot.olxListId()).isEqualTo("9001");
        assertThat(snapshot.olxUrl()).isEqualTo("https://www.olx.com.br/ad/9001");
    }
}
