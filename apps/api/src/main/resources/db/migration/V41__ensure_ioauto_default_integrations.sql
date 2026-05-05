insert into ioauto_integrations (
    id,
    company_id,
    provider_key,
    display_name,
    status,
    settings_json,
    created_at,
    updated_at
)
select gen_random_uuid(), c.id, 'webmotors', 'Webmotors / Estoque e Leads', 'CONFIGURATION_REQUIRED', '{}', now(), now()
from companies c
where not exists (
    select 1
    from ioauto_integrations i
    where i.company_id = c.id
      and i.provider_key = 'webmotors'
);

insert into ioauto_integrations (
    id,
    company_id,
    provider_key,
    display_name,
    status,
    settings_json,
    created_at,
    updated_at
)
select gen_random_uuid(), c.id, 'olx', 'OLX', 'CONFIGURATION_REQUIRED', '{}', now(), now()
from companies c
where not exists (
    select 1
    from ioauto_integrations i
    where i.company_id = c.id
      and i.provider_key = 'olx'
);
