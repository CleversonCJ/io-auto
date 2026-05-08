package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.integrations.mercadolivre.MeliApiClient;
import com.io.appioweb.adapters.integrations.mercadolivre.MeliUnexpectedException;
import com.io.appioweb.adapters.persistence.ioauto.IoAutoVehicleRepositoryJpa;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehiclePublicationEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAccountEntity;
import com.io.appioweb.adapters.persistence.ioauto.JpaMeliAdEntity;
import com.io.appioweb.adapters.persistence.ioauto.MeliAdRepositoryJpa;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeliAdServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void publishVehiclePersistsCreatedAdWhenDescriptionUpdateFails() {
        IoAutoVehicleRepositoryJpa vehicles = mock(IoAutoVehicleRepositoryJpa.class);
        MeliAdRepositoryJpa ads = mock(MeliAdRepositoryJpa.class);
        MeliAccountService accountService = mock(MeliAccountService.class);
        MeliCategoryService categoryService = mock(MeliCategoryService.class);
        MeliListingTypeService listingTypeService = mock(MeliListingTypeService.class);
        MeliLocationService locationService = mock(MeliLocationService.class);
        MeliVehicleAdMapper mapper = mock(MeliVehicleAdMapper.class);
        MeliApiClient apiClient = mock(MeliApiClient.class);
        MeliPublicationStatusService publicationStatusService = mock(MeliPublicationStatusService.class);

        UUID companyId = UUID.randomUUID();
        UUID vehicleId = UUID.randomUUID();

        JpaIoAutoVehicleEntity vehicle = new JpaIoAutoVehicleEntity();
        vehicle.setId(vehicleId);
        vehicle.setCompanyId(companyId);
        vehicle.setTitle("Chevrolet Onix LT Turbo");
        vehicle.setBrand("Chevrolet");
        vehicle.setModel("Onix");
        vehicle.setVersion("LT 1.0 Turbo");
        vehicle.setModelYear(2023);
        vehicle.setManufactureYear(2023);
        vehicle.setPriceCents(7_599_000L);
        vehicle.setMileage(18_500);
        vehicle.setDescription("Descricao de teste");
        vehicle.setCoverImageUrl("https://picsum.photos/seed/teste-1/1200/900");
        vehicle.setGalleryJson("[\"https://picsum.photos/seed/teste-2/1200/900\"]");
        vehicle.setMeliCategoryId("MLB1744");
        vehicle.setMeliListingTypeId("gold_premium");
        vehicle.setCreatedAt(Instant.now());
        vehicle.setUpdatedAt(Instant.now());

        JpaMeliAccountEntity account = new JpaMeliAccountEntity();
        account.setId(UUID.randomUUID());
        account.setCompanyId(companyId);
        account.setMeliUserId(123456L);
        account.setSiteId("MLB");
        account.setActive(true);
        account.setUpdatedAt(Instant.now());

        ObjectNode createBody = OBJECT_MAPPER.createObjectNode();
        createBody.put("id", "MLB123456789");
        createBody.put("status", "active");
        createBody.put("title", "Chevrolet Onix LT Turbo");
        createBody.put("category_id", "MLB1744");
        createBody.put("listing_type_id", "gold_premium");
        createBody.put("currency_id", "BRL");
        createBody.put("price", 75990);
        createBody.put("permalink", "https://www.mercadolivre.com.br/MLB123456789");

        ObjectNode payloadNode = OBJECT_MAPPER.createObjectNode();
        payloadNode.put("title", "Chevrolet Onix LT Turbo");

        when(vehicles.findByIdAndCompanyId(vehicleId, companyId)).thenReturn(Optional.of(vehicle));
        when(ads.findByCompanyIdAndVehicleId(companyId, vehicleId)).thenReturn(Optional.empty());
        when(ads.save(any(JpaMeliAdEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(accountService.requireActiveAccount(companyId)).thenReturn(account);
        when(listingTypeService.getAvailableListingTypes(companyId, "MLB1744"))
                .thenReturn(List.of(new MeliListingTypeService.ListingTypeSnapshot("gold_premium", "Gold Premium", "MLB", null)));
        when(categoryService.listAttributes("MLB1744")).thenReturn(List.of());
        when(locationService.resolveListingLocation(eq(companyId), eq(account), eq(vehicle)))
                .thenReturn(new MeliLocationService.LocationSnapshot(
                        "Av. Paulista, 1000",
                        "01311000",
                        "",
                        "",
                        "TUxBQ1NQYW5QbA",
                        "Sao Paulo",
                        "BR-SP",
                        "Sao Paulo",
                        "BR",
                        "Brasil"
                ));
        when(mapper.buildCreatePayload(
                eq(companyId),
                eq(vehicle),
                any(MeliLocationService.LocationSnapshot.class),
                eq("MLB1744"),
                eq("gold_premium"),
                eq("used"),
                eq("VEHICLE-" + vehicleId),
                eq("Chevrolet Onix LT Turbo"),
                eq(BigDecimal.valueOf(75990).setScale(2)),
                any(),
                any(),
                eq("BRL")
        )).thenReturn(new MeliVehicleAdMapper.Payload(List.of(), payloadNode.toString(), payloadNode));
        when(apiClient.post("/items", companyId, payloadNode))
                .thenReturn(new MeliApiClient.JsonResponse(createBody, createBody.toString(), 201));
        when(apiClient.put("/items/MLB123456789/description", companyId, java.util.Map.of("plain_text", "Descricao de teste")))
                .thenThrow(new MeliUnexpectedException("MELI_UNEXPECTED_ERROR", "forbidden", 403, "forbidden"));
        when(publicationStatusService.sync(any())).thenReturn(new JpaIoAutoVehiclePublicationEntity());

        MeliAdService service = new MeliAdService(
                vehicles,
                ads,
                accountService,
                categoryService,
                listingTypeService,
                locationService,
                mapper,
                apiClient,
                publicationStatusService
        );

        MeliAdService.MeliAdSnapshot snapshot = service.publishVehicle(companyId, vehicleId);

        assertThat(snapshot.meliItemId()).isEqualTo("MLB123456789");
        assertThat(snapshot.status()).isEqualTo("active");

        ArgumentCaptor<JpaMeliAdEntity> captor = ArgumentCaptor.forClass(JpaMeliAdEntity.class);
        verify(ads, atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues())
                .anySatisfy(ad -> {
                    assertThat(ad.getMeliItemId()).isEqualTo("MLB123456789");
                    assertThat(ad.getStatus()).isEqualTo("active");
                });
    }
}
