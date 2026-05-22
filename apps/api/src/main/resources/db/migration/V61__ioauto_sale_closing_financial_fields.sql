alter table atendimento_sessions
    add column if not exists sale_original_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_discount_percentage numeric(7,4);

alter table atendimento_sessions
    add column if not exists sale_discount_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_amount_after_discount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_has_trade_in boolean not null default false;

alter table atendimento_sessions
    add column if not exists sale_trade_in_vehicle_id uuid references ioauto_vehicles(id) on delete set null;

alter table atendimento_sessions
    add column if not exists sale_trade_in_description varchar(255);

alter table atendimento_sessions
    add column if not exists sale_trade_in_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_total_real_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_installment_sale boolean not null default false;

alter table atendimento_sessions
    add column if not exists sale_installment_count integer;

alter table atendimento_sessions
    add column if not exists sale_first_due_date date;

create index if not exists idx_atendimento_sessions_company_sale_trade_in_vehicle
    on atendimento_sessions (company_id, sale_trade_in_vehicle_id);

alter table ioauto_financial_entries
    add column if not exists source_kind varchar(40);

alter table ioauto_financial_entries
    add column if not exists source_sale_session_id uuid references atendimento_sessions(id) on delete set null;

alter table ioauto_financial_entries
    add column if not exists source_vehicle_id uuid references ioauto_vehicles(id) on delete set null;

alter table ioauto_financial_entries
    add column if not exists installment_number integer;

alter table ioauto_financial_entries
    add column if not exists installment_total integer;

alter table ioauto_financial_entries
    add column if not exists installment_status varchar(30);

create index if not exists idx_ioauto_financial_entries_company_source_kind
    on ioauto_financial_entries (company_id, source_kind);

create index if not exists idx_ioauto_financial_entries_company_sale_session
    on ioauto_financial_entries (company_id, source_sale_session_id);

create index if not exists idx_ioauto_financial_entries_company_source_vehicle
    on ioauto_financial_entries (company_id, source_vehicle_id);
