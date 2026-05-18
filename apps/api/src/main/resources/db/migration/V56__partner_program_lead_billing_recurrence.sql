alter table partner_program_leads
    add column if not exists closed_billing_recurrence varchar(20);
