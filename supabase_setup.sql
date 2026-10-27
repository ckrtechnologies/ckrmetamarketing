-- ================================================================
-- CKR Meta Marketing Platform — Complete Supabase PostgreSQL Schema
-- Run this directly in your Supabase SQL Editor.
-- Compatible with fresh Supabase Cloud and self-hosted instances.
-- ================================================================

-- ── Extensions ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Organizations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT DEFAULT 'starter',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Users (Platform Auth) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT DEFAULT 'agent' CHECK (role IN ('owner','admin','agent','viewer')),
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 3. WhatsApp Business Accounts (WABA) ────────────────────────
CREATE TABLE IF NOT EXISTS public.waba_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  waba_id         TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_number  TEXT,
  display_name    TEXT,
  access_token    TEXT,
  quality_rating  TEXT,
  is_active       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Contact Groups ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  vertical   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Contacts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id   UUID REFERENCES public.contact_groups(id) ON DELETE SET NULL,
  name       TEXT,
  phone      TEXT NOT NULL,
  tags       TEXT[],
  metadata   JSONB,
  opted_out  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, phone)
);

-- ── 6. WhatsApp Campaigns ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  waba_id          UUID REFERENCES public.waba_accounts(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  template_name    TEXT NOT NULL,
  template_lang    TEXT DEFAULT 'en',
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','failed')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 7. Campaign Recipients ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
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

-- ── 8. Chat Conversations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  waba_id          UUID REFERENCES public.waba_accounts(id) ON DELETE SET NULL,
  customer_phone   TEXT NOT NULL,
  customer_name    TEXT,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  unread_count     INT DEFAULT 0,
  window_expires   TIMESTAMPTZ,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  assigned_to      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, customer_phone)
);

-- ── 9. Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  type            TEXT DEFAULT 'text' CHECK (type IN ('text','template','image','document','audio','video','sticker','location','interactive','button','reaction','contacts')),
  body            TEXT,
  template_name   TEXT,
  wamid           TEXT,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  sent_at         TIMESTAMPTZ DEFAULT now(),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error_msg       TEXT
);

-- ── 10. Delivery Logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid       TEXT NOT NULL,
  status      TEXT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  error_code  TEXT,
  error_msg   TEXT
);

-- ── 11. Audit Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes for Performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_org                 ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone               ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_group               ON public.contacts(org_id, group_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org                ON public.campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign          ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status   ON public.campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_wamid             ON public.campaign_recipients(wamid);
CREATE INDEX IF NOT EXISTS idx_conversations_org            ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status     ON public.conversations(org_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_phone          ON public.conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_messages_conv                ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_wamid               ON public.messages(wamid);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_wamid          ON public.delivery_logs(wamid);
CREATE INDEX IF NOT EXISTS idx_waba_accounts_org_active     ON public.waba_accounts(org_id, is_active);

-- ── Seed Data (Default Organization & Admin) ────────────────────
-- Default Organization: Healthy Manushya
INSERT INTO public.organizations (id, name, slug, plan)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Healthy Manushya',
  'healthy-manushya',
  'growth'
)
ON CONFLICT (slug) DO NOTHING;

-- Default Admin User: admin@ckrtechnologies.in (Password: admin123)
-- Valid Hex UUID: b0000000-0000-0000-0000-000000000001
INSERT INTO public.users (id, org_id, email, name, role, password_hash)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'admin@ckrtechnologies.in',
  'Admin',
  'owner',
  '$2b$12$M8DQ5M8S.VxeRTMLqI6Ahu3rTBxsLhdDbYIHDDG1EfiZNti/YuP8i'
)
ON CONFLICT (email) DO NOTHING;

-- Default WABA Account from .env
INSERT INTO public.waba_accounts (
  org_id,
  waba_id,
  phone_number_id,
  display_number,
  display_name,
  access_token,
  is_active
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '469743566216329',
  '443930708804530',
  '+917814051127',
  'Healthy Manushya',
  'EAANZBQCrNrfsBSEZBZC945SLeW6Y1XN5JTkis1zgCpmFO85wUQEx2p4NZCBNnmUISsRfHWeaZAWocZCnLioENNJNLzGiowhu7og7DiUAxzcZBKzyNxLTqvfEzb897YEbzZCXTo2xvRuNgHMuFZB6TF3UZBCgL0VdMwc4ZClgE5FjlAIroxxEw2P0LlsZBxjiZCq7xHgZDZD',
  true
)
ON CONFLICT (phone_number_id) DO NOTHING;

SELECT 'CKR Meta Marketing schema & initial seed ready ✅' AS result;
