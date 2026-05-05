package com.io.appioweb.adapters.integrations.olx;

public class OlxPermissionException extends OlxApiException {
    public OlxPermissionException(String message, int httpStatus, String reason) {
        super("OLX_PERMISSION_DENIED", message, httpStatus, reason);
    }
}
