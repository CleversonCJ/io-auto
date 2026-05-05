package com.io.appioweb.adapters.persistence.ioauto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "olx_catalog_versions")
public class JpaOlxCatalogVersionEntity {

    @Id
    private UUID id;

    @Column(name = "olx_brand_id", nullable = false, length = 50)
    private String olxBrandId;

    @Column(name = "olx_model_id", nullable = false, length = 50)
    private String olxModelId;

    @Column(name = "olx_version_id", nullable = false, length = 50)
    private String olxVersionId;

    @Column(nullable = false, length = 255)
    private String name;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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
