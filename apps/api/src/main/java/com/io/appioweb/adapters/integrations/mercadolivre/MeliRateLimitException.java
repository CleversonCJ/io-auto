package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliRateLimitException extends MeliApiException {

    public MeliRateLimitException(String message, int httpStatus, String reason) {
        super("MELI_RATE_LIMIT", message, httpStatus, reason);
    }
}
