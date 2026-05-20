alter table companies
    add column if not exists manual_checkout_url text;

alter table companies
    add column if not exists manual_checkout_reference varchar(180);

alter table companies
    add column if not exists manual_checkout_expires_at timestamptz;

alter table companies
    add column if not exists manual_checkout_created_at timestamptz;
