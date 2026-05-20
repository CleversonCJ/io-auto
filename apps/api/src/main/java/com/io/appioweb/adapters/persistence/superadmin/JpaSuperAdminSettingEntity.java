package com.io.appioweb.adapters.persistence.superadmin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "superadmin_settings")
public class JpaSuperAdminSettingEntity {

    @Id
    @Column(name = "setting_key", nullable = false, length = 120)
    private String settingKey;

    @Column(name = "setting_value", columnDefinition = "text")
    private String settingValue;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public String getSettingKey() {
        return settingKey;
    }

    public void setSettingKey(String settingKey) {
        this.settingKey = settingKey;
    }

    public String getSettingValue() {
        return settingValue;
    }

    public void setSettingValue(String settingValue) {
        this.settingValue = settingValue;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
