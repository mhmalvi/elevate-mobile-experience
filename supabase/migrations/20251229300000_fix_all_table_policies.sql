-- ============================================================================
-- FIX ALL TABLE POLICIES
-- Apply the same clean policy structure to quotes, invoices, jobs
-- ============================================================================

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
DROP POLICY IF EXISTS "allow_view_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_insert_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_update_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_delete_quotes" ON quotes;
DROP POLICY IF EXISTS "Anyone can view quotes for document display" ON quotes;
DROP POLICY IF EXISTS "Team members can view team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can insert team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete team quotes" ON quotes;

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Create clean policies
CREATE POLICY "quotes_select_policy" ON quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = quotes.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "quotes_insert_policy" ON quotes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = quotes.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "quotes_update_policy" ON quotes FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = quotes.team_id AND team_members.user_id = auth.uid())))
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = quotes.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "quotes_delete_policy" ON quotes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = quotes.team_id AND team_members.user_id = auth.uid())));

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON invoices;
DROP POLICY IF EXISTS "allow_view_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_update_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_delete_invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can view invoices for document display" ON invoices;
DROP POLICY IF EXISTS "Team members can view team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can insert team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can update team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can delete team invoices" ON invoices;

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create clean policies
CREATE POLICY "invoices_select_policy" ON invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = invoices.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "invoices_insert_policy" ON invoices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = invoices.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "invoices_update_policy" ON invoices FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = invoices.team_id AND team_members.user_id = auth.uid())))
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = invoices.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "invoices_delete_policy" ON invoices FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = invoices.team_id AND team_members.user_id = auth.uid())));

-- ============================================================================
-- JOBS TABLE
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
DROP POLICY IF EXISTS "allow_view_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_insert_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_update_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_delete_jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can view team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can insert team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can update team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can delete team jobs" ON jobs;

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create clean policies
CREATE POLICY "jobs_select_policy" ON jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = jobs.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "jobs_insert_policy" ON jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = jobs.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "jobs_update_policy" ON jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = jobs.team_id AND team_members.user_id = auth.uid())))
  WITH CHECK (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = jobs.team_id AND team_members.user_id = auth.uid())));

CREATE POLICY "jobs_delete_policy" ON jobs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = jobs.team_id AND team_members.user_id = auth.uid())));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_name TEXT;
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== POLICY VERIFICATION ===';
  RAISE NOTICE '';

  FOR table_name IN SELECT unnest(ARRAY['clients', 'quotes', 'invoices', 'jobs'])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM pg_policies WHERE tablename = %L', table_name) INTO policy_count;

    IF policy_count = 4 THEN
      RAISE NOTICE '✅ % : % policies (perfect!)', table_name, policy_count;
    ELSE
      RAISE WARNING '⚠ % : % policies (expected 4)', table_name, policy_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== ALL TABLES FIXED ===';
  RAISE NOTICE 'Now log out and log back in to test!';
END $$;
