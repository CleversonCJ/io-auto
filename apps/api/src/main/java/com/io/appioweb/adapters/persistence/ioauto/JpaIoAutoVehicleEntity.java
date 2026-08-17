package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ioauto_vehicles")
public class JpaIoAutoVehicleEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "stock_number", length = 80)
    private String stockNumber;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 120)
    private String brand;

    @Column(nullable = false, length = 120)
    private String model;

    @Column(length = 160)
    private String version;

    @Column(length = 120)
    private String engine;

    @Column(name = "model_year")
    private Integer modelYear;

    @Column(name = "manufacture_year")
    private Integer manufactureYear;

    @Column(name = "price_cents")
    private Long priceCents;

    @Column(name = "trade_in_price_cents")
    private Long tradeInPriceCents;

    @Column
    private Integer mileage;

    @Column(length = 40)
    private String transmission;

    @Column(name = "fuel_type", length = 40)
    private String fuelType;

    @Column(name = "body_type", length = 60)
    private String bodyType;

    @Column
    private Integer doors;

    @Column(length = 60)
    private String color;

    @Column(name = "plate_final", length = 10)
    private String plateFinal;

    @Column(length = 12)
    private String plate;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(length = 8)
    private String zipcode;

    @Column(length = 120)
    private String city;

    @Column(length = 20)
    private String state;

    @Column(name = "is_consigned", nullable = false)
    private boolean consigned;

    @Column(name = "consigned_owner_name", length = 200)
    private String consignedOwnerName;

    @Column(name = "consignment_commission_percentage", precision = 7, scale = 4)
    private java.math.BigDecimal consignmentCommissionPercentage;

    @Column(nullable = false)
    private boolean featured;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "cover_image_url", columnDefinition = "text")
    private String coverImageUrl;

    @Column(name = "gallery_json", nullable = false, columnDefinition = "text")
    private String galleryJson = "[]";

    @Column(name = "image_count", nullable = false)
    private int imageCount;

    @Column(name = "optionals_json", nullable = false, columnDefinition = "text")
    private String optionalsJson = "[]";

    @Column(name = "financing_json", nullable = false, columnDefinition = "text")
    private String financingJson = "{}";

    @Column(name = "olx_brand_id", length = 50)
    private String olxBrandId;

    @Column(name = "olx_model_id", length = 50)
    private String olxModelId;

    @Column(name = "olx_version_id", length = 50)
    private String olxVersionId;

    @Column(name = "olx_fuel_code", length = 50)
    private String olxFuelCode;

    @Column(name = "olx_gearbox_code", length = 50)
    private String olxGearboxCode;

    @Column(name = "olx_doors_code", length = 50)
    private String olxDoorsCode;

    @Column(name = "olx_color_code", length = 50)
    private String olxColorCode;

    @Column(name = "olx_feature_codes_json", nullable = false, columnDefinition = "text")
    private String olxFeatureCodesJson = "[]";

    @Column(name = "meli_category_id", length = 50)
    private String meliCategoryId;

    @Column(name = "meli_listing_type_id", length = 50)
    private String meliListingTypeId;

    @Column(name = "meli_condition", length = 20)
    private String meliCondition;

    @Column(name = "meli_seller_sku", length = 100)
    private String meliSellerSku;

    @Column(name = "meli_title", length = 255)
    private String meliTitle;

    @Column(name = "meli_description", columnDefinition = "text")
    private String meliDescription;

    @Column(name = "meli_price_cents")
    private Long meliPriceCents;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "meli_attributes_json", nullable = false, columnDefinition = "jsonb")
    private String meliAttributesJson = "[]";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public String getStockNumber() {
        return stockNumber;
    }

    public void setStockNumber(String stockNumber) {
        this.stockNumber = stockNumber;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public Integer getModelYear() {
        return modelYear;
    }

    public void setModelYear(Integer modelYear) {
        this.modelYear = modelYear;
    }

    public Integer getManufactureYear() {
        return manufactureYear;
    }

    public void setManufactureYear(Integer manufactureYear) {
        this.manufactureYear = manufactureYear;
    }

    public Long getPriceCents() {
        return priceCents;
    }

    public void setPriceCents(Long priceCents) {
        this.priceCents = priceCents;
    }

    public Long getTradeInPriceCents() {
        return tradeInPriceCents;
    }

    public void setTradeInPriceCents(Long tradeInPriceCents) {
        this.tradeInPriceCents = tradeInPriceCents;
    }

    public Integer getMileage() {
        return mileage;
    }

    public void setMileage(Integer mileage) {
        this.mileage = mileage;
    }

    public String getTransmission() {
        return transmission;
    }

    public void setTransmission(String transmission) {
        this.transmission = transmission;
    }

    public String getFuelType() {
        return fuelType;
    }

    public void setFuelType(String fuelType) {
        this.fuelType = fuelType;
    }

    public String getBodyType() {
        return bodyType;
    }

    public void setBodyType(String bodyType) {
        this.bodyType = bodyType;
    }

    public Integer getDoors() {
        return doors;
    }

    public void setDoors(Integer doors) {
        this.doors = doors;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getPlateFinal() {
        return plateFinal;
    }

    public void setPlateFinal(String plateFinal) {
        this.plateFinal = plateFinal;
    }

    public String getPlate() {
        return plate;
    }

    public void setPlate(String plate) {
        this.plate = plate;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }

    public String getZipcode() {
        return zipcode;
    }

    public void setZipcode(String zipcode) {
        this.zipcode = zipcode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public boolean isConsigned() {
        return consigned;
    }

    public void setConsigned(boolean consigned) {
        this.consigned = consigned;
    }

    public String getConsignedOwnerName() {
        return consignedOwnerName;
    }

    public void setConsignedOwnerName(String consignedOwnerName) {
        this.consignedOwnerName = consignedOwnerName;
    }

    public java.math.BigDecimal getConsignmentCommissionPercentage() {
        return consignmentCommissionPercentage;
    }

    public void setConsignmentCommissionPercentage(java.math.BigDecimal consignmentCommissionPercentage) {
        this.consignmentCommissionPercentage = consignmentCommissionPercentage;
    }

    public boolean isFeatured() {
        return featured;
    }

    public void setFeatured(boolean featured) {
        this.featured = featured;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public void setCoverImageUrl(String coverImageUrl) {
        this.coverImageUrl = coverImageUrl;
    }

    public String getGalleryJson() {
        return galleryJson;
    }

    public void setGalleryJson(String galleryJson) {
        this.galleryJson = galleryJson;
    }

    public int getImageCount() {
        return imageCount;
    }

    public void setImageCount(int imageCount) {
        this.imageCount = imageCount;
    }

    public String getOptionalsJson() {
        return optionalsJson;
    }

    public void setOptionalsJson(String optionalsJson) {
        this.optionalsJson = optionalsJson;
    }

    public String getFinancingJson() {
        return financingJson;
    }

    public void setFinancingJson(String financingJson) {
        this.financingJson = financingJson;
    }

    public String getOlxBrandId() {
        return olxBrandId;
    }

    public void setOlxBrandId(String olxBrandId) {
        this.olxBrandId = olxBrandId;
    }

    public String getOlxModelId() {
        return olxModelId;
    }

    public void setOlxModelId(String olxModelId) {
        this.olxModelId = olxModelId;
    }

    public String getOlxVersionId() {
        return olxVersionId;
    }

    public void setOlxVersionId(String olxVersionId) {
        this.olxVersionId = olxVersionId;
    }

    public String getOlxFuelCode() {
        return olxFuelCode;
    }

    public void setOlxFuelCode(String olxFuelCode) {
        this.olxFuelCode = olxFuelCode;
    }

    public String getOlxGearboxCode() {
        return olxGearboxCode;
    }

    public void setOlxGearboxCode(String olxGearboxCode) {
        this.olxGearboxCode = olxGearboxCode;
    }

    public String getOlxDoorsCode() {
        return olxDoorsCode;
    }

    public void setOlxDoorsCode(String olxDoorsCode) {
        this.olxDoorsCode = olxDoorsCode;
    }

    public String getOlxColorCode() {
        return olxColorCode;
    }

    public void setOlxColorCode(String olxColorCode) {
        this.olxColorCode = olxColorCode;
    }

    public String getOlxFeatureCodesJson() {
        return olxFeatureCodesJson;
    }

    public void setOlxFeatureCodesJson(String olxFeatureCodesJson) {
        this.olxFeatureCodesJson = olxFeatureCodesJson;
    }

    public String getMeliCategoryId() {
        return meliCategoryId;
    }

    public void setMeliCategoryId(String meliCategoryId) {
        this.meliCategoryId = meliCategoryId;
    }

    public String getMeliListingTypeId() {
        return meliListingTypeId;
    }

    public void setMeliListingTypeId(String meliListingTypeId) {
        this.meliListingTypeId = meliListingTypeId;
    }

    public String getMeliCondition() {
        return meliCondition;
    }

    public void setMeliCondition(String meliCondition) {
        this.meliCondition = meliCondition;
    }

    public String getMeliSellerSku() {
        return meliSellerSku;
    }

    public void setMeliSellerSku(String meliSellerSku) {
        this.meliSellerSku = meliSellerSku;
    }

    public String getMeliTitle() {
        return meliTitle;
    }

    public void setMeliTitle(String meliTitle) {
        this.meliTitle = meliTitle;
    }

    public String getMeliDescription() {
        return meliDescription;
    }

    public void setMeliDescription(String meliDescription) {
        this.meliDescription = meliDescription;
    }

    public Long getMeliPriceCents() {
        return meliPriceCents;
    }

    public void setMeliPriceCents(Long meliPriceCents) {
        this.meliPriceCents = meliPriceCents;
    }

    public String getMeliAttributesJson() {
        return meliAttributesJson;
    }

    public void setMeliAttributesJson(String meliAttributesJson) {
        this.meliAttributesJson = meliAttributesJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
