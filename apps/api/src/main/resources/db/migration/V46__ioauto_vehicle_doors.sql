alter table ioauto_vehicles
    add column if not exists doors integer;

update ioauto_vehicles
set doors = case
    when lower(coalesce(body_type, '')) in ('coupe', 'cupe', 'conversivel', 'convertible', 'cabine simples', 'cabine-simples', 'single cab', 'roadster') then 2
    when nullif(trim(coalesce(body_type, '')), '') is not null then 4
    else doors
end
where doors is null;
