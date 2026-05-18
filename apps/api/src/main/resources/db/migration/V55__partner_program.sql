create table partner_program_partners (
    id uuid primary key,
    reference_code varchar(40) not null unique,
    partner_name varchar(160) not null,
    company_name varchar(160),
    whatsapp varchar(30),
    email varchar(180),
    city varchar(120),
    state varchar(2),
    partner_type varchar(80),
    default_commission_bps integer not null default 2500,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_partner_program_partners_status_created
    on partner_program_partners (status, created_at desc);

create table partner_program_leads (
    id uuid primary key,
    partner_id uuid not null references partner_program_partners(id) on delete cascade,
    shopkeeper_name varchar(160) not null,
    store_name varchar(160) not null,
    whatsapp varchar(30) not null,
    email varchar(180),
    city varchar(120),
    state varchar(2),
    approximate_stock integer,
    lead_status varchar(30) not null default 'NEW',
    sales_owner varchar(160),
    notes text,
    closed_plan varchar(120),
    first_monthly_fee_cents bigint,
    closed_at timestamptz,
    commission_cents bigint,
    commission_status varchar(30),
    commission_due_date date,
    commission_paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_partner_program_leads_partner_created
    on partner_program_leads (partner_id, created_at desc);

create index idx_partner_program_leads_status_created
    on partner_program_leads (lead_status, created_at desc);
