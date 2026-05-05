package com.io.appioweb.adapters.integrations.olx;

public class OlxUnauthorizedException extends OlxApiException {
    public OlxUnauthorizedException(String message, int httpStatus, String reason) {
        super("OLX_UNAUTHORIZED", message, httpStatus, reason);
    }
}
