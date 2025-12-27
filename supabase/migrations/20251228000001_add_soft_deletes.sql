-- Add soft delete support to main tables
-- deleted_at will be NULL for active records, timestamptz for deleted records

-- Clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at
  ON public.clients(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at
  ON public.quotes(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at
  ON public.jobs(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at
  ON public.invoices(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Quote templates table
ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_templates_deleted_at
  ON public.quote_templates(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Helper function to soft delete a record
CREATE OR REPLACE FUNCTION public.soft_delete(
  table_name text,
  record_id uuid
) RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to restore a soft-deleted record
CREATE OR REPLACE FUNCTION public.restore_deleted(
  table_name text,
  record_id uuid
) RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to permanently delete old soft-deleted records
-- (Run this as a scheduled job, e.g., monthly)
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_records(
  days_old integer DEFAULT 90
) RETURNS void AS $$
BEGIN
  -- Delete old clients
  DELETE FROM public.clients
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::interval;

  -- Delete old quotes and their line items (cascade should handle line items)
  DELETE FROM public.quotes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::interval;

  -- Delete old jobs
  DELETE FROM public.jobs
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::interval;

  -- Delete old invoices and their line items (cascade should handle line items)
  DELETE FROM public.invoices
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::interval;

  -- Delete old quote templates
  DELETE FROM public.quote_templates
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.soft_delete IS 'Soft delete a record by setting deleted_at timestamp';
COMMENT ON FUNCTION public.restore_deleted IS 'Restore a soft-deleted record by clearing deleted_at';
COMMENT ON FUNCTION public.cleanup_old_deleted_records IS 'Permanently delete records that have been soft-deleted for more than X days';
