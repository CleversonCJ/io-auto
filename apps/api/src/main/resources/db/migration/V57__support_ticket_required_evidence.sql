alter table support_tickets
    add column if not exists evidence_file_name varchar(255),
    add column if not exists evidence_content_type varchar(120),
    add column if not exists evidence_data_url text;
