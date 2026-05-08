package com.io.appioweb.application.ioauto.meli;

public record MeliVehicleAttributeValue(
        String id,
        String valueId,
        String valueName,
        java.math.BigDecimal valueStructNumber,
        String valueStructUnit
) {
    public MeliVehicleAttributeValue(String id, String valueId, String valueName) {
        this(id, valueId, valueName, null, null);
    }
}
