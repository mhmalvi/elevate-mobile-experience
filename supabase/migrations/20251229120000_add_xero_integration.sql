-- ============================================================================
-- Migration: Add Xero Integration Fields
-- Description: Adds fields for Xero OAuth and data synchronization
-- Date: 2024-12-29
-- ============================================================================

-- Add Xero integration fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_tenant_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_access_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_refresh_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xero_connected_at TIMESTAMPTZ;

-- Add Xero sync fields to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS xero_contact_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_synced_to_xero TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS xero_sync_error TEXT;

-- Add Xero sync fields to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_synced_to_xero TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xero_sync_error TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xero_sync_status TEXT DEFAULT 'pending'; -- pending, synced, error

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_xero_tenant ON public.profiles(xero_tenant_id) WHERE xero_tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_xero_contact ON public.clients(xero_contact_id) WHERE xero_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_xero_invoice ON public.invoices(xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_xero_sync_status ON public.invoices(xero_sync_status) WHERE xero_sync_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.xero_tenant_id IS 'Xero organization/tenant ID';
COMMENT ON COLUMN public.profiles.xero_access_token IS 'Encrypted Xero OAuth access token';
COMMENT ON COLUMN public.profiles.xero_refresh_token IS 'Encrypted Xero OAuth refresh token';
COMMENT ON COLUMN public.profiles.xero_token_expires_at IS 'When the Xero access token expires';
COMMENT ON COLUMN public.profiles.xero_sync_enabled IS 'Whether automatic Xero sync is enabled';
COMMENT ON COLUMN public.profiles.xero_connected_at IS 'When Xero was first connected';

COMMENT ON COLUMN public.clients.xero_contact_id IS 'Xero Contact ID for this client';
COMMENT ON COLUMN public.clients.last_synced_to_xero IS 'Last successful sync to Xero';
COMMENT ON COLUMN public.clients.xero_sync_error IS 'Last error message from Xero sync';

COMMENT ON COLUMN public.invoices.xero_invoice_id IS 'Xero Invoice ID';
COMMENT ON COLUMN public.invoices.last_synced_to_xero IS 'Last successful sync to Xero';
COMMENT ON COLUMN public.invoices.xero_sync_error IS 'Last error message from Xero sync';
COMMENT ON COLUMN public.invoices.xero_sync_status IS 'Sync status: pending, synced, error';

-- Create a table to track sync history (optional but useful for debugging)
CREATE TABLE IF NOT EXISTS public.xero_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'client' or 'invoice'
  entity_id UUID NOT NULL,
  sync_direction TEXT NOT NULL, -- 'to_xero' or 'from_xero'
  sync_status TEXT NOT NULL, -- 'success' or 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for sync log
ALTER TABLE public.xero_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON public.xero_sync_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync logs"
  ON public.xero_sync_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add index for sync log queries
CREATE INDEX IF NOT EXISTS idx_xero_sync_log_user ON public.xero_sync_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xero_sync_log_entity ON public.xero_sync_log(entity_type, entity_id);
