package com.io.appioweb.adapters.integrations.mercadolivre;

public class MeliUnexpectedException extends MeliApiException {

    public MeliUnexpectedException(String code, String message, int httpStatus, String reason) {
        super(code, message, httpStatus, reason);
    }
}
