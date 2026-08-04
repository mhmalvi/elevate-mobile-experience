-- ============================================================================
-- Internationalisation: make the app usable outside Australia
-- ============================================================================
--
-- The app was built Australia-only and the assumption is baked into column
-- names as well as behaviour:
--
--   * `invoices.gst` / `quotes.gst`  — GST is one country's name for sales tax
--   * `profiles.abn`                 — the ABN is an Australian identifier
--   * `profiles.gst_registered`      — likewise
--   * no country, currency or tax rate stored anywhere, so 10% GST and AUD
--     were hardcoded in application code and in the payment edge function
--
-- This migration:
--   1. adds the locale settings every downstream feature needs
--   2. renames the AU-specific columns to neutral equivalents
--   3. backfills existing rows so current (Australian) users see no change
--
-- Defaults are deliberately AU: every existing account was created under the
-- Australian assumption, so defaulting to AU/AUD/10%/GST preserves their
-- current behaviour exactly. New accounts pick their country at onboarding.
-- ============================================================================

-- ---------------------------------------------------------------- 1. locale

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AU',
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS tax_rate numeric(6, 4) NOT NULL DEFAULT 0.1000,
  ADD COLUMN IF NOT EXISTS tax_label text NOT NULL DEFAULT 'GST',
  ADD COLUMN IF NOT EXISTS tax_inclusive_pricing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS locale text;

COMMENT ON COLUMN public.profiles.country_code IS
  'ISO 3166-1 alpha-2. Drives currency, tax and validation defaults.';
COMMENT ON COLUMN public.profiles.currency_code IS
  'ISO 4217. What this business invoices and gets paid in.';
COMMENT ON COLUMN public.profiles.tax_rate IS
  'Sales tax as a decimal fraction, e.g. 0.1000 = 10% (AU GST), 0.2000 = 20% (UK VAT). 0 = not registered / no tax.';
COMMENT ON COLUMN public.profiles.tax_label IS
  'What this country calls it: GST, VAT, Sales Tax, IVA, ...';
COMMENT ON COLUMN public.profiles.tax_inclusive_pricing IS
  'Whether entered line-item prices already include tax (common in AU/UK/EU) or exclude it (common in US/CA).';
COMMENT ON COLUMN public.profiles.locale IS
  'Optional BCP-47 override for number/date formatting and speech. NULL = follow the device.';

-- Guard rails: a nonsense tax rate silently corrupts every invoice total.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tax_rate_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 1);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_code_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_format CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_currency_code_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_code_format CHECK (currency_code ~ '^[A-Z]{3}$');

-- --------------------------------------------------------------- 2. renames

-- The view selects `i.*`, so it pins the old column name at creation time.
-- Drop it first and rebuild after the rename, otherwise the view keeps
-- exposing a column called `gst` that no longer exists on the base table.
DROP VIEW IF EXISTS public.active_recurring_invoices;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'gst') THEN
    ALTER TABLE public.invoices RENAME COLUMN gst TO tax_amount;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'gst') THEN
    ALTER TABLE public.quotes RENAME COLUMN gst TO tax_amount;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'abn') THEN
    ALTER TABLE public.profiles RENAME COLUMN abn TO business_number;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gst_registered') THEN
    ALTER TABLE public.profiles RENAME COLUMN gst_registered TO tax_registered;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'subcontractors' AND column_name = 'abn') THEN
    ALTER TABLE public.subcontractors RENAME COLUMN abn TO business_number;
  END IF;
END $$;

COMMENT ON COLUMN public.invoices.tax_amount IS
  'Sales tax on this invoice, in the profile currency. Was named `gst`.';
COMMENT ON COLUMN public.quotes.tax_amount IS
  'Sales tax on this quote, in the profile currency. Was named `gst`.';
COMMENT ON COLUMN public.profiles.business_number IS
  'Government business identifier: ABN (AU), EIN (US), CRN (UK), GSTIN (IN)... Was named `abn`.';
COMMENT ON COLUMN public.profiles.tax_registered IS
  'Whether this business is registered to collect sales tax. Was named `gst_registered`.';

-- Rebuild the view against the renamed column.
CREATE OR REPLACE VIEW public.active_recurring_invoices AS
SELECT
  i.*,
  c.name as client_name,
  c.email as client_email,
  p.business_name,
  p.subscription_tier
FROM public.invoices i
LEFT JOIN public.clients c ON i.client_id = c.id
LEFT JOIN public.profiles p ON i.user_id = p.user_id
WHERE i.is_recurring = true
  AND i.deleted_at IS NULL
  AND i.status != 'cancelled';

COMMENT ON VIEW public.active_recurring_invoices IS
  'View of all active recurring invoice templates with client and profile info';

-- ------------------------------------------------------------- 3. backfill

-- Existing rows already carry the AU defaults from the column definitions
-- above. Only `tax_rate` needs care: a business that had explicitly recorded
-- itself as not tax-registered should not suddenly start charging 10%.
UPDATE public.profiles
SET tax_rate = 0
WHERE tax_registered IS FALSE;
