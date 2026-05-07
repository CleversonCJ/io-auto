package com.io.appioweb.adapters.integrations.mercadolivre;

public abstract class MeliApiException extends RuntimeException {

    private final String code;
    private final int httpStatus;
    private final String reason;

    protected MeliApiException(String code, String message, int httpStatus, String reason) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.reason = reason == null ? "" : reason.trim();
    }

    public String code() {
        return code;
    }

    public int httpStatus() {
        return httpStatus;
    }

    public String reason() {
        return reason;
    }
}
