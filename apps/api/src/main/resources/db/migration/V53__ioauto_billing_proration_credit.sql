alter table ioauto_billing_subscriptions
    add column if not exists pending_proration_credit_cents bigint;

alter table ioauto_billing_subscriptions
    add column if not exists pending_proration_credit_note varchar(255);

alter table ioauto_billing_subscriptions
    add column if not exists pending_proration_credit_updated_at timestamp with time zone;
