create index if not exists idx_atendimento_messages_company_conversation_created_at
    on atendimento_messages (company_id, conversation_id, created_at desc);

create index if not exists idx_atendimento_messages_unread_lookup
    on atendimento_messages (company_id, conversation_id, created_at)
    where from_me = false;

create index if not exists idx_atendimento_sessions_latest_completed
    on atendimento_sessions (company_id, conversation_id, completed_at desc, arrived_at desc)
    where completed_at is not null;
