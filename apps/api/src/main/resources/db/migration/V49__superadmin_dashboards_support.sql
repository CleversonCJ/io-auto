-- Superadmin dashboards, support tickets and tenant management data model.

alter table companies
    add column if not exists subscription_amount_cents bigint,
    add column if not exists billing_recurrence varchar(20),
    add column if not exists subscription_started_at timestamptz,
    add column if not exists subscription_canceled_at timestamptz,
    add column if not exists subscription_status varchar(30),
    add column if not exists plan_id uuid,
    add column if not exists origin_source varchar(255),
    add column if not exists last_access_at timestamptz,
    add column if not exists blocked_at timestamptz;

with latest_billing as (
    select distinct on (s.company_id)
        s.company_id,
        s.amount_cents,
        s.billing_interval,
        s.status,
        s.created_at,
        s.updated_at
    from ioauto_billing_subscriptions s
    order by s.company_id, s.updated_at desc
)
update companies c
set
    subscription_amount_cents = coalesce(c.subscription_amount_cents, lb.amount_cents),
    billing_recurrence = coalesce(
        c.billing_recurrence,
        case
            when upper(coalesce(lb.billing_interval, '')) in ('ANNUAL', 'YEARLY', 'YEAR') then 'ANNUAL'
            when upper(coalesce(lb.billing_interval, '')) in ('MONTHLY', 'MONTH') then 'MONTHLY'
            else null
        end
    ),
    subscription_started_at = coalesce(c.subscription_started_at, lb.created_at, c.created_at),
    subscription_status = coalesce(
        c.subscription_status,
        case
            when upper(coalesce(c.status, '')) = 'BLOCKED' then 'BLOCKED'
            when upper(coalesce(lb.status, '')) in ('CANCELED', 'CANCELLED') then 'CANCELED'
            when upper(coalesce(lb.status, '')) in ('OVERDUE', 'PAST_DUE', 'PAYMENT_FAILED', 'FAILED') then 'OVERDUE'
            when upper(coalesce(lb.status, '')) in ('TRIAL', 'PENDING', 'INACTIVE') then 'TRIAL'
            when upper(coalesce(lb.status, '')) = 'BLOCKED' then 'BLOCKED'
            when upper(coalesce(lb.status, '')) = 'ACTIVE' then 'ACTIVE'
            else null
        end
    ),
    subscription_canceled_at = coalesce(
        c.subscription_canceled_at,
        case
            when upper(coalesce(lb.status, '')) in ('CANCELED', 'CANCELLED') then lb.updated_at
            else null
        end
    )
from latest_billing lb
where c.id = lb.company_id;

with latest_onboarding as (
    select distinct on (s.company_id)
        s.company_id,
        s.valor,
        s.recorrencia,
        s.data_assinatura,
        s.origem,
        s.status,
        s.updated_at
    from onboarding_subscriptions s
    order by s.company_id, s.updated_at desc
)
update companies c
set
    subscription_amount_cents = coalesce(
        c.subscription_amount_cents,
        case
            when lo.valor is null then null
            else round(lo.valor * 100)::bigint
        end
    ),
    billing_recurrence = coalesce(
        c.billing_recurrence,
        case
            when lower(coalesce(lo.recorrencia, '')) like '%an%' then 'ANNUAL'
            when lower(coalesce(lo.recorrencia, '')) like '%month%' then 'MONTHLY'
            when lower(coalesce(lo.recorrencia, '')) like '%mensal%' then 'MONTHLY'
            else null
        end
    ),
    subscription_started_at = coalesce(c.subscription_started_at, lo.data_assinatura::timestamptz, c.created_at),
    origin_source = coalesce(nullif(c.origin_source, ''), nullif(lo.origem, '')),
    subscription_status = coalesce(
        c.subscription_status,
        case
            when upper(coalesce(c.status, '')) = 'BLOCKED' then 'BLOCKED'
            when upper(coalesce(lo.status, '')) in ('CANCELED', 'CANCELLED') then 'CANCELED'
            when upper(coalesce(lo.status, '')) in ('OVERDUE', 'PAST_DUE', 'PAYMENT_FAILED', 'FAILED') then 'OVERDUE'
            when upper(coalesce(lo.status, '')) in ('TRIAL', 'PENDING', 'INACTIVE') then 'TRIAL'
            when upper(coalesce(lo.status, '')) = 'BLOCKED' then 'BLOCKED'
            when upper(coalesce(lo.status, '')) = 'ACTIVE' then 'ACTIVE'
            else null
        end
    ),
    subscription_canceled_at = coalesce(
        c.subscription_canceled_at,
        case
            when upper(coalesce(lo.status, '')) in ('CANCELED', 'CANCELLED') then lo.updated_at
            else null
        end
    )
