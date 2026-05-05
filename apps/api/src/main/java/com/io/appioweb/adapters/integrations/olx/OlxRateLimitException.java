package com.io.appioweb.adapters.integrations.olx;

public class OlxRateLimitException extends OlxApiException {
    public OlxRateLimitException(String message, int httpStatus, String reason) {
        super("OLX_RATE_LIMIT", message, httpStatus, reason);
    }
}
