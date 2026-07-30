alter table ioauto_public_links
    add column responsible_user_id uuid references users(id) on delete set null;

create index idx_ioauto_public_links_company_responsible
    on ioauto_public_links (company_id, responsible_user_id);

