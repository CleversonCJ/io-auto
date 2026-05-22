alter table ioauto_vehicles
    add column if not exists is_consigned boolean not null default false;

alter table ioauto_vehicles
    add column if not exists consigned_owner_name varchar(200);

alter table ioauto_vehicles
    add column if not exists consignment_commission_percentage numeric(7,4);

alter table ioauto_vehicles
    add constraint chk_ioauto_vehicles_consignment_commission_percentage
        check (consignment_commission_percentage is null or (consignment_commission_percentage >= 0 and consignment_commission_percentage <= 100));

create index if not exists idx_ioauto_vehicles_company_is_consigned
    on ioauto_vehicles (company_id, is_consigned);

alter table atendimento_sessions
    add column if not exists sale_is_consigned boolean not null default false;

alter table atendimento_sessions
    add column if not exists sale_consigned_owner_name varchar(200);

alter table atendimento_sessions
    add column if not exists sale_consignment_commission_type varchar(20);

alter table atendimento_sessions
    add column if not exists sale_consignment_commission_percentage numeric(7,4);

alter table atendimento_sessions
    add column if not exists sale_consignment_commission_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_consignment_base_amount_cents bigint;

alter table atendimento_sessions
    add column if not exists sale_consignment_owner_transfer_amount_cents bigint;

alter table atendimento_sessions
    add constraint chk_atendimento_sessions_sale_consignment_commission_type
        check (
            sale_consignment_commission_type is null
            or sale_consignment_commission_type in ('PERCENTUAL', 'VALOR_FIXO')
        );

alter table atendimento_sessions
    add constraint chk_atendimento_sessions_sale_consignment_commission_percentage
        check (
            sale_consignment_commission_percentage is null
            or (sale_consignment_commission_percentage >= 0 and sale_consignment_commission_percentage <= 100)
        );
