alter table meli_accounts
    add column if not exists full_name varchar(255),
    add column if not exists profile_image_url text;
