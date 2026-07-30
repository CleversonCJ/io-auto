create index if not exists idx_ioauto_public_lead_events_link_summary
    on ioauto_public_lead_events (company_id, source_type, source_reference, event_type, created_at desc);
