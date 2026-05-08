package com.io.appioweb.application.onboarding;

import java.util.Map;

public interface EmailSenderService {
    /**
     * Sends an HTML email using a template.
     *
     * @param to       Recipient email
     * @param subject  Email subject
     * @param template Template name (relative to templates/)
     * @param model    Data to inject into the template
     */
    void sendHtmlEmail(String to, String subject, String template, Map<String, Object> model);
}
