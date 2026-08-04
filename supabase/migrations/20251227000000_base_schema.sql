-- ============================================================================
-- BASE SCHEMA — reconstructed
-- Date: 2025-12-27 (timestamped to run BEFORE all existing migrations)
--
-- WHY THIS EXISTS:
-- The original base schema was created directly in the Lovable-managed cloud
-- project and was never written to a migration file. When that project was
-- deleted, the schema went with it. Every later migration ALTERs these tables
-- but none of them CREATE any, so migrations could not be replayed onto a
-- fresh database.
--
-- SOURCE OF TRUTH: src/integrations/supabase/types.ts (generated types),
-- which records every table, column, nullability, enum and foreign key.
--
-- Deliberately idempotent so it is safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'invoiced'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trade_type AS ENUM (
    'electrician', 'plumber', 'carpenter', 'builder', 'painter',
    'landscaper', 'hvac', 'roofer', 'tiler', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   text,
  business_name           text,
  trade_type              public.trade_type,
  abn                     text,
  license_number          text,
  phone                   text,
  address                 text,
  logo_url                text,
  gst_registered          boolean DEFAULT false,
  default_hourly_rate     numeric,
  payment_terms           integer DEFAULT 14,
  bank_name               text,
  bank_account_name       text,
  bank_account_number     text,
  bank_bsb                text,
  stripe_account_id       text,
  subscription_tier       text DEFAULT 'free',
  subscription_id         text,
  subscription_provider   text,
  subscription_expires_at timestamptz,
  onboarding_completed    boolean DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text,
  phone      text,
  address    text,
  suburb     text,
  state      text,
  postcode   text,
  notes      text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_number   text NOT NULL,
  title          text NOT NULL,
  description    text,
  status         public.quote_status DEFAULT 'draft',
  subtotal       numeric DEFAULT 0,
  gst            numeric DEFAULT 0,
  total          numeric DEFAULT 0,
  terms          text,
  notes          text,
  valid_until    date,
  signature_data text,
  sent_at        timestamptz,
  viewed_at      timestamptz,
  accepted_at    timestamptz,
  declined_at    timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id       uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  title          text NOT NULL,
  description    text,
  status         public.job_status DEFAULT 'quoted',
  site_address   text,
  scheduled_date date,
  start_time     time,
  end_time       time,
  actual_hours   numeric,
  material_costs numeric,
  notes          text,
  completed_at   timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  job_id             uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  quote_id           uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  parent_invoice_id  uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number     text NOT NULL,
  title              text NOT NULL,
  description        text,
  status             public.invoice_status DEFAULT 'draft',
  subtotal           numeric DEFAULT 0,
  gst                numeric DEFAULT 0,
  total              numeric DEFAULT 0,
  amount_paid        numeric DEFAULT 0,
  terms              text,
  notes              text,
  due_date           date,
  is_recurring       boolean DEFAULT false,
  recurring_interval text,
  next_due_date      date,
  sent_at            timestamptz,
  viewed_at          timestamptz,
  paid_at            timestamptz,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- quote_line_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  item_type   text,
  quantity    numeric DEFAULT 1,
  unit        text,
  unit_price  numeric NOT NULL,
  total       numeric NOT NULL,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- invoice_line_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  item_type   text,
  quantity    numeric DEFAULT 1,
  unit        text,
  unit_price  numeric NOT NULL,
  total       numeric NOT NULL,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- quote_templates
-- user_id is nullable: NULL rows are system templates shared by all users.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  trade_type    public.trade_type,
  default_items jsonb DEFAULT '[]'::jsonb,
  is_system     boolean DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- usage_tracking  (month_year is a 'YYYY-MM' string)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year       text NOT NULL,
  clients_created  integer DEFAULT 0,
  jobs_created     integer DEFAULT 0,
  quotes_created   integer DEFAULT 0,
  invoices_created integer DEFAULT 0,
  emails_sent      integer DEFAULT 0,
  sms_sent         integer DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_year)
);

-- ---------------------------------------------------------------------------
-- Indexes on foreign keys / hot lookup paths
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_user_id            ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id             ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id           ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id               ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id             ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date        ON public.jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id           ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id         ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status            ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id  ON public.quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_inv_id  ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id     ON public.usage_tracking(user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clients','quotes','jobs','invoices','usage_tracking']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Baseline owner-only policies. Later migrations replace these with the
-- team-aware versions; enabling RLS here means the tables are never briefly
-- readable by other tenants in between.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking     ENABLE ROW LEVEL SECURITY;

-- Direct user_id ownership
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clients','quotes','jobs','invoices','usage_tracking']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "base_owner_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "base_owner_all" ON public.%I
         FOR ALL USING (auth.uid() = user_id)
         WITH CHECK (auth.uid() = user_id)', t);
  END LOOP;
END $$;

-- Line items inherit ownership from their parent document
DROP POLICY IF EXISTS "base_owner_all" ON public.quote_line_items;
CREATE POLICY "base_owner_all" ON public.quote_line_items
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quotes q
                 WHERE q.id = quote_line_items.quote_id AND q.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q
                 WHERE q.id = quote_line_items.quote_id AND q.user_id = auth.uid()));

DROP POLICY IF EXISTS "base_owner_all" ON public.invoice_line_items;
CREATE POLICY "base_owner_all" ON public.invoice_line_items
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoices i
                 WHERE i.id = invoice_line_items.invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i
                 WHERE i.id = invoice_line_items.invoice_id AND i.user_id = auth.uid()));

-- Templates: own rows writable, system rows readable by everyone
DROP POLICY IF EXISTS "base_owner_all"    ON public.quote_templates;
DROP POLICY IF EXISTS "base_system_read"  ON public.quote_templates;
CREATE POLICY "base_owner_all" ON public.quote_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "base_system_read" ON public.quote_templates
  FOR SELECT USING (is_system = true);
