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
@Table(name = "meli_category_attributes")
public class JpaMeliCategoryAttributeEntity {

    @Id
    private UUID id;

    @Column(name = "category_id", nullable = false, length = 50)
    private String categoryId;

    @Column(name = "attribute_id", nullable = false, length = 100)
    private String attributeId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "value_type", length = 50)
    private String valueType;

    @Column(nullable = false)
    private boolean required;

    @Column(name = "catalog_required", nullable = false)
    private boolean catalogRequired;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "allowed_values", columnDefinition = "jsonb")
    private String allowedValues;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String raw;

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

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getAttributeId() {
        return attributeId;
    }

    public void setAttributeId(String attributeId) {
        this.attributeId = attributeId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getValueType() {
        return valueType;
    }

    public void setValueType(String valueType) {
        this.valueType = valueType;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public boolean isCatalogRequired() {
        return catalogRequired;
    }

    public void setCatalogRequired(boolean catalogRequired) {
        this.catalogRequired = catalogRequired;
    }

    public String getAllowedValues() {
        return allowedValues;
    }

    public void setAllowedValues(String allowedValues) {
        this.allowedValues = allowedValues;
    }

    public String getRaw() {
        return raw;
    }

    public void setRaw(String raw) {
        this.raw = raw;
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
