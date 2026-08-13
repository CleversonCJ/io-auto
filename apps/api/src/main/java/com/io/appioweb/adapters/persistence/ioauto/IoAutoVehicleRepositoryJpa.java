package com.io.appioweb.adapters.persistence.ioauto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IoAutoVehicleRepositoryJpa extends JpaRepository<JpaIoAutoVehicleEntity, UUID> {
    interface InventoryVehicleSummary {
        UUID getId();
        String getStockNumber();
        String getTitle();
        String getBrand();
        String getModel();
        String getVersion();
        String getEngine();
        Integer getYear();
        Integer getModelYear();
        Integer getManufactureYear();
        Long getPriceCents();
        Integer getMileage();
        boolean getConsigned();
        String getConsignedOwnerName();
        BigDecimal getConsignmentCommissionPercentage();
        boolean getFeatured();
        String getStatus();
        boolean getCoverImageAvailable();
        Instant getUpdatedAt();
    }

    interface VehicleOptionSummary {
        UUID getId();
        String getTitle();
        String getStatus();
    }

    interface VehicleEditDetails {
        UUID getId();
        String getStockNumber();
        String getTitle();
        String getBrand();
        String getModel();
        String getVersion();
        String getEngine();
        Integer getYear();
        Integer getModelYear();
        Integer getManufactureYear();
        Long getPriceCents();
        Integer getMileage();
        String getTransmission();
        String getFuelType();
        String getBodyType();
        Integer getDoors();
        String getColor();
        String getPlateFinal();
        String getPlate();
        String getContactPhone();
        String getZipcode();
        String getCity();
        String getState();
        boolean getConsigned();
        String getConsignedOwnerName();
        BigDecimal getConsignmentCommissionPercentage();
        boolean getFeatured();
        String getStatus();
        String getDescription();
        String getOptionalsJson();
        String getFinancingJson();
        String getMeliCategoryId();
        String getMeliListingTypeId();
        String getMeliCondition();
        Integer getImageCount();
        Instant getUpdatedAt();
    }

    @Query("""
            select vehicle
            from JpaIoAutoVehicleEntity vehicle
            where vehicle.companyId = :companyId
              and upper(coalesce(vehicle.status, 'DRAFT')) <> 'REMOVED'
            order by vehicle.updatedAt desc
            """)
    List<JpaIoAutoVehicleEntity> findAllByCompanyIdOrderByUpdatedAtDesc(@Param("companyId") UUID companyId);
    Optional<JpaIoAutoVehicleEntity> findByIdAndCompanyId(UUID id, UUID companyId);
    boolean existsByIdAndCompanyId(UUID id, UUID companyId);
    boolean existsByIdAndCompanyIdAndStatusNotIgnoreCase(UUID id, UUID companyId, String status);

    @Query(value = """
            select vehicle.id as "id",
                   vehicle.stock_number as "stockNumber",
                   vehicle.title as "title",
                   vehicle.brand as "brand",
                   vehicle.model as "model",
                   vehicle.version as "version",
                   vehicle.engine as "engine",
                   coalesce(vehicle.model_year, vehicle.manufacture_year) as "year",
                   vehicle.model_year as "modelYear",
                   vehicle.manufacture_year as "manufactureYear",
                   vehicle.price_cents as "priceCents",
                   vehicle.mileage as "mileage",
                   vehicle.transmission as "transmission",
                   vehicle.fuel_type as "fuelType",
                   vehicle.body_type as "bodyType",
                   vehicle.doors as "doors",
                   vehicle.color as "color",
                   vehicle.plate_final as "plateFinal",
                   vehicle.plate as "plate",
                   vehicle.contact_phone as "contactPhone",
                   vehicle.zipcode as "zipcode",
                   vehicle.city as "city",
                   vehicle.state as "state",
                   vehicle.is_consigned as "consigned",
                   vehicle.consigned_owner_name as "consignedOwnerName",
                   vehicle.consignment_commission_percentage as "consignmentCommissionPercentage",
                   vehicle.featured as "featured",
                   vehicle.status as "status",
                   vehicle.description as "description",
                   vehicle.optionals_json as "optionalsJson",
                   vehicle.financing_json as "financingJson",
                   vehicle.meli_category_id as "meliCategoryId",
                   vehicle.meli_listing_type_id as "meliListingTypeId",
                   vehicle.meli_condition as "meliCondition",
                   vehicle.image_count as "imageCount",
                   vehicle.updated_at as "updatedAt"
            from ioauto_vehicles vehicle
            where vehicle.id = :vehicleId
              and vehicle.company_id = :companyId
              and upper(coalesce(vehicle.status, 'DRAFT')) <> 'REMOVED'
            """, nativeQuery = true)
    Optional<VehicleEditDetails> findEditDetailsByIdAndCompanyId(
            @Param("vehicleId") UUID vehicleId,
            @Param("companyId") UUID companyId
    );

    @Query(value = """
            select vehicle_image.source
            from ioauto_vehicles vehicle
            cross join lateral (
                select ordered_image.source
                from (
                    select vehicle.cover_image_url as source, cast(0 as bigint) as position
                    where nullif(vehicle.cover_image_url, '') is not null
                    union all
                    select gallery_image.value as source, gallery_image.ordinality as position
                    from jsonb_array_elements_text(cast(coalesce(nullif(vehicle.gallery_json, ''), '[]') as jsonb))
                         with ordinality as gallery_image(value, ordinality)
                    where nullif(vehicle.cover_image_url, '') is null
                       or gallery_image.value <> vehicle.cover_image_url
                ) ordered_image
                order by ordered_image.position
                limit 1 offset :imageIndex
            ) vehicle_image
            where vehicle.id = :vehicleId
              and vehicle.company_id = :companyId
            """, nativeQuery = true)
    Optional<String> findImageByIdAndCompanyIdAndIndex(
            @Param("vehicleId") UUID vehicleId,
            @Param("companyId") UUID companyId,
            @Param("imageIndex") int imageIndex
    );

    @Query(value = """
            select vehicle.id as "id",
                   vehicle.stock_number as "stockNumber",
                   vehicle.title as "title",
                   vehicle.brand as "brand",
                   vehicle.model as "model",
                   vehicle.version as "version",
                   vehicle.engine as "engine",
                   coalesce(vehicle.model_year, vehicle.manufacture_year) as "year",
                   vehicle.model_year as "modelYear",
                   vehicle.manufacture_year as "manufactureYear",
                   vehicle.price_cents as "priceCents",
                   vehicle.mileage as "mileage",
                   vehicle.is_consigned as "consigned",
                   vehicle.consigned_owner_name as "consignedOwnerName",
                   vehicle.consignment_commission_percentage as "consignmentCommissionPercentage",
                   vehicle.featured as "featured",
                   vehicle.status as "status",
                   case
                       when vehicle.cover_image_url is not null
                           and octet_length(vehicle.cover_image_url) > 0 then true
                       when vehicle.gallery_json is not null
                           and octet_length(vehicle.gallery_json) > 2 then true
                       else false
                   end as "coverImageAvailable",
                   vehicle.updated_at as "updatedAt"
            from ioauto_vehicles vehicle
            where vehicle.company_id = :companyId
              and upper(coalesce(vehicle.status, 'DRAFT')) <> 'REMOVED'
            order by vehicle.updated_at desc
            """, nativeQuery = true)
    List<InventoryVehicleSummary> findInventorySummariesByCompanyId(@Param("companyId") UUID companyId);

    @Query(value = """
            select vehicle.id as "id",
                   vehicle.title as "title",
                   vehicle.status as "status"
            from ioauto_vehicles vehicle
            where vehicle.company_id = :companyId
              and upper(coalesce(vehicle.status, 'DRAFT')) <> 'REMOVED'
            order by vehicle.title asc
            """, nativeQuery = true)
    List<VehicleOptionSummary> findOptionsByCompanyId(@Param("companyId") UUID companyId);

    @Query("""
            select vehicle.coverImageUrl
            from JpaIoAutoVehicleEntity vehicle
            where vehicle.id = :vehicleId
              and vehicle.companyId = :companyId
            """)
    Optional<String> findCoverImageByIdAndCompanyId(
            @Param("vehicleId") UUID vehicleId,
            @Param("companyId") UUID companyId
    );

    @Query("""
            select vehicle.galleryJson
            from JpaIoAutoVehicleEntity vehicle
            where vehicle.id = :vehicleId
              and vehicle.companyId = :companyId
            """)
    Optional<String> findGalleryJsonByIdAndCompanyId(
            @Param("vehicleId") UUID vehicleId,
            @Param("companyId") UUID companyId
    );

    @Query("""
            select count(v)
            from JpaIoAutoVehicleEntity v
            where v.companyId = :companyId
              and upper(coalesce(v.status, 'DRAFT')) not in ('DRAFT', 'ARCHIVED', 'SOLD', 'REMOVED')
            """)
    long countActiveByCompanyId(@Param("companyId") UUID companyId);
}
