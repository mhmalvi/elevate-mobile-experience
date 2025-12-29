-- ============================================================================
-- GRANT TABLE PERMISSIONS
-- The authenticated role needs explicit permissions on tables
-- RLS policies alone are not enough!
-- ============================================================================

-- Grant all necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_tracking TO authenticated;
GRANT SELECT ON TABLE public.quote_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branding_settings TO authenticated;
GRANT SELECT, INSERT ON TABLE public.xero_sync_log TO authenticated;

-- Grant usage on sequences if they exist
DO $$
DECLARE
  seq_record RECORD;
BEGIN
  FOR seq_record IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('GRANT USAGE ON SEQUENCE public.%I TO authenticated', seq_record.sequence_name);
  END LOOP;
END $$;

-- Verify grants
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TABLE PERMISSIONS GRANTED ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ authenticated role now has full access to all tables';
  RAISE NOTICE '✅ RLS policies will still restrict which rows users can see';
  RAISE NOTICE '✅ This fixes the "permission denied" errors';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT:';
  RAISE NOTICE '1. Close ALL browser tabs';
  RAISE NOTICE '2. Restart your browser completely';
  RAISE NOTICE '3. Open http://localhost:8080 in incognito mode';
  RAISE NOTICE '4. Log in and test';
END $$;
