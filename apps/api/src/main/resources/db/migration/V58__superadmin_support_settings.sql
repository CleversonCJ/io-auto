create table if not exists superadmin_settings (
    setting_key varchar(120) primary key,
    setting_value text,
    updated_at timestamptz not null default now()
);
