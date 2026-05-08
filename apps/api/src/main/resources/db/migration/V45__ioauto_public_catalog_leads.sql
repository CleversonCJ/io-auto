create table ioauto_public_catalog_leads (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    vehicle_id uuid references ioauto_vehicles(id) on delete set null,
    customer_name varchar(160) not null,
    customer_phone varchar(20) not null,
    source_type varchar(40),
    source_reference varchar(160),
    page_path varchar(255),
    source_url text,
    session_id varchar(120),
    created_at timestamptz not null default now()
);

create index idx_ioauto_public_catalog_leads_company_created
    on ioauto_public_catalog_leads (company_id, created_at desc);

create index idx_ioauto_public_catalog_leads_company_phone
    on ioauto_public_catalog_leads (company_id, customer_phone, created_at desc);
