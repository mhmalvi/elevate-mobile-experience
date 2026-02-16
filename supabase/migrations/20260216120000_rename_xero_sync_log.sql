-- Rename xero_sync_log to integration_sync_log
-- This table is used by Xero, QuickBooks, and MYOB sync functions.
-- The generic name better reflects its purpose as a shared integration sync log.

ALTER TABLE IF EXISTS public.xero_sync_log RENAME TO integration_sync_log;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS idx_xero_sync_log_user RENAME TO idx_integration_sync_log_user;
ALTER INDEX IF EXISTS idx_xero_sync_log_entity RENAME TO idx_integration_sync_log_entity;

-- Re-grant permissions on renamed table (PostgreSQL preserves grants on rename,
-- but explicit grant ensures clarity)
GRANT SELECT, INSERT ON TABLE public.integration_sync_log TO authenticated;
