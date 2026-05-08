-- ==========================================================================
-- V47: Onboarding module – tables and column adaptations
-- ==========================================================================

-- 1. Adapt companies table: add onboarding-related columns
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS razao_social  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255),
    ADD COLUMN IF NOT EXISTS endereco      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cidade        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS uf            VARCHAR(2),
    ADD COLUMN IF NOT EXISTS cep           VARCHAR(20),
    ADD COLUMN IF NOT EXISTS status        VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows that had no explicit status
UPDATE companies SET status = 'ACTIVE' WHERE status IS NULL OR status = '';

-- 2. Adapt users table: add onboarding-related columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nome      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS whatsapp  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill nome from full_name for existing rows
UPDATE users SET nome = full_name WHERE nome IS NULL;

-- Make password_hash nullable (onboarding creates users without password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 3. Create onboarding_events table
CREATE TABLE IF NOT EXISTS onboarding_events (
    id              UUID            PRIMARY KEY,
    idempotency_key VARCHAR(255)    UNIQUE NOT NULL,
    event_type      VARCHAR(100)    NOT NULL,
    payload_json    JSONB           NOT NULL,
    status          VARCHAR(30)     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_idempotency ON onboarding_events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_status       ON onboarding_events (status);

-- 4. Create subscriptions table (onboarding-oriented)
CREATE TABLE IF NOT EXISTS onboarding_subscriptions (
    id                        UUID           PRIMARY KEY,
    company_id                UUID           NOT NULL REFERENCES companies(id),
    asaas_subscription_id     VARCHAR(100)   UNIQUE,
    asaas_payment_id          VARCHAR(100),
    valor                     NUMERIC(10,2)  NOT NULL,
    recorrencia               VARCHAR(50)    NOT NULL,
    data_assinatura           DATE,
    origem                    VARCHAR(255),
    status                    VARCHAR(40)    NOT NULL,
    description               VARCHAR(500),
    asaas_description_synced  BOOLEAN        NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sub_company     ON onboarding_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_asaas_sub   ON onboarding_subscriptions (asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_asaas_pay   ON onboarding_subscriptions (asaas_payment_id);

-- 5. Create email_outbox table
CREATE TABLE IF NOT EXISTS email_outbox (
    id              UUID            PRIMARY KEY,
    template        VARCHAR(100)    NOT NULL,
    to_email        VARCHAR(255)    NOT NULL,
    payload_json    JSONB           NOT NULL,
    status          VARCHAR(30)     NOT NULL,
    retry_count     INT             NOT NULL DEFAULT 0,
    provider_id     VARCHAR(255),
    idempotency_key VARCHAR(255)    UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_idempotency ON email_outbox (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status      ON email_outbox (status);

-- 6. Add CNPJ index on companies for onboarding lookup
CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_cnpj
    ON companies (cnpj)
    WHERE cnpj IS NOT NULL AND cnpj <> '';

-- 7. Create password_reset_tokens table for set-password flow
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID         PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users(id),
    token      VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens (token);
