create table ioauto_dre_subcategories (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    code varchar(80) not null,
    section_code varchar(60) not null,
    name varchar(120) not null,
    entry_type varchar(20) not null,
    is_system boolean not null default false,
    is_locked boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_ioauto_dre_subcategories_company_code unique (company_id, code)
);

create index idx_ioauto_dre_subcategories_company_section
    on ioauto_dre_subcategories (company_id, section_code, sort_order asc, name asc);

alter table ioauto_financial_entries
    add column dre_subcategory_id uuid references ioauto_dre_subcategories(id) on delete set null;

create index idx_ioauto_financial_entries_company_dre_subcategory
    on ioauto_financial_entries (company_id, dre_subcategory_id);
