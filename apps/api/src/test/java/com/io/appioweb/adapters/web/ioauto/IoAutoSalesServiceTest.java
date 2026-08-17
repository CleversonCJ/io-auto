package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.adapters.persistence.ioauto.JpaIoAutoVehicleEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class IoAutoSalesServiceTest {

    @Test
    void usesTradeInPriceWhenSaleReceivesAnotherVehicle() {
        JpaIoAutoVehicleEntity vehicle = vehicleWithPrices(8_000_000L, 8_500_000L);

        Long resolvedPrice = IoAutoSalesService.resolveSalePriceCents(vehicle, saleCommand(true));

        assertThat(resolvedPrice).isEqualTo(8_500_000L);
    }

    @Test
    void usesDefaultPriceWhenSaleDoesNotReceiveAnotherVehicle() {
        JpaIoAutoVehicleEntity vehicle = vehicleWithPrices(8_000_000L, 8_500_000L);

        Long resolvedPrice = IoAutoSalesService.resolveSalePriceCents(vehicle, saleCommand(false));

        assertThat(resolvedPrice).isEqualTo(8_000_000L);
    }

    @Test
    void fallsBackToDefaultPriceWhenTradeInPriceIsNotConfigured() {
        JpaIoAutoVehicleEntity vehicle = vehicleWithPrices(8_000_000L, null);

        Long resolvedPrice = IoAutoSalesService.resolveSalePriceCents(vehicle, saleCommand(true));

        assertThat(resolvedPrice).isEqualTo(8_000_000L);
    }

    @Test
    void calculatesInfluencerCommissionFromNegotiatedSaleAmount() {
        long commissionCents = IoAutoSalesService.calculateInfluencerCommissionCents(
                8_250_000L,
                new BigDecimal("2.5")
        );

        assertThat(commissionCents).isEqualTo(206_250L);
    }

    @Test
    void roundsInfluencerCommissionToTheNearestCent() {
        long commissionCents = IoAutoSalesService.calculateInfluencerCommissionCents(
                10_001L,
                new BigDecimal("1.5")
        );

        assertThat(commissionCents).isEqualTo(150L);
    }

    private JpaIoAutoVehicleEntity vehicleWithPrices(Long priceCents, Long tradeInPriceCents) {
        JpaIoAutoVehicleEntity vehicle = new JpaIoAutoVehicleEntity();
        vehicle.setPriceCents(priceCents);
        vehicle.setTradeInPriceCents(tradeInPriceCents);
        return vehicle;
    }

    private IoAutoSaleCalculationService.SaleClosingCommand saleCommand(boolean hasTradeInVehicle) {
        return new IoAutoSaleCalculationService.SaleClosingCommand(
                BigDecimal.ZERO,
                hasTradeInVehicle,
                null,
                hasTradeInVehicle ? "Veiculo recebido" : null,
                hasTradeInVehicle ? 1_000_000L : 0L,
                false,
                null,
                null,
                null,
                null,
                null
        );
    }
}
