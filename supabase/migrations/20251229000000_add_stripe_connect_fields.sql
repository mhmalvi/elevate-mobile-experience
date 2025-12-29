-- ============================================================================
-- Add Stripe Connect Fields for Payment Processing
-- Date: 2024-12-29
-- Purpose: Enable tradies to connect Stripe accounts and receive payments
-- ============================================================================

-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE;

-- Add subscription fields if missing (for RevenueCat integration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Add invoice payment tracking fields if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'invoices' AND column_name = 'stripe_payment_link') THEN
    ALTER TABLE public.invoices ADD COLUMN stripe_payment_link TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'invoices' AND column_name = 'sent_at') THEN
    ALTER TABLE public.invoices ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account
  ON public.profiles(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON public.profiles(subscription_tier);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_link
  ON public.invoices(stripe_payment_link)
  WHERE stripe_payment_link IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect account ID (e.g., acct_xxx) - enables tradie to receive payments';
COMMENT ON COLUMN public.profiles.stripe_onboarding_complete IS 'Whether tradie completed Stripe onboarding flow';
COMMENT ON COLUMN public.profiles.stripe_charges_enabled IS 'Whether Stripe account is active and can accept payments';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'TradieMate subscription tier: free, solo, crew, pro';
COMMENT ON COLUMN public.profiles.subscription_provider IS 'Subscription provider: stripe, google_play, apple_iap';
COMMENT ON COLUMN public.profiles.subscription_id IS 'Provider-specific subscription ID';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'Subscription expiration timestamp';
COMMENT ON COLUMN public.invoices.stripe_payment_link IS 'Stripe payment link URL sent to client';
COMMENT ON COLUMN public.invoices.sent_at IS 'Timestamp when invoice was sent to client';
