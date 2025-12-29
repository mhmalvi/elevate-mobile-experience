-- ============================================================================
-- DIAGNOSE AND FIX RLS POLICIES
-- Check what's wrong and fix it
-- ============================================================================

-- First, let's see what policies exist on clients
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

-- Check if the security definer functions work
SELECT
  'Testing user_is_team_member' as test,
  public.user_is_team_member(
    (SELECT team_id FROM profiles LIMIT 1),
    (SELECT user_id FROM profiles LIMIT 1)
  ) as result;

-- Now let's completely rebuild the clients policies
-- Drop all existing policies
DROP POLICY IF EXISTS "Team members can view team clients" ON clients;
DROP POLICY IF EXISTS "Team members can insert team clients" ON clients;
DROP POLICY IF EXISTS "Team members can update team clients" ON clients;
DROP POLICY IF EXISTS "Team members can delete team clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
DROP POLICY IF EXISTS "allow_view_clients" ON clients;
DROP POLICY IF EXISTS "allow_insert_clients" ON clients;
DROP POLICY IF EXISTS "allow_update_clients" ON clients;
DROP POLICY IF EXISTS "allow_delete_clients" ON clients;

-- Create simple, working policies
-- SELECT policy - users can see clients where they are the user_id OR they are in the team
CREATE POLICY "clients_select_policy"
  ON clients FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = clients.team_id
      AND tm.user_id = auth.uid()
    ))
  );

-- INSERT policy - users can insert if they set themselves as user_id OR they are in the team
CREATE POLICY "clients_insert_policy"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = clients.team_id
      AND tm.user_id = auth.uid()
    ))
  );

-- UPDATE policy
CREATE POLICY "clients_update_policy"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = clients.team_id
      AND tm.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = clients.team_id
      AND tm.user_id = auth.uid()
    ))
  );

-- DELETE policy
CREATE POLICY "clients_delete_policy"
  ON clients FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = clients.team_id
      AND tm.user_id = auth.uid()
    ))
  );

-- Verify policies were created
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_status,
  CASE
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as check_status
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

-- Test the policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'clients';

  RAISE NOTICE '=== RLS POLICY FIX COMPLETE ===';
  RAISE NOTICE 'Total policies on clients table: %', policy_count;

  IF policy_count = 4 THEN
    RAISE NOTICE '✅ All 4 policies created successfully';
    RAISE NOTICE 'Policies:';
    RAISE NOTICE '  1. clients_select_policy (SELECT)';
    RAISE NOTICE '  2. clients_insert_policy (INSERT)';
    RAISE NOTICE '  3. clients_update_policy (UPDATE)';
    RAISE NOTICE '  4. clients_delete_policy (DELETE)';
  ELSE
    RAISE WARNING '⚠ Expected 4 policies, found %', policy_count;
  END IF;
END $$;
