package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "meli_ads")
public class JpaMeliAdEntity {

    @Id
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "vehicle_id", nullable = false)
    private UUID vehicleId;

    @Column(name = "meli_item_id", length = 50)
    private String meliItemId;

    @Column(name = "seller_sku", nullable = false, length = 100)
    private String sellerSku;

    @Column(name = "category_id", length = 50)
    private String categoryId;

    @Column(name = "listing_type_id", length = 50)
    private String listingTypeId;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String permalink;

    @Column(length = 50)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sub_status", columnDefinition = "jsonb")
    private String subStatus;

    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "currency_id", nullable = false, length = 10)
    private String currencyId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_payload", columnDefinition = "jsonb")
    private String lastPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_response", columnDefinition = "jsonb")
    private String lastResponse;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "last_error", columnDefinition = "jsonb")
    private String lastError;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "paused_at")
    private Instant pausedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

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

    public UUID getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(UUID vehicleId) {
        this.vehicleId = vehicleId;
    }

    public String getMeliItemId() {
        return meliItemId;
    }

    public void setMeliItemId(String meliItemId) {
        this.meliItemId = meliItemId;
    }

    public String getSellerSku() {
        return sellerSku;
    }

    public void setSellerSku(String sellerSku) {
        this.sellerSku = sellerSku;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getListingTypeId() {
        return listingTypeId;
    }

    public void setListingTypeId(String listingTypeId) {
        this.listingTypeId = listingTypeId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getPermalink() {
        return permalink;
    }

    public void setPermalink(String permalink) {
        this.permalink = permalink;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSubStatus() {
        return subStatus;
    }

    public void setSubStatus(String subStatus) {
        this.subStatus = subStatus;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getCurrencyId() {
        return currencyId;
    }

    public void setCurrencyId(String currencyId) {
        this.currencyId = currencyId;
    }

    public String getLastPayload() {
        return lastPayload;
    }

    public void setLastPayload(String lastPayload) {
        this.lastPayload = lastPayload;
    }

    public String getLastResponse() {
        return lastResponse;
    }

    public void setLastResponse(String lastResponse) {
        this.lastResponse = lastResponse;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getPausedAt() {
        return pausedAt;
    }

    public void setPausedAt(Instant pausedAt) {
        this.pausedAt = pausedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public Instant getLastSyncedAt() {
        return lastSyncedAt;
    }

    public void setLastSyncedAt(Instant lastSyncedAt) {
        this.lastSyncedAt = lastSyncedAt;
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
