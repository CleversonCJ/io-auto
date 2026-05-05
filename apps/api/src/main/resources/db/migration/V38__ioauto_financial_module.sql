create table ioauto_financial_entries (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    description varchar(200) not null,
    entry_type varchar(20) not null,
    category varchar(40) not null,
    amount_cents bigint not null,
    due_date date,
    settled_at timestamptz,
    counterparty varchar(180),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_ioauto_financial_entries_company_due_date
    on ioauto_financial_entries (company_id, due_date asc, updated_at desc);
