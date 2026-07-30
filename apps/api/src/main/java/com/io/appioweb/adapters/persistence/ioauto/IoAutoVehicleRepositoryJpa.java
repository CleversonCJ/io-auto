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

    List<JpaIoAutoVehicleEntity> findAllByCompanyIdOrderByUpdatedAtDesc(UUID companyId);
    Optional<JpaIoAutoVehicleEntity> findByIdAndCompanyId(UUID id, UUID companyId);

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
            order by vehicle.updated_at desc
            """, nativeQuery = true)
    List<InventoryVehicleSummary> findInventorySummariesByCompanyId(@Param("companyId") UUID companyId);

    @Query(value = """
            select vehicle.id as "id",
                   vehicle.title as "title",
                   vehicle.status as "status"
            from ioauto_vehicles vehicle
            where vehicle.company_id = :companyId
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
