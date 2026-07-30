alter table ioauto_public_links
    add column use_company_whatsapp boolean not null default true,
    add column whatsapp_number varchar(20);

