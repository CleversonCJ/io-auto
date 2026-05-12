create table if not exists ioauto_subscription_plans (
    id uuid primary key,
    plan_key varchar(80) not null unique,
    plan_name varchar(160) not null,
    description text,
    billing_recurrence varchar(20),
    price_cents bigint,
    is_custom boolean not null default false,
    is_system boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    users_limit integer,
    vehicles_limit integer,
    active_ads_limit integer,
    feature_catalog_bio_link boolean not null default false,
    feature_whatsapp_sharing boolean not null default false,
    feature_storefront_page boolean not null default false,
    feature_webmotors boolean not null default false,
    feature_olx boolean not null default false,
    feature_icarros boolean not null default false,
    feature_crm_kanban boolean not null default false,
    feature_lead_management boolean not null default false,
    feature_finance boolean not null default false,
    feature_reports boolean not null default false,
    feature_trackable_links boolean not null default false,
    feature_multiunits boolean not null default false,
    feature_advanced_multiuser boolean not null default false,
    feature_executive_dashboard boolean not null default false,
    feature_integrations_api boolean not null default false,
    feature_assisted_onboarding boolean not null default false,
    feature_priority_support boolean not null default false,
    feature_customizations boolean not null default false,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

insert into ioauto_subscription_plans (
    id,
    plan_key,
    plan_name,
    description,
    billing_recurrence,
    price_cents,
    is_custom,
    is_system,
    is_active,
    sort_order,
    users_limit,
    vehicles_limit,
    active_ads_limit,
    feature_catalog_bio_link,
    feature_whatsapp_sharing,
    feature_storefront_page,
    feature_webmotors,
    feature_olx,
    feature_icarros,
    feature_crm_kanban,
    feature_lead_management,
    feature_finance,
    feature_reports,
    feature_trackable_links,
    feature_multiunits,
    feature_advanced_multiuser,
    feature_executive_dashboard,
    feature_integrations_api,
    feature_assisted_onboarding,
    feature_priority_support,
    feature_customizations
) values
(
    'f4a4d0d1-63e2-4ee9-9e45-3f7d3a1f4b10',
    'start',
    'Start',
    'Entrada ideal para lojistas menores.',
    'MONTHLY',
    19700,
    false,
    true,
    true,
    10,
    3,
    20,
    20,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false
),
(
    '6794641d-6f64-4f69-a85e-b4458f15ae1a',
    'pro',
    'Pro',
    'Plano principal para revendas em crescimento.',
    'MONTHLY',
    34700,
    false,
    true,
    true,
    20,
    10,
    50,
    50,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false
),
(
    '9cf24673-4f77-4b9f-8993-6f5aac4cfe16',
    'personalizado',
    'Personalizado',
    'Proposta sob medida para operacoes de maior escala.',
    null,
    null,
    true,
    true,
    true,
    30,
    null,
    null,
    null,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
)
on conflict (id) do update
set
    plan_key = excluded.plan_key,
    plan_name = excluded.plan_name,
    description = excluded.description,
    billing_recurrence = excluded.billing_recurrence,
    price_cents = excluded.price_cents,
    is_custom = excluded.is_custom,
    is_system = excluded.is_system,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    users_limit = excluded.users_limit,
    vehicles_limit = excluded.vehicles_limit,
    active_ads_limit = excluded.active_ads_limit,
    feature_catalog_bio_link = excluded.feature_catalog_bio_link,
    feature_whatsapp_sharing = excluded.feature_whatsapp_sharing,
    feature_storefront_page = excluded.feature_storefront_page,
    feature_webmotors = excluded.feature_webmotors,
    feature_olx = excluded.feature_olx,
    feature_icarros = excluded.feature_icarros,
    feature_crm_kanban = excluded.feature_crm_kanban,
    feature_lead_management = excluded.feature_lead_management,
    feature_finance = excluded.feature_finance,
    feature_reports = excluded.feature_reports,
    feature_trackable_links = excluded.feature_trackable_links,
    feature_multiunits = excluded.feature_multiunits,
    feature_advanced_multiuser = excluded.feature_advanced_multiuser,
    feature_executive_dashboard = excluded.feature_executive_dashboard,
    feature_integrations_api = excluded.feature_integrations_api,
    feature_assisted_onboarding = excluded.feature_assisted_onboarding,
    feature_priority_support = excluded.feature_priority_support,
    feature_customizations = excluded.feature_customizations,
    updated_at = now();

update companies c
set plan_id = null
where c.plan_id is not null
  and not exists (
    select 1
    from ioauto_subscription_plans p
    where p.id = c.plan_id
  );

with latest_billing as (
    select distinct on (b.company_id)
        b.company_id,
        upper(coalesce(b.plan_key, '')) as plan_key,
        upper(coalesce(b.plan_name, '')) as plan_name
    from ioauto_billing_subscriptions b
    order by b.company_id, b.updated_at desc
)
update companies c
set
    plan_id = case
        when lb.plan_key like '%PRO%' or lb.plan_name like '%PRO%' then '6794641d-6f64-4f69-a85e-b4458f15ae1a'::uuid
        when lb.plan_key like '%PERSON%' or lb.plan_name like '%PERSON%'
          or lb.plan_key like '%CUSTOM%' or lb.plan_name like '%CUSTOM%'
          or lb.plan_key like '%ENTERPRISE%' or lb.plan_name like '%ENTERPRISE%'
          or lb.plan_key like '%SCALE%' or lb.plan_name like '%SCALE%'
            then '9cf24673-4f77-4b9f-8993-6f5aac4cfe16'::uuid
        else 'f4a4d0d1-63e2-4ee9-9e45-3f7d3a1f4b10'::uuid
    end,
    updated_at = now()
from latest_billing lb
where c.id = lb.company_id
  and c.plan_id is null;

update companies
set
    plan_id = 'f4a4d0d1-63e2-4ee9-9e45-3f7d3a1f4b10'::uuid,
    updated_at = now()
where plan_id is null;

do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where table_name = 'companies'
          and constraint_name = 'fk_companies_plan_id'
    ) then
        alter table companies
            add constraint fk_companies_plan_id
            foreign key (plan_id) references ioauto_subscription_plans(id);
    end if;
end $$;

create index if not exists idx_companies_plan_id on companies(plan_id);
