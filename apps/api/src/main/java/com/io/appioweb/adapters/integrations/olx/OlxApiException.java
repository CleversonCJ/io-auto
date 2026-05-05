package com.io.appioweb.adapters.integrations.olx;

import com.io.appioweb.shared.errors.BusinessException;

public abstract class OlxApiException extends BusinessException {

    private final int httpStatus;
    private final String reason;

    protected OlxApiException(String code, String message, int httpStatus, String reason) {
        super(code, message);
        this.httpStatus = httpStatus;
        this.reason = reason == null ? "" : reason.trim();
    }

    public int httpStatus() {
        return httpStatus;
    }

    public String reason() {
        return reason;
    }
}
