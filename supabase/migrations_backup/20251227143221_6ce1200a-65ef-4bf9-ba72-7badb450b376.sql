-- Add subscription tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_provider TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.subscription_provider IS 'Payment provider: stripe, google_play, or apple_iap';
COMMENT ON COLUMN public.profiles.subscription_id IS 'External subscription ID from the payment provider';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'When the current subscription period ends';