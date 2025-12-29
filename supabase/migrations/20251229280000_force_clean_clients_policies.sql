-- ============================================================================
-- FORCE CLEAN ALL CLIENTS POLICIES
-- Remove ALL policies and recreate only what we need
-- ============================================================================

-- Show current policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== CURRENT POLICIES ON CLIENTS ===';
  FOR policy_record IN
    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients' ORDER BY policyname
  LOOP
    RAISE NOTICE 'Policy: % (Command: %)', policy_record.policyname, policy_record.cmd;
  END LOOP;
END $$;

-- Drop ALL policies by name (including the ones we just created)
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
DROP POLICY IF EXISTS "clients_insert_policy" ON clients;
DROP POLICY IF EXISTS "clients_update_policy" ON clients;
DROP POLICY IF EXISTS "clients_delete_policy" ON clients;
DROP POLICY IF EXISTS "allow_view_clients" ON clients;
DROP POLICY IF EXISTS "allow_insert_clients" ON clients;
DROP POLICY IF EXISTS "allow_update_clients" ON clients;
DROP POLICY IF EXISTS "allow_delete_clients" ON clients;

-- Also drop any other potential policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON clients;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON clients;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON clients;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON clients;

-- Make sure RLS is enabled
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Now create ONLY the 4 policies we need - using the simplest approach
-- Policy 1: SELECT
CREATE POLICY "clients_select_policy"
  ON clients FOR SELECT
  TO authenticated
  USING (
    -- User owns this client
    user_id = auth.uid()
    OR
    -- User is in the team
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

-- Policy 2: INSERT
CREATE POLICY "clients_insert_policy"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is inserting themselves as owner
    user_id = auth.uid()
    OR
    -- User is in the team they're inserting into
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

-- Policy 3: UPDATE
CREATE POLICY "clients_update_policy"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

-- Policy 4: DELETE
CREATE POLICY "clients_delete_policy"
  ON clients FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  );

-- Verify the fix
DO $$
DECLARE
  policy_count INTEGER;
  policy_record RECORD;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'clients';

  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Total policies on clients table: %', policy_count;

  IF policy_count = 4 THEN
    RAISE NOTICE '✅ SUCCESS: Exactly 4 policies exist';
  ELSE
    RAISE WARNING '⚠ WARNING: Expected 4 policies, found %', policy_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Policies:';
  FOR policy_record IN
    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients' ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  ✓ % (%)', policy_record.policyname, policy_record.cmd;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== NEXT STEP ===';
  RAISE NOTICE 'Log out and log back in to refresh your session';
  RAISE NOTICE 'Then try accessing clients again';
END $$;
