package com.io.appioweb.application.ioauto.olx;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OlxAdMapperTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void buildInsertPayloadIncludesRequiredFieldsAndUppercasePlate() throws Exception {
        OlxAdMapper mapper = new OlxAdMapper();
        UUID companyId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        JpaIoAutoVehicleEntity vehicle = baseVehicle();
        vehicle.setOlxColorCode("");

        OlxAdMapper.OlxPayload payload = mapper.buildInsertPayload(companyId, vehicle, "token-123", null, "insert");
        JsonNode root = OBJECT_MAPPER.readTree(payload.payloadJson());
        JsonNode ad = root.path("ad_list").get(0);

        assertThat(payload.localAdId()).hasSizeLessThanOrEqualTo(19);
        assertThat(ad.path("category").asInt()).isEqualTo(2020);
        assertThat(ad.path("params").path("vehicle_tag").asText("")).isEqualTo("ABC1D23");
        assertThat(ad.path("params").path("carcolor").isMissingNode()).isTrue();
        assertThat(ad.path("images")).hasSize(2);
    }

    @Test
    void buildInsertPayloadRejectsPrivateImages() {
        OlxAdMapper mapper = new OlxAdMapper();
        JpaIoAutoVehicleEntity vehicle = baseVehicle();
        vehicle.setCoverImageUrl("data:image/png;base64,abc");

        assertThatThrownBy(() -> mapper.buildInsertPayload(UUID.randomUUID(), vehicle, "token-123", null, "insert"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("URLs publicas");
    }

    private JpaIoAutoVehicleEntity baseVehicle() {
        JpaIoAutoVehicleEntity vehicle = new JpaIoAutoVehicleEntity();
        vehicle.setId(UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        vehicle.setCompanyId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        vehicle.setTitle("Honda Civic Touring");
        vehicle.setDescription("Sedan completo, revisado e pronto para uso.");
        vehicle.setPriceCents(129_900_00L);
        vehicle.setMileage(45_000);
        vehicle.setModelYear(2020);
        vehicle.setManufactureYear(2020);
        vehicle.setCoverImageUrl("https://cdn.example.test/civic-1.jpg");
        vehicle.setGalleryJson("[\"https://cdn.example.test/civic-2.jpg\"]");
        vehicle.setContactPhone("(45) 99999-9999");
        vehicle.setZipcode("85600000");
        vehicle.setPlate("abc1d23");
        vehicle.setOlxBrandId("1");
        vehicle.setOlxModelId("2");
        vehicle.setOlxVersionId("3");
        vehicle.setOlxFuelCode("4");
        vehicle.setOlxGearboxCode("5");
        vehicle.setOlxDoorsCode("6");
        vehicle.setOlxColorCode("7");
        vehicle.setOlxFeatureCodesJson("[\"10\",\"11\"]");
        vehicle.setCreatedAt(Instant.parse("2026-05-01T10:00:00Z"));
        vehicle.setUpdatedAt(Instant.parse("2026-05-01T10:00:00Z"));
        return vehicle;
    }
}
