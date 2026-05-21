alter table ioauto_subscription_plans
    add column if not exists checkout_url text,
    add column if not exists checkout_reference varchar(180),
    add column if not exists checkout_expires_at timestamp,
    add column if not exists checkout_created_at timestamp;
