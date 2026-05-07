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
@Table(name = "meli_categories")
public class JpaMeliCategoryEntity {

    @Id
    private UUID id;

    @Column(name = "site_id", nullable = false, length = 10)
    private String siteId;

    @Column(name = "category_id", nullable = false, length = 50)
    private String categoryId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "parent_id", length = 50)
    private String parentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "path_from_root", columnDefinition = "jsonb")
    private String pathFromRoot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String settings;

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

    public String getSiteId() {
        return siteId;
    }

    public void setSiteId(String siteId) {
        this.siteId = siteId;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getPathFromRoot() {
        return pathFromRoot;
    }

    public void setPathFromRoot(String pathFromRoot) {
        this.pathFromRoot = pathFromRoot;
    }

    public String getSettings() {
        return settings;
    }

    public void setSettings(String settings) {
        this.settings = settings;
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
