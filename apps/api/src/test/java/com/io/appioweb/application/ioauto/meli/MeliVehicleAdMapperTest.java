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
        vehicle.setFuelType("Flex");
        vehicle.setTransmission("Automatico");
        vehicle.setColor("Prata");

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
                        attribute("KILOMETERS", false),
                        listAttribute("FUEL_TYPE", false,
                                allowed("372591", "Gasolina e álcool"),
                                allowed("64364", "Gasolina")
                        ),
                        listAttribute("TRANSMISSION", false,
                                allowed("370876", "Automática"),
                                allowed("370877", "Manual")
                        ),
                        listAttribute("COLOR", false,
                                allowed("52053", "Prateado"),
                                allowed("52055", "Branco")
                        )
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
        JsonNode fuelType = findAttribute(root, "FUEL_TYPE");
        JsonNode transmission = findAttribute(root, "TRANSMISSION");
        JsonNode color = findAttribute(root, "COLOR");
        assertThat(fuelType.path("value_id").asText("")).isEqualTo("372591");
        assertThat(fuelType.path("value_name").asText("")).isEqualTo("Gasolina e álcool");
        assertThat(transmission.path("value_id").asText("")).isEqualTo("370876");
        assertThat(transmission.path("value_name").asText("")).isEqualTo("Automática");
        assertThat(color.path("value_id").asText("")).isEqualTo("52053");
        assertThat(color.path("value_name").asText("")).isEqualTo("Prateado");
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

    @Test
    void buildCreatePayloadUsesFallbackCatalogIdsWhenAllowedValuesAreMissing() {
        MeliVehicleAdMapper mapper = new MeliVehicleAdMapper();
        JpaIoAutoVehicleEntity vehicle = baseVehicle();
        vehicle.setFuelType("Flex");
        vehicle.setTransmission("Automatico");

        MeliVehicleAdMapper.Payload payload = mapper.buildCreatePayload(
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
                vehicle.getTitle(),
                BigDecimal.valueOf(65_900),
                List.of(
                        attribute("BRAND", true),
                        attribute("MODEL", true),
                        attribute("VEHICLE_YEAR", true),
                        listAttribute("FUEL_TYPE", true),
                        listAttribute("TRANSMISSION", false)
                ),
                List.of(),
                "BRL"
        );

        JsonNode fuelType = findAttribute(payload.payloadNode(), "FUEL_TYPE");
        JsonNode transmission = findAttribute(payload.payloadNode(), "TRANSMISSION");
        assertThat(fuelType.path("value_id").asText("")).isEqualTo("372591");
        assertThat(transmission.path("value_id").asText("")).isEqualTo("370876");
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

    private MeliCategoryService.CategoryAttributeSnapshot listAttribute(
            String attributeId,
            boolean required,
            MeliCategoryService.AllowedValueSnapshot... values
    ) {
        return new MeliCategoryService.CategoryAttributeSnapshot(
                attributeId,
                attributeId,
                "list",
                required,
                false,
                List.of(values),
                "{}"
        );
    }

    private MeliCategoryService.AllowedValueSnapshot allowed(String id, String name) {
        return new MeliCategoryService.AllowedValueSnapshot(id, name);
    }

    private JsonNode findAttribute(JsonNode root, String attributeId) {
        for (JsonNode node : root.path("attributes")) {
            if (attributeId.equals(node.path("id").asText(""))) {
                return node;
            }
        }
        throw new AssertionError("Atributo nao encontrado no payload: " + attributeId);
    }
}
