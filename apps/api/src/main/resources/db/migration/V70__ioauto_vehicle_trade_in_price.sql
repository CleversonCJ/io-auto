alter table ioauto_vehicles
    add column if not exists trade_in_price_cents bigint;

alter table ioauto_vehicles
    add constraint chk_ioauto_vehicles_trade_in_price
        check (trade_in_price_cents is null or trade_in_price_cents > 0);
