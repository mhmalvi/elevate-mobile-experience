-- ============================================================================
-- ADD DELETED_AT COLUMN
-- Add soft delete support to main tables
-- ============================================================================

-- Add deleted_at column to tables that don't have it
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON public.jobs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON public.quotes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at) WHERE deleted_at IS NULL;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DELETED_AT COLUMN ADDED ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ clients.deleted_at added';
  RAISE NOTICE '✅ jobs.deleted_at added';
  RAISE NOTICE '✅ quotes.deleted_at added';
  RAISE NOTICE '✅ invoices.deleted_at added';
  RAISE NOTICE '✅ Indexes created for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'The 400 errors should now be fixed!';
END $$;