from latest_onboarding lo
where c.id = lo.company_id;

update companies
set subscription_status = coalesce(nullif(subscription_status, ''), 'ACTIVE');

update companies
set billing_recurrence = coalesce(nullif(billing_recurrence, ''), 'MONTHLY')
where subscription_amount_cents is not null;

update companies
set origin_source = 'direct'
where origin_source is null or btrim(origin_source) = '';

update companies
set last_access_at = coalesce(last_access_at, updated_at, created_at);

create index if not exists idx_companies_subscription_status
    on companies (subscription_status);

create index if not exists idx_companies_subscription_started_at
    on companies (subscription_started_at);

create index if not exists idx_companies_subscription_canceled_at
    on companies (subscription_canceled_at);

create index if not exists idx_companies_billing_recurrence
    on companies (billing_recurrence);

create index if not exists idx_companies_plan_id
    on companies (plan_id);

create index if not exists idx_companies_last_access_at
    on companies (last_access_at);

create table if not exists feature_usage_events (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    feature_key varchar(80) not null,
    occurred_at timestamptz not null default now(),
    metadata jsonb
);

create index if not exists idx_feature_usage_events_company_occurred
    on feature_usage_events (company_id, occurred_at desc);

create index if not exists idx_feature_usage_events_feature_occurred
    on feature_usage_events (feature_key, occurred_at desc);

alter table ioauto_public_catalog_leads
    add column if not exists seller_user_id uuid references users(id) on delete set null,
    add column if not exists vehicle_interest_name varchar(200),
    add column if not exists origin_source varchar(255),
    add column if not exists converted_to_sale boolean not null default false,
    add column if not exists converted_sale_id uuid;

update ioauto_public_catalog_leads
set
    vehicle_interest_name = coalesce(vehicle_interest_name, customer_name),
    origin_source = coalesce(nullif(origin_source, ''), nullif(source_type, ''), 'CATALOG')
where vehicle_interest_name is null
   or origin_source is null
   or btrim(origin_source) = '';

create index if not exists idx_ioauto_public_catalog_leads_origin
    on ioauto_public_catalog_leads (company_id, origin_source, created_at desc);

alter table atendimento_sessions
    add column if not exists sale_origin_platform varchar(40);

create index if not exists idx_atendimento_sessions_sale_origin
    on atendimento_sessions (company_id, sale_origin_platform, sale_completed_at desc);

alter table ioauto_vehicle_publications
    add column if not exists platform varchar(60);

update ioauto_vehicle_publications
set platform = case
    when lower(coalesce(provider_key, '')) in ('mercadolivre', 'meli', 'mercado_livre') then 'MERCADO_LIVRE'
    when lower(coalesce(provider_key, '')) = 'olx' then 'OLX'
    when lower(coalesce(provider_key, '')) = 'webmotors' then 'WEBMOTORS'
    when lower(coalesce(provider_key, '')) in ('site', 'site_proprio') then 'SITE_PROPRIO'
    else upper(coalesce(provider_key, 'OUTRA'))
end
where platform is null or btrim(platform) = '';

create index if not exists idx_ioauto_vehicle_publications_platform_status
    on ioauto_vehicle_publications (platform, status, updated_at desc);

create table if not exists support_tickets (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    opened_by_user_id uuid references users(id) on delete set null,
    title varchar(220) not null,
    description text not null,
    category varchar(40) not null,
    urgency varchar(20) not null,
    status varchar(30) not null default 'OPEN',
    bug_area varchar(120),
    created_at timestamptz not null default now(),
    first_response_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz,
    updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_company_status
    on support_tickets (company_id, status, created_at desc);

create index if not exists idx_support_tickets_company_category
    on support_tickets (company_id, category, created_at desc);

create table if not exists support_ticket_messages (
    id uuid primary key,
    ticket_id uuid not null references support_tickets(id) on delete cascade,
    sender_user_id uuid references users(id) on delete set null,
    sender_type varchar(20) not null,
    message text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticket_created
    on support_ticket_messages (ticket_id, created_at asc);

create table if not exists tenant_admin_logs (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    actor_user_id uuid references users(id) on delete set null,
    action varchar(120) not null,
    description text,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_tenant_admin_logs_company_created
    on tenant_admin_logs (company_id, created_at desc);

create index if not exists idx_tenant_admin_logs_actor_created
    on tenant_admin_logs (actor_user_id, created_at desc);
