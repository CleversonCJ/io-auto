package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliForbiddenException extends MeliApiException {

    public MeliForbiddenException(String message, int httpStatus, String reason) {
        super("MELI_FORBIDDEN", message, httpStatus, reason);
    }
}
