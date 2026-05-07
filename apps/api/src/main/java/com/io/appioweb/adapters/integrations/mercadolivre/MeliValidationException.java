package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliValidationException extends MeliApiException {

    public MeliValidationException(String message, int httpStatus, String reason) {
        super("MELI_VALIDATION_ERROR", message, httpStatus, reason);
    }
}
