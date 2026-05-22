package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.shared.errors.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IoAutoSaleCalculationServiceTest {

    private final IoAutoSaleCalculationService service = new IoAutoSaleCalculationService();

    @Test
    void calculatesSaleWithoutDiscountTradeAndSinglePayment() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                command("0", false, null, null, 0L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.discountAmountCents()).isEqualTo(0L);
        assertThat(result.amountAfterDiscountCents()).isEqualTo(100_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(100_000L);
        assertThat(result.installmentCount()).isEqualTo(1);
        assertThat(result.installments()).hasSize(1);
        assertThat(result.installments().get(0).amountCents()).isEqualTo(100_000L);
    }

    @Test
    void calculatesSaleWithDiscountAndSinglePayment() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                command("10", false, null, null, 0L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.discountAmountCents()).isEqualTo(10_000L);
        assertThat(result.amountAfterDiscountCents()).isEqualTo(90_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(90_000L);
    }

    @Test
    void calculatesSaleWithTradeIn() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                command("0", true, null, "Uno 2013", 20_000L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.hasTradeInVehicle()).isTrue();
        assertThat(result.tradeInAmountCents()).isEqualTo(20_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(80_000L);
    }

    @Test
    void calculatesSaleWithDiscountAndTradeIn() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                command("5", true, null, "Corsa 2008", 10_000L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.discountAmountCents()).isEqualTo(5_000L);
        assertThat(result.amountAfterDiscountCents()).isEqualTo(95_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(85_000L);
    }

    @Test
    void calculatesInstallmentsForParcelledSale() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                120_000L,
                command("0", false, null, null, 0L, true, 3, LocalDate.of(2026, 6, 5)),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.installmentSale()).isTrue();
        assertThat(result.installments()).hasSize(3);
        assertThat(result.installments().stream().map(IoAutoSaleCalculationService.SaleInstallment::amountCents).toList())
                .containsExactly(40_000L, 40_000L, 40_000L);
    }

    @Test
    void adjustsLastInstallmentToMatchRoundingDifference() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                1_000_000L,
                command("0", false, null, null, 0L, true, 3, LocalDate.of(2026, 5, 22)),
                LocalDate.of(2026, 5, 22)
        );

        List<Long> values = result.installments().stream()
                .map(IoAutoSaleCalculationService.SaleInstallment::amountCents)
                .toList();

        assertThat(values).containsExactly(333_333L, 333_333L, 333_334L);
        assertThat(values.stream().mapToLong(Long::longValue).sum()).isEqualTo(1_000_000L);
    }

    @Test
    void calculatesDiscountTradeAndInstallmentsTogether() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                150_000L,
                command("10", true, UUID.randomUUID(), null, 15_000L, true, 4, LocalDate.of(2026, 5, 30)),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.discountAmountCents()).isEqualTo(15_000L);
        assertThat(result.amountAfterDiscountCents()).isEqualTo(135_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(120_000L);
        assertThat(result.installments().stream().mapToLong(IoAutoSaleCalculationService.SaleInstallment::amountCents).sum())
                .isEqualTo(120_000L);
    }

    @Test
    void rejectsDiscountAboveOneHundredPercent() {
        assertThatThrownBy(() -> service.calculate(
                100_000L,
                command("101", false, null, null, 0L, false, null, null),
                LocalDate.of(2026, 5, 22)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("IOAUTO_SALE_DISCOUNT_INVALID"));
    }

    @Test
    void rejectsTradeInValueAboveFinalAmount() {
        assertThatThrownBy(() -> service.calculate(
                100_000L,
                command("10", true, null, "Troca teste", 95_000L, false, null, null),
                LocalDate.of(2026, 5, 22)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("IOAUTO_SALE_TRADE_IN_TOO_HIGH"));
    }

    @Test
    void rejectsInvalidInstallmentCount() {
        assertThatThrownBy(() -> service.calculate(
                100_000L,
                command("0", false, null, null, 0L, true, 1, LocalDate.of(2026, 5, 22)),
                LocalDate.of(2026, 5, 22)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("IOAUTO_SALE_INSTALLMENT_COUNT_INVALID"));
    }

    @Test
    void usesConfiguredConsignmentPercentageWhenVehicleIsConsigned() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                new IoAutoSaleCalculationService.ConsignmentVehicleContext(true, "Loja Parceira", new BigDecimal("5")),
                command("10", false, null, null, 0L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.consigned()).isTrue();
        assertThat(result.consignmentCommissionType()).isEqualTo("PERCENTUAL");
        assertThat(result.consignmentBaseAmountCents()).isEqualTo(90_000L);
        assertThat(result.consignmentCommissionAmountCents()).isEqualTo(4_500L);
        assertThat(result.consignmentOwnerTransferAmountCents()).isEqualTo(85_500L);
    }

    @Test
    void requiresConsignmentCommissionWhenVehicleIsConsignedWithoutConfiguredPercentage() {
        assertThatThrownBy(() -> service.calculate(
                100_000L,
                new IoAutoSaleCalculationService.ConsignmentVehicleContext(true, "Parceiro", null),
                command("0", false, null, null, 0L, false, null, null),
                LocalDate.of(2026, 5, 22)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).code()).isEqualTo("IOAUTO_SALE_CONSIGNMENT_COMMISSION_REQUIRED"));
    }

    @Test
    void calculatesFixedConsignmentCommission() {
        IoAutoSaleCalculationService.SaleClosingCommand command = new IoAutoSaleCalculationService.SaleClosingCommand(
                new BigDecimal("0"),
                false,
                null,
                null,
                0L,
                false,
                null,
                null,
                "VALOR_FIXO",
                null,
                12_000L
        );

        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                new IoAutoSaleCalculationService.ConsignmentVehicleContext(true, "Parceiro", null),
                command,
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.consignmentCommissionType()).isEqualTo("VALOR_FIXO");
        assertThat(result.consignmentCommissionPercentage()).isNull();
        assertThat(result.consignmentCommissionAmountCents()).isEqualTo(12_000L);
        assertThat(result.consignmentOwnerTransferAmountCents()).isEqualTo(88_000L);
    }

    @Test
    void keepsTradeInOutOfConsignmentCommissionBase() {
        IoAutoSaleCalculationService.SaleCalculationResult result = service.calculate(
                100_000L,
                new IoAutoSaleCalculationService.ConsignmentVehicleContext(true, "Parceiro", new BigDecimal("10")),
                command("10", true, null, "Troca", 20_000L, false, null, null),
                LocalDate.of(2026, 5, 22)
        );

        assertThat(result.amountAfterDiscountCents()).isEqualTo(90_000L);
        assertThat(result.totalRealAmountCents()).isEqualTo(70_000L);
        assertThat(result.consignmentBaseAmountCents()).isEqualTo(90_000L);
        assertThat(result.consignmentCommissionAmountCents()).isEqualTo(9_000L);
    }

    private IoAutoSaleCalculationService.SaleClosingCommand command(
            String discountPercentage,
            boolean hasTradeInVehicle,
            UUID tradeInVehicleId,
            String tradeInDescription,
            long tradeInAmountCents,
            boolean installmentSale,
            Integer installmentCount,
            LocalDate firstDueDate
    ) {
        return new IoAutoSaleCalculationService.SaleClosingCommand(
                new BigDecimal(discountPercentage),
                hasTradeInVehicle,
                tradeInVehicleId,
                tradeInDescription,
                tradeInAmountCents,
                installmentSale,
                installmentCount,
                firstDueDate,
                null,
                null,
                null
        );
    }
}
