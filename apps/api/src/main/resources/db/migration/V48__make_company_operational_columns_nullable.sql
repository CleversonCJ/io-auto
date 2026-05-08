-- Migration to make operational columns nullable in companies table
-- to support the automated onboarding flow.

ALTER TABLE companies ALTER COLUMN business_hours_start DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN business_hours_end DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN contract_end_date DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN opened_at DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN zapi_instance_id DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN zapi_instance_token DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN zapi_client_token DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN public_stock_banner_mode DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN public_stock_banner_images_json DROP NOT NULL;
