
-- Add MYOB integration columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS myob_access_token text,
ADD COLUMN IF NOT EXISTS myob_refresh_token text,
ADD COLUMN IF NOT EXISTS myob_company_file_id text, -- MYOB specific (Company File)
ADD COLUMN IF NOT EXISTS myob_company_file_uri text,
ADD COLUMN IF NOT EXISTS myob_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS myob_connected_at timestamptz,
ADD COLUMN IF NOT EXISTS myob_sync_enabled boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_myob_connected ON public.profiles(myob_sync_enabled);

-- Add MYOB columns to clients table (to link TradieMate clients to MYOB cards)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS myob_uid text, -- MYOB's unique ID for the contact
ADD COLUMN IF NOT EXISTS myob_sync_error text,
ADD COLUMN IF NOT EXISTS last_synced_to_myob timestamptz;

-- Add MYOB columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS myob_uid text, -- MYOB's unique ID for the invoice
ADD COLUMN IF NOT EXISTS myob_sync_error text,
ADD COLUMN IF NOT EXISTS last_synced_to_myob timestamptz;
