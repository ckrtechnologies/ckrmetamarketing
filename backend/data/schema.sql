-- ================================================================
-- CKR Meta Marketing Platform — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor to initialize the database
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Organizations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT DEFAULT 'starter',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT DEFAULT 'agent' CHECK (role IN ('owner','admin','agent','viewer')),
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── WABA Accounts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waba_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id         TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_number  TEXT,
  display_name    TEXT,
  access_token    TEXT,
  quality_rating  TEXT,
  is_active       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Contact Groups ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  vertical   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Contacts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  group_id   UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
  name       TEXT,
  phone      TEXT NOT NULL,
  tags       TEXT[],
  metadata   JSONB,
  opted_out  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, phone)
);

-- ── Campaigns ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id          UUID REFERENCES waba_accounts(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  template_name    TEXT NOT NULL,
  template_lang    TEXT DEFAULT 'en',
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','failed')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── Campaign Recipients ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone        TEXT NOT NULL,
  variables    JSONB,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  wamid        TEXT,
  error_code   TEXT,
  error_msg    TEXT,
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ
);

-- ── Conversations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id          UUID REFERENCES waba_accounts(id) ON DELETE SET NULL,
  customer_phone   TEXT NOT NULL,
  customer_name    TEXT,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  unread_count     INT DEFAULT 0,
  window_expires   TIMESTAMPTZ,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, customer_phone)
);

-- ── Messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  type            TEXT DEFAULT 'text' CHECK (type IN ('text','template','image','document','audio','video')),
  body            TEXT,
  template_name   TEXT,
  wamid           TEXT,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  sent_at         TIMESTAMPTZ DEFAULT now()
);

-- ── Delivery Logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid       TEXT NOT NULL,
  status      TEXT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  error_code  TEXT,
  error_msg   TEXT
);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_wamid ON delivery_logs(wamid);

-- ── Audit Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_org      ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone    ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_campaigns_org     ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_wamid  ON campaign_recipients(wamid);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(conversation_id);

-- Done!
SELECT 'CKR Meta Marketing schema initialized successfully ✅' AS result;
