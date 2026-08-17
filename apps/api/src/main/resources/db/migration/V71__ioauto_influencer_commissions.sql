alter table ioauto_public_links
    add column if not exists commission_percentage numeric(7,4);

alter table ioauto_public_catalog_leads
    add column if not exists public_link_id uuid;

alter table ioauto_public_catalog_leads
    add column if not exists influencer_name varchar(160);

alter table atendimento_sessions
    add column if not exists sale_influencer_public_link_id uuid;

alter table atendimento_sessions
    add column if not exists sale_influencer_name varchar(160);

alter table atendimento_sessions
    add column if not exists sale_influencer_commission_percentage numeric(7,4);

alter table atendimento_sessions
    add column if not exists sale_influencer_commission_amount_cents bigint;

create index if not exists idx_atendimento_sessions_company_influencer_link
    on atendimento_sessions (company_id, sale_influencer_public_link_id, sale_completed_at desc)
    where sale_completed = true and sale_influencer_public_link_id is not null;

create index if not exists idx_ioauto_public_catalog_leads_company_public_link
    on ioauto_public_catalog_leads (company_id, public_link_id, created_at desc)
    where public_link_id is not null;
