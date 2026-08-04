-- ============================================================================
-- Correct the tax_inclusive_pricing default introduced in 20260805000000
-- ============================================================================
--
-- That migration defaulted `tax_inclusive_pricing` to TRUE on the reasoning
-- that AU/UK/EU quote tax-inclusive prices to consumers.
--
-- That is true of the market convention but NOT of what this app actually does.
-- Every calculation site computes:
--
--     const gst   = subtotal * 0.1;      // tax on top
--     const total = subtotal + gst;
--
-- i.e. entered line-item prices are treated as tax-EXCLUSIVE and tax is added.
-- Defaulting to inclusive would have reinterpreted every existing invoice and
-- quote: a $1,000 subtotal would become $909.09 + $90.91 instead of
-- $1,000 + $100, changing totals for every current user without them touching
-- anything.
--
-- Preserving existing arithmetic wins over matching market convention. Users
-- who genuinely enter tax-inclusive prices can switch it on in Settings.
-- ============================================================================

ALTER TABLE public.profiles
  ALTER COLUMN tax_inclusive_pricing SET DEFAULT false;

-- Reset the rows the previous migration set to true. Safe because that
-- migration is the only thing that has ever written this column.
UPDATE public.profiles
SET tax_inclusive_pricing = false
WHERE tax_inclusive_pricing IS TRUE;

COMMENT ON COLUMN public.profiles.tax_inclusive_pricing IS
  'FALSE (default): entered line-item prices exclude tax and tax is added on top — this is what the app has always done. TRUE: entered prices already include tax and it is backed out for display.';
