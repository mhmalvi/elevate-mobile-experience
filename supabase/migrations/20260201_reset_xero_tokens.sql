-- Reset Xero tokens to force a fresh reconnection
-- This is needed because old tokens may have been stored without encryption

-- Clear all Xero tokens (users will need to reconnect)
UPDATE public.profiles
SET 
    xero_access_token = NULL,
    xero_refresh_token = NULL,
    xero_tenant_id = NULL,
    xero_token_expires_at = NULL,
    xero_sync_enabled = false,
    xero_connected_at = NULL
WHERE xero_access_token IS NOT NULL;

-- Log to track the reset
DO $$
BEGIN
    RAISE NOTICE 'Reset all Xero tokens. Users must reconnect to Xero.';
END $$;
