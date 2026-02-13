-- QuickBooks Online Integration
-- Adds QB OAuth token storage to profiles and mapping columns to clients/invoices

-- Profile QB columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_realm_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_token_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qb_connected_at TIMESTAMPTZ;

-- Client QB mapping
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_synced_to_qb TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;

-- Invoice QB mapping
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_synced_to_qb TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;
