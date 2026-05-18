alter table companies
    add column if not exists pending_plan_change_notice_json text;

alter table companies
    add column if not exists pending_plan_change_notice_created_at timestamp with time zone;
