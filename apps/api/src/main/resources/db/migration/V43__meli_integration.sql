alter table ioauto_vehicles
    add column if not exists meli_category_id varchar(50),
    add column if not exists meli_listing_type_id varchar(50),
    add column if not exists meli_condition varchar(20),
    add column if not exists meli_seller_sku varchar(100),
    add column if not exists meli_title varchar(255),
    add column if not exists meli_description text,
    add column if not exists meli_price_cents bigint,
    add column if not exists meli_attributes_json jsonb not null default '[]'::jsonb;

create table if not exists meli_accounts (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    meli_user_id bigint not null,
    nickname varchar(255),
    site_id varchar(10) not null default 'MLB',
    access_token text not null,
    refresh_token text not null,
    token_type varchar(50),
    expires_in integer,
    token_expires_at timestamptz,
    scope text,
    active boolean not null default true,
    connected_at timestamptz,
    updated_at timestamptz not null default now(),
    disconnected_at timestamptz
);

create unique index if not exists uq_meli_accounts_company
    on meli_accounts (company_id);

create index if not exists idx_meli_accounts_user
    on meli_accounts (meli_user_id);

create table if not exists meli_ads (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    vehicle_id uuid not null references ioauto_vehicles(id) on delete cascade,
    meli_item_id varchar(50),
    seller_sku varchar(100) not null,
    category_id varchar(50),
    listing_type_id varchar(50),
    title varchar(255),
    permalink text,
    status varchar(50),
    sub_status jsonb,
    price numeric(12,2),
    currency_id varchar(10) not null default 'BRL',
    last_payload jsonb,
    last_response jsonb,
    last_error jsonb,
    published_at timestamptz,
    paused_at timestamptz,
    closed_at timestamptz,
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_meli_ads_company_vehicle
    on meli_ads (company_id, vehicle_id);

create unique index if not exists uq_meli_ads_company_seller_sku
    on meli_ads (company_id, seller_sku);

create unique index if not exists uq_meli_ads_company_item
    on meli_ads (company_id, meli_item_id);

create index if not exists idx_meli_ads_status
    on meli_ads (status, updated_at asc);

create table if not exists meli_categories (
    id uuid primary key,
    site_id varchar(10) not null,
    category_id varchar(50) not null,
    name varchar(255) not null,
    parent_id varchar(50),
    path_from_root jsonb,
    settings jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_meli_categories_site_category
    on meli_categories (site_id, category_id);

create table if not exists meli_category_attributes (
    id uuid primary key,
    category_id varchar(50) not null,
    attribute_id varchar(100) not null,
    name varchar(255) not null,
    value_type varchar(50),
    required boolean not null default false,
    catalog_required boolean not null default false,
    allowed_values jsonb,
    raw jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_meli_category_attributes
    on meli_category_attributes (category_id, attribute_id);

create table if not exists meli_webhook_events (
    id uuid primary key,
    company_id uuid references companies(id) on delete set null,
    user_id bigint,
    topic varchar(80),
    resource text,
    application_id bigint,
    attempts integer,
    sent_at timestamptz,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed boolean not null default false,
    processed_at timestamptz,
    error text
);

create index if not exists idx_meli_webhook_events_processed
    on meli_webhook_events (processed, received_at asc);

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
select gen_random_uuid(), c.id, 'mercadolivre', 'Mercado Livre', 'CONFIGURATION_REQUIRED', '{}', now(), now()
from companies c
where not exists (
    select 1
    from ioauto_integrations i
    where i.company_id = c.id
      and i.provider_key = 'mercadolivre'
);
