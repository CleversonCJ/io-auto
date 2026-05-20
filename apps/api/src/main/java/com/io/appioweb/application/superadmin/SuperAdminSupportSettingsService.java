package com.io.appioweb.application.superadmin;

import com.io.appioweb.adapters.persistence.superadmin.JpaSuperAdminSettingEntity;
import com.io.appioweb.adapters.persistence.superadmin.SuperAdminSettingRepositoryJpa;
import com.io.appioweb.shared.errors.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

@Service
public class SuperAdminSupportSettingsService {

    private static final String SUPPORT_WHATSAPP_KEY = "support_whatsapp_number";

    private final SuperAdminSettingRepositoryJpa settings;

    public SuperAdminSupportSettingsService(SuperAdminSettingRepositoryJpa settings) {
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public SupportContactSettings getSupportContactSettings() {
        JpaSuperAdminSettingEntity entity = settings.findById(SUPPORT_WHATSAPP_KEY).orElse(null);
        String storedDigits = entity == null ? "" : normalizeDigits(entity.getSettingValue());
        return toSnapshot(storedDigits, entity == null ? null : entity.getUpdatedAt());
    }

    @Transactional
    public SupportContactSettings updateSupportContactSettings(UpdateSupportContactCommand command) {
        String digits = normalizeDigits(command.whatsappNumber());
        if (digits.length() < 10 || digits.length() > 13) {
            throw new BusinessException("SUPPORT_CONTACT_INVALID", "Informe um número de WhatsApp válido para o suporte.");
        }

        JpaSuperAdminSettingEntity entity = settings.findById(SUPPORT_WHATSAPP_KEY).orElseGet(JpaSuperAdminSettingEntity::new);
        Instant updatedAt = Instant.now();
        entity.setSettingKey(SUPPORT_WHATSAPP_KEY);
        entity.setSettingValue(digits);
        entity.setUpdatedAt(updatedAt);
        settings.save(entity);

        return toSnapshot(digits, updatedAt);
    }

    private SupportContactSettings toSnapshot(String digits, Instant updatedAt) {
        String localDigits = stripBrazilCountryCode(digits);
        String whatsappUrl = digits.isBlank() ? "" : "https://wa.me/" + ensureBrazilCountryCode(digits);
        return new SupportContactSettings(
                !digits.isBlank(),
                localDigits,
                formatWhatsapp(localDigits),
                whatsappUrl,
                updatedAt
        );
    }

    private String normalizeDigits(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private String stripBrazilCountryCode(String digits) {
        String normalized = normalizeDigits(digits);
        if (normalized.length() >= 12 && normalized.startsWith("55")) {
            return normalized.substring(2);
        }
        return normalized;
    }

    private String ensureBrazilCountryCode(String digits) {
        String normalized = normalizeDigits(digits);
        if (normalized.isBlank()) {
            return "";
        }
        if (normalized.startsWith("55") && normalized.length() >= 12) {
            return normalized;
        }
        return "55" + normalized;
    }

    private String formatWhatsapp(String digits) {
        String normalized = normalizeDigits(digits);
        if (normalized.length() == 11) {
            return String.format(Locale.ROOT, "(%s) %s-%s", normalized.substring(0, 2), normalized.substring(2, 7), normalized.substring(7));
        }
        if (normalized.length() == 10) {
            return String.format(Locale.ROOT, "(%s) %s-%s", normalized.substring(0, 2), normalized.substring(2, 6), normalized.substring(6));
        }
        return normalized;
    }

    public record UpdateSupportContactCommand(String whatsappNumber) {
    }

    public record SupportContactSettings(
            boolean configured,
            String whatsappNumber,
            String whatsappDisplay,
            String whatsappUrl,
            Instant updatedAt
    ) {
    }
}
