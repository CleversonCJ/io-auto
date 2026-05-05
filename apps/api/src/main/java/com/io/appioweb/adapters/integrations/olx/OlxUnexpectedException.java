package com.io.appioweb.adapters.integrations.olx;

public class OlxUnexpectedException extends OlxApiException {
    public OlxUnexpectedException(String code, String message, int httpStatus, String reason) {
        super(code, message, httpStatus, reason);
    }
}
