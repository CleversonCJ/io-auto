package com.io.appioweb.application.ioauto.meli;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MeliVehicleAdMapperTest {

    @Test
    void buildCreatePayloadIncludesClassifiedVehicleFields() {
        MeliVehicleAdMapper mapper = new MeliVehicleAdMapper();
        JpaIoAutoVehicleEntity vehicle = baseVehicle();

        MeliVehicleAdMapper.Payload payload = mapper.buildCreatePayload(
                UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                vehicle,
                new MeliLocationService.LocationSnapshot(
                        "Av. Brasil, 1000",
                        "85600000",
                        "TUxCQk5FQjg5NTZa",
                        "Centro",
                        "TUxBQ0NBUzEyMzQ",
                        "Cascavel",
                        "BR-PR",
                        "Parana",
                        "BR",
                        "Brasil"
                ),
                "MLB1744",
                "gold_special",
                "used",
                "VEHICLE-" + vehicle.getId(),
                "Chevrolet Onix 1.0 LT 2020",
                BigDecimal.valueOf(65_900),
                List.of(
                        attribute("BRAND", true),
                        attribute("MODEL", true),
                        attribute("VEHICLE_YEAR", true),
                        attribute("KILOMETERS", false)
                ),
                List.of(),
                "BRL"
        );

        JsonNode root = payload.payloadNode();

        assertThat(root.path("buying_mode").asText("")).isEqualTo("classified");
        assertThat(root.path("currency_id").asText("")).isEqualTo("BRL");
        assertThat(root.path("available_quantity").asInt()).isEqualTo(1);
        assertThat(root.path("seller_custom_field").asText("")).isEqualTo("VEHICLE-" + vehicle.getId());
        assertThat(root.path("pictures")).hasSize(2);
        assertThat(root.path("location").path("city").path("name").asText("")).isEqualTo("Cascavel");
        assertThat(root.path("attributes")).extracting(node -> node.path("id").asText("")).contains("BRAND", "MODEL", "VEHICLE_YEAR", "KILOMETERS");
    }

    @Test
    void validateRequiredAttributesRejectsMissingCategoryField() {
        MeliVehicleAdMapper mapper = new MeliVehicleAdMapper();
        JpaIoAutoVehicleEntity vehicle = baseVehicle();

        assertThatThrownBy(() -> mapper.buildCreatePayload(
                UUID.randomUUID(),
                vehicle,
                new MeliLocationService.LocationSnapshot(
                        "Av. Brasil, 1000",
                        "85600000",
                        "",
                        "",
                        "TUxBQ0NBUzEyMzQ",
                        "Cascavel",
                        "BR-PR",
                        "Parana",
                        "BR",
                        "Brasil"
                ),
                "MLB1744",
                "gold_special",
                "used",
                "VEHICLE-" + vehicle.getId(),
                "Chevrolet Onix 1.0 LT 2020",
                BigDecimal.valueOf(65_900),
                List.of(
                        attribute("BRAND", true),
                        attribute("MODEL", true),
                        attribute("VEHICLE_YEAR", true),
                        attribute("DOORS", true)
                ),
                List.of(),
                "BRL"
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Faltam atributos obrigatorios");
    }

    private JpaIoAutoVehicleEntity baseVehicle() {
        JpaIoAutoVehicleEntity vehicle = new JpaIoAutoVehicleEntity();
        vehicle.setId(UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        vehicle.setCompanyId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        vehicle.setTitle("Chevrolet Onix 1.0 LT 2020");
        vehicle.setBrand("Chevrolet");
        vehicle.setModel("Onix");
        vehicle.setVersion("1.0 LT");
        vehicle.setModelYear(2020);
        vehicle.setManufactureYear(2020);
        vehicle.setPriceCents(6_590_000L);
        vehicle.setMileage(45_000);
        vehicle.setDescription("Veiculo revisado, com manual e chave reserva.");
        vehicle.setCoverImageUrl("https://cdn.example.test/onix-1.jpg");
        vehicle.setGalleryJson("[\"https://cdn.example.test/onix-2.jpg\"]");
        return vehicle;
    }

    private MeliCategoryService.CategoryAttributeSnapshot attribute(String attributeId, boolean required) {
        return new MeliCategoryService.CategoryAttributeSnapshot(
                attributeId,
                attributeId,
                "string",
                required,
                false,
                List.of(),
                "{}"
        );
    }
}
