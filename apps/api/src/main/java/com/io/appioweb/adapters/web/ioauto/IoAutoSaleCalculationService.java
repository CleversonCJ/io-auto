package com.io.appioweb.adapters.web.ioauto;

import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class IoAutoSaleCalculationService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final String CONSIGNMENT_TYPE_PERCENTUAL = "PERCENTUAL";
    private static final String CONSIGNMENT_TYPE_FIXED = "VALOR_FIXO";

    public SaleCalculationResult calculate(Long originalAmountCents, SaleClosingCommand command, LocalDate defaultFirstDueDate) {
        return calculate(originalAmountCents, ConsignmentVehicleContext.notConsigned(), command, defaultFirstDueDate);
    }

    public SaleCalculationResult calculate(
            Long originalAmountCents,
            ConsignmentVehicleContext consignmentVehicleContext,
            SaleClosingCommand command,
            LocalDate defaultFirstDueDate
    ) {
        long originalCents = normalizeOriginalAmount(originalAmountCents);
        BigDecimal discountPercentage = normalizeDiscountPercentage(command.discountPercentage());

        BigDecimal originalAmount = toMoney(originalCents);
        BigDecimal discountAmount = originalAmount.multiply(discountPercentage)
                .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
        long discountAmountCents = toCents(discountAmount);

        long amountAfterDiscountCents = originalCents - discountAmountCents;
        if (amountAfterDiscountCents < 0L) {
            throw new BusinessException("IOAUTO_SALE_INVALID_DISCOUNT", "O desconto calculado nao pode ultrapassar o valor original do veiculo.");
        }

        ConsignmentCalculation consignment = calculateConsignment(consignmentVehicleContext, command, amountAfterDiscountCents);

        boolean hasTradeIn = Boolean.TRUE.equals(command.hasTradeInVehicle());
        String tradeInDescription = normalizeText(command.tradeInVehicleDescription());
        UUID tradeInVehicleId = command.tradeInVehicleId();
        long tradeInAmountCents = normalizeTradeInAmount(command.tradeInAmountCents());

        if (hasTradeIn) {
            if (tradeInVehicleId == null && tradeInDescription == null) {
                throw new BusinessException("IOAUTO_SALE_TRADE_IN_REQUIRED", "Informe o veiculo recebido na troca.");
            }
            if (tradeInAmountCents <= 0L) {
                throw new BusinessException("IOAUTO_SALE_TRADE_IN_AMOUNT_REQUIRED", "Informe o valor do veiculo recebido na troca.");
            }
            if (tradeInAmountCents > amountAfterDiscountCents) {
                throw new BusinessException("IOAUTO_SALE_TRADE_IN_TOO_HIGH", "O valor do veiculo dado em troca nao pode ser maior que o valor final da venda.");
            }
        } else {
            tradeInVehicleId = null;
            tradeInDescription = null;
            tradeInAmountCents = 0L;
        }

        long totalRealAmountCents = amountAfterDiscountCents - tradeInAmountCents;
        if (totalRealAmountCents < 0L) {
            throw new BusinessException("IOAUTO_SALE_TOTAL_INVALID", "O valor total real da venda nao pode ser negativo.");
        }

        boolean installmentSale = Boolean.TRUE.equals(command.installmentSale());
        int installmentCount = installmentSale ? requireInstallmentCount(command.installmentCount()) : 1;
        LocalDate firstDueDate = command.firstInstallmentDueDate() == null ? defaultFirstDueDate : command.firstInstallmentDueDate();
        if (firstDueDate == null) {
            throw new BusinessException("IOAUTO_SALE_INSTALLMENT_DATE_REQUIRED", "Informe a data de vencimento da primeira parcela.");
        }

        List<SaleInstallment> installments = splitInstallments(totalRealAmountCents, installmentCount, firstDueDate);

        return new SaleCalculationResult(
                originalCents,
                discountPercentage,
                discountAmountCents,
                amountAfterDiscountCents,
                hasTradeIn,
                tradeInVehicleId,
                tradeInDescription,
                tradeInAmountCents,
                totalRealAmountCents,
                installmentSale,
                installmentCount,
                firstDueDate,
                installments,
                consignment.consigned(),
                consignment.consignedOwnerName(),
                consignment.commissionType(),
                consignment.commissionPercentage(),
                consignment.baseAmountCents(),
                consignment.commissionAmountCents(),
                consignment.ownerTransferAmountCents()
        );
    }

    private long normalizeOriginalAmount(Long originalAmountCents) {
        if (originalAmountCents == null || originalAmountCents <= 0L) {
            throw new BusinessException("IOAUTO_SALE_VEHICLE_PRICE_REQUIRED", "Informe o valor do veiculo antes de concluir a venda.");
        }
        return originalAmountCents;
    }

    private BigDecimal normalizeDiscountPercentage(BigDecimal rawValue) {
        BigDecimal normalized = rawValue == null ? BigDecimal.ZERO : rawValue.setScale(4, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("IOAUTO_SALE_DISCOUNT_INVALID", "O percentual de desconto nao pode ser negativo.");
        }
        if (normalized.compareTo(ONE_HUNDRED) > 0) {
            throw new BusinessException("IOAUTO_SALE_DISCOUNT_INVALID", "O percentual de desconto nao pode ser maior que 100%.");
        }
        return normalized;
    }

    private long normalizeTradeInAmount(Long tradeInAmountCents) {
        if (tradeInAmountCents == null) {
            return 0L;
        }
        if (tradeInAmountCents < 0L) {
            throw new BusinessException("IOAUTO_SALE_TRADE_IN_INVALID", "O valor do veiculo dado em troca nao pode ser negativo.");
        }
        return tradeInAmountCents;
    }

    private int requireInstallmentCount(Integer installmentCount) {
        if (installmentCount == null) {
            throw new BusinessException("IOAUTO_SALE_INSTALLMENT_COUNT_REQUIRED", "Informe a quantidade de parcelas.");
        }
        if (installmentCount <= 1) {
            throw new BusinessException("IOAUTO_SALE_INSTALLMENT_COUNT_INVALID", "A quantidade de parcelas deve ser maior que 1.");
        }
        return installmentCount;
    }

    private ConsignmentCalculation calculateConsignment(
            ConsignmentVehicleContext consignmentVehicleContext,
            SaleClosingCommand command,
            long amountAfterDiscountCents
    ) {
        ConsignmentVehicleContext normalizedContext = consignmentVehicleContext == null
                ? ConsignmentVehicleContext.notConsigned()
                : consignmentVehicleContext;

        if (!normalizedContext.consigned()) {
            return ConsignmentCalculation.notConsigned();
        }

        String ownerName = normalizeText(normalizedContext.ownerName());
        if (ownerName == null) {
            throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_OWNER_REQUIRED", "Informe o dono/empresa do veiculo consignado.");
        }

        BigDecimal vehicleCommissionPercentage = normalizeOptionalConsignmentPercentage(normalizedContext.defaultCommissionPercentage());
        String requestedType = normalizeConsignmentCommissionType(command.consignmentCommissionType());
        BigDecimal requestedPercentage = normalizeOptionalConsignmentPercentage(command.consignmentCommissionPercentage());
        long requestedFixedAmountCents = normalizeOptionalPositiveAmount(command.consignmentCommissionAmountCents());

        String commissionType = requestedType;
        if (commissionType == null) {
            if (vehicleCommissionPercentage != null) {
                commissionType = CONSIGNMENT_TYPE_PERCENTUAL;
            } else {
                throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_COMMISSION_REQUIRED", "Informe a comissao da empresa para concluir a venda consignada.");
            }
        }

        long commissionAmountCents;
        BigDecimal commissionPercentage = null;
        if (CONSIGNMENT_TYPE_PERCENTUAL.equals(commissionType)) {
            BigDecimal percentageToUse = requestedPercentage == null ? vehicleCommissionPercentage : requestedPercentage;
            if (percentageToUse == null) {
                throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_PERCENTAGE_REQUIRED", "Informe o percentual de comissao da venda consignada.");
            }
            if (percentageToUse.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_PERCENTAGE_INVALID", "O percentual de comissao da consignacao deve ser maior que zero.");
            }
            commissionPercentage = percentageToUse.setScale(4, RoundingMode.HALF_UP);
            commissionAmountCents = toCents(
                    toMoney(amountAfterDiscountCents)
                            .multiply(commissionPercentage)
                            .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP)
            );
        } else {
            if (requestedFixedAmountCents <= 0L) {
                throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_AMOUNT_REQUIRED", "Informe o valor da comissao da venda consignada.");
            }
            if (requestedFixedAmountCents > amountAfterDiscountCents) {
                throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_AMOUNT_INVALID", "O valor da comissao da consignacao nao pode ser maior que o valor final com desconto.");
            }
            commissionAmountCents = requestedFixedAmountCents;
        }

        long ownerTransferAmountCents = amountAfterDiscountCents - commissionAmountCents;
        if (ownerTransferAmountCents < 0L) {
            throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_REPASS_INVALID", "O valor de repasse ao proprietario nao pode ser negativo.");
        }

        return new ConsignmentCalculation(
                true,
                ownerName,
                commissionType,
                commissionPercentage,
                amountAfterDiscountCents,
                commissionAmountCents,
                ownerTransferAmountCents
        );
    }

    private List<SaleInstallment> splitInstallments(long totalAmountCents, int installmentCount, LocalDate firstDueDate) {
        List<SaleInstallment> installments = new ArrayList<>();
        long baseInstallmentAmount = installmentCount <= 0 ? totalAmountCents : totalAmountCents / installmentCount;
        long remainder = installmentCount <= 0 ? 0L : totalAmountCents % installmentCount;

        for (int index = 0; index < installmentCount; index++) {
            long amount = baseInstallmentAmount;
            if (index == installmentCount - 1) {
                amount += remainder;
            }
            installments.add(new SaleInstallment(index + 1, installmentCount, amount, firstDueDate.plusMonths(index), "PENDING"));
        }

        long sum = installments.stream().mapToLong(SaleInstallment::amountCents).sum();
        if (sum != totalAmountCents) {
            throw new BusinessException("IOAUTO_SALE_INSTALLMENT_SPLIT_INVALID", "Nao foi possivel dividir as parcelas mantendo o total da venda.");
        }

        return installments;
    }

    private BigDecimal toMoney(long amountCents) {
        return BigDecimal.valueOf(amountCents, 2);
    }

    private long toCents(BigDecimal amount) {
        return amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private BigDecimal normalizeOptionalConsignmentPercentage(BigDecimal rawValue) {
        if (rawValue == null) {
            return null;
        }
        BigDecimal normalized = rawValue.setScale(4, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) < 0 || normalized.compareTo(ONE_HUNDRED) > 0) {
            throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_PERCENTAGE_INVALID", "O percentual de comissao da consignacao deve estar entre 0 e 100.");
        }
        return normalized;
    }

    private String normalizeConsignmentCommissionType(String rawType) {
        String normalized = normalizeText(rawType);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (CONSIGNMENT_TYPE_PERCENTUAL.equals(upper) || CONSIGNMENT_TYPE_FIXED.equals(upper)) {
            return upper;
        }
        throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_COMMISSION_TYPE_INVALID", "Selecione um tipo valido de comissao da consignacao.");
    }

    private long normalizeOptionalPositiveAmount(Long amountCents) {
        if (amountCents == null) {
            return 0L;
        }
        if (amountCents < 0L) {
            throw new BusinessException("IOAUTO_SALE_CONSIGNMENT_AMOUNT_INVALID", "O valor da comissao da consignacao nao pode ser negativo.");
        }
        return amountCents;
    }

    public record SaleClosingCommand(
            BigDecimal discountPercentage,
            Boolean hasTradeInVehicle,
            UUID tradeInVehicleId,
            String tradeInVehicleDescription,
            Long tradeInAmountCents,
            Boolean installmentSale,
            Integer installmentCount,
            LocalDate firstInstallmentDueDate,
            String consignmentCommissionType,
            BigDecimal consignmentCommissionPercentage,
            Long consignmentCommissionAmountCents
    ) {
        public static SaleClosingCommand empty() {
            return new SaleClosingCommand(
                    BigDecimal.ZERO,
                    Boolean.FALSE,
                    null,
                    null,
                    0L,
                    Boolean.FALSE,
                    null,
                    null,
                    null,
                    null,
                    null
            );
        }
    }

    public record ConsignmentVehicleContext(
            boolean consigned,
            String ownerName,
            BigDecimal defaultCommissionPercentage
    ) {
        public static ConsignmentVehicleContext notConsigned() {
            return new ConsignmentVehicleContext(false, null, null);
        }
    }

    public record SaleInstallment(
            int installmentNumber,
            int totalInstallments,
            long amountCents,
            LocalDate dueDate,
            String status
    ) {
    }

    public record SaleCalculationResult(
            long originalAmountCents,
            BigDecimal discountPercentage,
            long discountAmountCents,
            long amountAfterDiscountCents,
            boolean hasTradeInVehicle,
            UUID tradeInVehicleId,
            String tradeInVehicleDescription,
            long tradeInAmountCents,
            long totalRealAmountCents,
            boolean installmentSale,
            int installmentCount,
            LocalDate firstInstallmentDueDate,
            List<SaleInstallment> installments,
            boolean consigned,
            String consignedOwnerName,
            String consignmentCommissionType,
            BigDecimal consignmentCommissionPercentage,
            long consignmentBaseAmountCents,
            long consignmentCommissionAmountCents,
            long consignmentOwnerTransferAmountCents
    ) {
    }

    private record ConsignmentCalculation(
            boolean consigned,
            String consignedOwnerName,
            String commissionType,
            BigDecimal commissionPercentage,
            long baseAmountCents,
            long commissionAmountCents,
            long ownerTransferAmountCents
    ) {
        private static ConsignmentCalculation notConsigned() {
            return new ConsignmentCalculation(false, null, null, null, 0L, 0L, 0L);
        }
    }
}
