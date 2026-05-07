package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliUnauthorizedException extends MeliApiException {

    public MeliUnauthorizedException(String message, int httpStatus, String reason) {
        super("MELI_UNAUTHORIZED", message, httpStatus, reason);
    }
}
