alter table companies
    add column public_stock_banner_mode varchar(30) not null default 'VEHICLES',
    add column public_stock_banner_images_json text not null default '[]';
