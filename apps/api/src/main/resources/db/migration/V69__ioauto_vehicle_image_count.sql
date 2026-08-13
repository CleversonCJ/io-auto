alter table ioauto_vehicles
    add column if not exists image_count integer not null default 0;

update ioauto_vehicles vehicle
set image_count = (
    case when nullif(vehicle.cover_image_url, '') is null then 0 else 1 end
    + (
        select count(*)
        from jsonb_array_elements_text(cast(coalesce(nullif(vehicle.gallery_json, ''), '[]') as jsonb)) gallery_image(value)
        where nullif(vehicle.cover_image_url, '') is null
           or gallery_image.value <> vehicle.cover_image_url
    )
);

alter table ioauto_vehicles
    add constraint chk_ioauto_vehicles_image_count
        check (image_count >= 0);
