-- Final cleanup of all extra policies

-- List all policies first
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('quotes', 'invoices')
ORDER BY tablename, policyname;

-- Drop any "Anyone can view" policies that might exist
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE tablename IN ('quotes', 'invoices')
    AND policyname NOT IN (
      'quotes_select_policy', 'quotes_insert_policy', 'quotes_update_policy', 'quotes_delete_policy',
      'invoices_select_policy', 'invoices_insert_policy', 'invoices_update_policy', 'invoices_delete_policy'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped extra policy: % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- Verify final state
DO $$
DECLARE
  clients_count INT;
  quotes_count INT;
  invoices_count INT;
  jobs_count INT;
BEGIN
  SELECT COUNT(*) INTO clients_count FROM pg_policies WHERE tablename = 'clients';
  SELECT COUNT(*) INTO quotes_count FROM pg_policies WHERE tablename = 'quotes';
  SELECT COUNT(*) INTO invoices_count FROM pg_policies WHERE tablename = 'invoices';
  SELECT COUNT(*) INTO jobs_count FROM pg_policies WHERE tablename = 'jobs';

  RAISE NOTICE '=== FINAL POLICY COUNT ===';
  RAISE NOTICE 'clients: % policies %', clients_count, CASE WHEN clients_count = 4 THEN '✅' ELSE '⚠' END;
  RAISE NOTICE 'quotes: % policies %', quotes_count, CASE WHEN quotes_count = 4 THEN '✅' ELSE '⚠' END;
  RAISE NOTICE 'invoices: % policies %', invoices_count, CASE WHEN invoices_count = 4 THEN '✅' ELSE '⚠' END;
  RAISE NOTICE 'jobs: % policies %', jobs_count, CASE WHEN jobs_count = 4 THEN '✅' ELSE '⚠' END;
  RAISE NOTICE '';
  RAISE NOTICE '=== DATABASE IS READY ===';
  RAISE NOTICE 'Clear browser cache and log in again!';
END $$;
