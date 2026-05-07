package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliNotFoundException extends MeliApiException {

    public MeliNotFoundException(String message, int httpStatus, String reason) {
        super("MELI_NOT_FOUND", message, httpStatus, reason);
    }
}
