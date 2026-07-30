alter table atendimento_conversations
    add column contact_display_phone varchar(30),
    add column contact_description text;

create table atendimento_label_catalog (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    external_id varchar(120) not null,
    title varchar(180) not null,
    color varchar(7) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_atendimento_label_catalog_company_external
    on atendimento_label_catalog (company_id, external_id);

create unique index uq_atendimento_label_catalog_company_title
    on atendimento_label_catalog (company_id, lower(title));

create index idx_atendimento_label_catalog_company_updated
    on atendimento_label_catalog (company_id, updated_at desc);

insert into atendimento_label_catalog (id, company_id, external_id, title, color, created_at, updated_at)
select
    gen_random_uuid(),
    latest.company_id,
    latest.label_id,
    latest.label_title,
    coalesce(nullif(latest.label_color, ''), '#64748B'),
    latest.created_at,
    latest.updated_at
from (
    select distinct on (company_id, label_id)
        company_id,
        label_id,
        label_title,
        label_color,
        created_at,
        updated_at
    from atendimento_session_labels
    order by company_id, label_id, updated_at desc
) latest
on conflict do nothing;

create table atendimento_classification_catalog (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    external_id varchar(120) not null,
    title varchar(180) not null,
    category_id varchar(30) not null,
    has_value boolean not null default false,
    value numeric(14, 2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_atendimento_classification_catalog_category
        check (category_id in ('achieved', 'lost', 'questions', 'other'))
);

create unique index uq_atendimento_classification_catalog_company_external
    on atendimento_classification_catalog (company_id, external_id);

create unique index uq_atendimento_classification_catalog_company_title_category
    on atendimento_classification_catalog (company_id, lower(title), category_id);

create index idx_atendimento_classification_catalog_company_updated
    on atendimento_classification_catalog (company_id, updated_at desc);

create table atendimento_conversation_events (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    conversation_id uuid not null references atendimento_conversations(id) on delete cascade,
    event_type varchar(40) not null,
    event_text varchar(500) not null,
    actor_user_id uuid references users(id) on delete set null,
    actor_user_name varchar(180),
    event_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index idx_atendimento_conversation_events_timeline
    on atendimento_conversation_events (company_id, conversation_id, event_at asc);

create table atendimento_conversation_read_states (
    id uuid primary key,
    company_id uuid not null references companies(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    conversation_id uuid not null references atendimento_conversations(id) on delete cascade,
    last_read_message_id uuid references atendimento_messages(id) on delete set null,
    last_read_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index uq_atendimento_conversation_read_states_scope
    on atendimento_conversation_read_states (company_id, user_id, conversation_id);

create index idx_atendimento_conversation_read_states_user
    on atendimento_conversation_read_states (company_id, user_id, updated_at desc);
