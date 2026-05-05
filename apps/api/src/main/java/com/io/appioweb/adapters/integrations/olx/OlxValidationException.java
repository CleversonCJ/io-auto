package com.io.appioweb.adapters.integrations.olx;

public class OlxValidationException extends OlxApiException {
    public OlxValidationException(String message, int httpStatus, String reason) {
        super("OLX_VALIDATION_ERROR", message, httpStatus, reason);
    }
}
