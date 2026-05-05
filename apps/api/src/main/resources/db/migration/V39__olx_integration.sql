alter table ioauto_vehicles
    add column if not exists plate varchar(12),
    add column if not exists contact_phone varchar(20),
    add column if not exists zipcode varchar(12),
    add column if not exists olx_brand_id varchar(50),
    add column if not exists olx_model_id varchar(50),
    add column if not exists olx_version_id varchar(50),
    add column if not exists olx_fuel_code varchar(20),
    add column if not exists olx_gearbox_code varchar(20),
    add column if not exists olx_doors_code varchar(20),
    add column if not exists olx_color_code varchar(20),
    add column if not exists olx_feature_codes_json text not null default '[]';

create table olx_accounts (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    access_token text not null,
    token_type varchar(50),
    scope varchar(255),
    olx_user_name varchar(255),
    olx_user_email varchar(255),
    webhook_notification_id varchar(255),
    connected_at timestamptz,
    updated_at timestamptz not null default now(),
    disconnected_at timestamptz,
    active boolean not null default true
);

create unique index uq_olx_accounts_company
    on olx_accounts (company_id);

create table olx_ads (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    vehicle_id uuid not null references ioauto_vehicles(id) on delete cascade,
    local_ad_id varchar(19) not null,
    olx_list_id varchar(255),
    olx_url text,
    import_token varchar(255),
    operation varchar(30),
    status varchar(80),
    last_status_message text,
    last_payload jsonb,
    last_response jsonb,
    published_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_olx_ads_company_vehicle
    on olx_ads (company_id, vehicle_id);

create unique index uq_olx_ads_company_local_ad
    on olx_ads (company_id, local_ad_id);

create index idx_olx_ads_status
    on olx_ads (status, updated_at asc);

create unique index uq_olx_ads_list_id
    on olx_ads (olx_list_id)
    where olx_list_id is not null;

create table olx_catalog_brands (
    id uuid primary key,
    olx_brand_id varchar(50) not null,
    name varchar(255) not null,
    type varchar(20) not null default 'CAR',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_olx_catalog_brands
    on olx_catalog_brands (olx_brand_id, type);

create table olx_catalog_models (
    id uuid primary key,
    olx_brand_id varchar(50) not null,
    olx_model_id varchar(50) not null,
    name varchar(255) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_olx_catalog_models
    on olx_catalog_models (olx_brand_id, olx_model_id);

create index idx_olx_catalog_models_brand
    on olx_catalog_models (olx_brand_id, name);

create table olx_catalog_versions (
    id uuid primary key,
    olx_brand_id varchar(50) not null,
    olx_model_id varchar(50) not null,
    olx_version_id varchar(50) not null,
    name varchar(255) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_olx_catalog_versions
    on olx_catalog_versions (olx_brand_id, olx_model_id, olx_version_id);

create index idx_olx_catalog_versions_model
    on olx_catalog_versions (olx_brand_id, olx_model_id, name);

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
select gen_random_uuid(), c.id, 'olx', 'OLX / Publicacao de Veiculos', 'CONFIGURATION_REQUIRED', '{}', now(), now()
from companies c
where not exists (
    select 1
    from ioauto_integrations i
    where i.company_id = c.id
      and i.provider_key = 'olx'
);
