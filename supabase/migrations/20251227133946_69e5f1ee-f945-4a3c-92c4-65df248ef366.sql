-- Add missing profile fields for compliance and payment integration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gst_registered boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.license_number IS 'Trade license number for compliance display on documents';
COMMENT ON COLUMN public.profiles.gst_registered IS 'Whether business is registered for GST';
COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect account ID for payment links';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription tier: free, solo, crew, pro';