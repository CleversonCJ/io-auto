package com.io.appioweb.adapters.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class MailConfigurationLogger {

    private static final Logger log = LoggerFactory.getLogger(MailConfigurationLogger.class);

    @Value("${spring.mail.host:}")
    private String host;

    @Value("${spring.mail.port:0}")
    private int port;

    @Value("${spring.mail.username:}")
    private String username;

    @Value("${spring.mail.from:}")
    private String from;

    @Value("${spring.mail.properties.mail.smtp.auth:true}")
    private boolean authEnabled;

    @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}")
    private boolean starttlsEnabled;

    @Value("${spring.mail.properties.mail.smtp.starttls.required:true}")
    private boolean starttlsRequired;

    @Value("${spring.mail.properties.mail.smtp.ssl.enable:false}")
    private boolean sslEnabled;

    @Value("${spring.mail.properties.mail.connectiontimeout:10000}")
    private int connectionTimeoutMs;

    @Value("${spring.mail.properties.mail.timeout:10000}")
    private int timeoutMs;

    @Value("${spring.mail.properties.mail.writetimeout:10000}")
    private int writeTimeoutMs;

    @EventListener(ApplicationReadyEvent.class)
    public void logConfiguration() {
        log.info(
                "[MailConfig] host={} port={} from={} username={} auth={} starttlsEnabled={} starttlsRequired={} sslEnabled={} connectionTimeoutMs={} timeoutMs={} writeTimeoutMs={}",
                safe(host),
                port,
                safe(from),
                maskUsername(username),
                authEnabled,
                starttlsEnabled,
                starttlsRequired,
                sslEnabled,
                connectionTimeoutMs,
                timeoutMs,
                writeTimeoutMs
        );

        if (port == 465 && !sslEnabled) {
            log.warn("[MailConfig] SMTP configurado na porta 465 sem SSL explícito. Normalmente a porta 465 exige MAIL_SMTP_SSL_ENABLE=true.");
        }

        if (port == 587 && !starttlsEnabled) {
            log.warn("[MailConfig] SMTP configurado na porta 587 sem STARTTLS. Normalmente a porta 587 exige MAIL_SMTP_STARTTLS_ENABLE=true.");
        }
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "(vazio)" : value;
    }

    private String maskUsername(String value) {
        if (value == null || value.isBlank()) {
            return "(vazio)";
        }
        int atIndex = value.indexOf('@');
        if (atIndex <= 1) {
            return "***";
        }
        return value.substring(0, 2) + "***" + value.substring(atIndex);
    }
}
