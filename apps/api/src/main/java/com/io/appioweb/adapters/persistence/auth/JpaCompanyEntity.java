package com.io.appioweb.adapters.persistence.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "companies")
public class JpaCompanyEntity {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "profile_image_url", columnDefinition = "text")
    private String profileImageUrl;

    @Column(nullable = false, length = 180)
    private String email;

    @Column(name = "contract_end_date", nullable = false)
    private LocalDate contractEndDate;

    @Column(nullable = false, length = 18)
    private String cnpj;

    @Column(name = "opened_at", nullable = false)
    private LocalDate openedAt;

    @Column(name = "whatsapp_number", nullable = false, length = 30)
    private String whatsappNumber;

    @Column(name = "zapi_instance_id", nullable = false, length = 180)
    private String zapiInstanceId;

    @Column(name = "zapi_instance_token", nullable = false, length = 255)
    private String zapiInstanceToken;

    @Column(name = "zapi_client_token", nullable = false, length = 255)
    private String zapiClientToken;

    @Column(name = "business_hours_start", nullable = false, length = 5)
    private String businessHoursStart;

    @Column(name = "business_hours_end", nullable = false, length = 5)
    private String businessHoursEnd;

    @Column(name = "business_hours_weekly_json", columnDefinition = "text")
    private String businessHoursWeeklyJson;

    @Column(name = "public_stock_banner_mode", nullable = false, length = 30)
    private String publicStockBannerMode;

    @Column(name = "public_stock_banner_images_json", nullable = false, columnDefinition = "text")
    private String publicStockBannerImagesJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public LocalDate getContractEndDate() { return contractEndDate; }
    public void setContractEndDate(LocalDate contractEndDate) { this.contractEndDate = contractEndDate; }

    public String getCnpj() { return cnpj; }
    public void setCnpj(String cnpj) { this.cnpj = cnpj; }

    public LocalDate getOpenedAt() { return openedAt; }
    public void setOpenedAt(LocalDate openedAt) { this.openedAt = openedAt; }

    public String getWhatsappNumber() { return whatsappNumber; }
    public void setWhatsappNumber(String whatsappNumber) { this.whatsappNumber = whatsappNumber; }

    public String getZapiInstanceId() { return zapiInstanceId; }
    public void setZapiInstanceId(String zapiInstanceId) { this.zapiInstanceId = zapiInstanceId; }

    public String getZapiInstanceToken() { return zapiInstanceToken; }
    public void setZapiInstanceToken(String zapiInstanceToken) { this.zapiInstanceToken = zapiInstanceToken; }

    public String getZapiClientToken() { return zapiClientToken; }
    public void setZapiClientToken(String zapiClientToken) { this.zapiClientToken = zapiClientToken; }

    public String getBusinessHoursStart() { return businessHoursStart; }
    public void setBusinessHoursStart(String businessHoursStart) { this.businessHoursStart = businessHoursStart; }

    public String getBusinessHoursEnd() { return businessHoursEnd; }
    public void setBusinessHoursEnd(String businessHoursEnd) { this.businessHoursEnd = businessHoursEnd; }

    public String getBusinessHoursWeeklyJson() { return businessHoursWeeklyJson; }
    public void setBusinessHoursWeeklyJson(String businessHoursWeeklyJson) { this.businessHoursWeeklyJson = businessHoursWeeklyJson; }

    public String getPublicStockBannerMode() { return publicStockBannerMode; }
    public void setPublicStockBannerMode(String publicStockBannerMode) { this.publicStockBannerMode = publicStockBannerMode; }

    public String getPublicStockBannerImagesJson() { return publicStockBannerImagesJson; }
    public void setPublicStockBannerImagesJson(String publicStockBannerImagesJson) { this.publicStockBannerImagesJson = publicStockBannerImagesJson; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
