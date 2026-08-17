alter table if exists atendimento_label_catalog rename to crm_label_catalog;

drop table if exists atendimento_classification_catalog;

drop index if exists idx_atendimento_sessions_company_classification;

alter table atendimento_sessions
    drop constraint if exists chk_atendimento_sessions_classification_result,
    drop column if exists classification_result,
    drop column if exists classification_label;

drop table if exists ai_supervisor_company_config;
drop table if exists ai_supervisor_decision_logs;
drop table if exists ai_supervisor_conversation_state;
drop table if exists ai_supervisor_agent_rules;
drop table if exists ai_supervisors;
drop table if exists ai_agent_kanban_state;
drop table if exists ai_agent_kanban_move_attempts;
drop table if exists ai_agent_stage_rules;
drop table if exists ai_agent_calendar_suggestion_state;
drop table if exists ai_agent_calendar_events;
drop table if exists ai_agent_run_logs;
drop table if exists ai_agent_company_state;
drop table if exists company_google_oauth;
drop table if exists atendimento_conversation_events;
drop table if exists atendimento_conversation_read_states;

update atendimento_conversations
set source_platform = 'LEGACY_CHANNEL'
where upper(coalesce(source_platform, '')) in ('ZAPI', 'WHATSAPP');

drop index if exists idx_atendimento_conversations_company_assigned_agent;
drop index if exists idx_atendimento_conversations_company_handoff;

alter table atendimento_conversations
    drop column if exists assigned_agent_id,
    drop column if exists human_handoff_requested,
    drop column if exists human_handoff_queue,
    drop column if exists human_handoff_requested_at,
    drop column if exists human_user_choice_required,
    drop column if exists human_choice_options_json;

drop index if exists uq_atendimento_messages_company_zapi_message_id;

alter table atendimento_messages
    drop column if exists zapi_message_id;

alter table companies
    drop column if exists zapi_instance_id,
    drop column if exists zapi_instance_token,
    drop column if exists zapi_client_token;
