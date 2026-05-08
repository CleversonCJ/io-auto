package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliPaymentRequiredException extends MeliApiException {

    public MeliPaymentRequiredException(String message, int httpStatus, String reason) {
        super("MELI_PAYMENT_REQUIRED", message, httpStatus, reason);
    }
}
