-- ============================================================================
-- SIMPLIFY RLS POLICIES - Make them work reliably
-- Drop complex team-based policies and use simple user_id checks
-- ============================================================================

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
DROP POLICY IF EXISTS "clients_insert_policy" ON clients;
DROP POLICY IF EXISTS "clients_update_policy" ON clients;
DROP POLICY IF EXISTS "clients_delete_policy" ON clients;

CREATE POLICY "clients_select_policy"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "clients_insert_policy"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_update_policy"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_delete_policy"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
DROP POLICY IF EXISTS "Team members can view team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can insert team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can update team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can delete team jobs" ON jobs;

CREATE POLICY "jobs_select_policy"
  ON jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "jobs_insert_policy"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs_update_policy"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs_delete_policy"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
DROP POLICY IF EXISTS "Team members can view team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can insert team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete team quotes" ON quotes;

CREATE POLICY "quotes_select_policy"
  ON quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "quotes_insert_policy"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotes_update_policy"
  ON quotes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotes_delete_policy"
  ON quotes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON invoices;
DROP POLICY IF EXISTS "Team members can view team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can insert team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can update team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can delete team invoices" ON invoices;

CREATE POLICY "invoices_select_policy"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_policy"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_update_policy"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_delete_policy"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFY
-- ============================================================================
DO $$
DECLARE
  clients_count INTEGER;
  jobs_count INTEGER;
  quotes_count INTEGER;
  invoices_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO clients_count FROM pg_policies WHERE tablename = 'clients';
  SELECT COUNT(*) INTO jobs_count FROM pg_policies WHERE tablename = 'jobs';
  SELECT COUNT(*) INTO quotes_count FROM pg_policies WHERE tablename = 'quotes';
  SELECT COUNT(*) INTO invoices_count FROM pg_policies WHERE tablename = 'invoices';

  RAISE NOTICE '';
  RAISE NOTICE '=== SIMPLIFIED RLS POLICIES APPLIED ===';
  RAISE NOTICE 'clients: % policies', clients_count;
  RAISE NOTICE 'jobs: % policies', jobs_count;
  RAISE NOTICE 'quotes: % policies', quotes_count;
  RAISE NOTICE 'invoices: % policies', invoices_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ All tables now use simple user_id checks';
  RAISE NOTICE '✅ Clear browser cache and refresh the app';
END $$;
