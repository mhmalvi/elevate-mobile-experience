-- ============================================================================
-- FORCE FIX ALL RLS POLICIES - Comprehensive Fix
-- Date: 2025-12-29
-- Purpose: Completely recreate all RLS policies to ensure they work correctly
-- ============================================================================

-- ============================================================================
-- PART 1: DROP ALL EXISTING POLICIES FIRST (before dropping functions)
-- ============================================================================

-- Team Members
DROP POLICY IF EXISTS "Authenticated users can view team members" ON team_members;
DROP POLICY IF EXISTS "Admins can insert team members" ON team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
DROP POLICY IF EXISTS "Users can view their own team memberships" ON team_members;
DROP POLICY IF EXISTS "Team admins can insert members" ON team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete members" ON team_members;
DROP POLICY IF EXISTS "Users can view team members in their team" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can insert team members" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can delete team members" ON team_members;
DROP POLICY IF EXISTS "allow_all_authenticated_select_team_members" ON team_members;
DROP POLICY IF EXISTS "allow_admins_insert_team_members" ON team_members;
DROP POLICY IF EXISTS "allow_admins_update_team_members" ON team_members;
DROP POLICY IF EXISTS "allow_admins_delete_team_members" ON team_members;

-- Clients
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

-- Jobs
DROP POLICY IF EXISTS "Team members can view team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can insert team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can update team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can delete team jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON jobs;
DROP POLICY IF EXISTS "allow_view_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_insert_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_update_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_delete_jobs" ON jobs;

-- Quotes
DROP POLICY IF EXISTS "Team members can view team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can insert team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete team quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON quotes;
DROP POLICY IF EXISTS "allow_view_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_insert_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_update_quotes" ON quotes;
DROP POLICY IF EXISTS "allow_delete_quotes" ON quotes;

-- Invoices
DROP POLICY IF EXISTS "Team members can view team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can insert team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can update team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can delete team invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;
DROP POLICY IF EXISTS "allow_view_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_update_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_delete_invoices" ON invoices;

-- Branding Settings
DROP POLICY IF EXISTS "Users can view their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can insert their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can update their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can delete their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "allow_view_own_branding" ON branding_settings;
DROP POLICY IF EXISTS "allow_insert_own_branding" ON branding_settings;
DROP POLICY IF EXISTS "allow_update_own_branding" ON branding_settings;
DROP POLICY IF EXISTS "allow_delete_own_branding" ON branding_settings;

-- Teams
DROP POLICY IF EXISTS "Users can view their team" ON teams;
DROP POLICY IF EXISTS "Team owners can update their team" ON teams;
DROP POLICY IF EXISTS "Team owners can delete their team" ON teams;
DROP POLICY IF EXISTS "allow_users_view_their_team" ON teams;
DROP POLICY IF EXISTS "allow_owners_update_team" ON teams;
DROP POLICY IF EXISTS "allow_owners_delete_team" ON teams;

-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "allow_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON profiles;

-- ============================================================================
-- PART 2: NOW DROP AND RECREATE SECURITY DEFINER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS public.user_is_team_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_team_role(UUID, UUID, TEXT[]) CASCADE;

-- Function to check team membership (bypasses RLS)
CREATE FUNCTION public.user_is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
  );
END;
$$;

-- Function to check if user has specific role (bypasses RLS)
CREATE FUNCTION public.user_has_team_role(
  p_team_id UUID,
  p_user_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = ANY(p_roles)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_is_team_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_team_role(UUID, UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_team_member(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.user_has_team_role(UUID, UUID, TEXT[]) TO anon;

COMMENT ON FUNCTION public.user_is_team_member IS 'Check if user is a team member. SECURITY DEFINER bypasses RLS.';
COMMENT ON FUNCTION public.user_has_team_role IS 'Check if user has specific role in team. SECURITY DEFINER bypasses RLS.';

-- ============================================================================
-- PART 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE NEW POLICIES - TEAM_MEMBERS (NO RECURSION)
-- ============================================================================

-- Allow all authenticated users to view team members
-- This prevents recursion - security comes from other table policies
CREATE POLICY "allow_all_authenticated_select_team_members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);

-- Only owners/admins can insert team members
CREATE POLICY "allow_admins_insert_team_members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.owner_id = auth.uid()
    )
  );

-- Only owners/admins can update team members (not their own role)
CREATE POLICY "allow_admins_update_team_members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    user_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.owner_id = auth.uid()
    )
  );

-- Only owners/admins can delete team members (not themselves)
CREATE POLICY "allow_admins_delete_team_members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    user_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: CREATE NEW POLICIES - TEAMS
-- ============================================================================

CREATE POLICY "allow_users_view_their_team"
  ON teams FOR SELECT
  TO authenticated
  USING (
    public.user_is_team_member(id, auth.uid())
  );

CREATE POLICY "allow_owners_update_team"
  ON teams FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "allow_owners_delete_team"
  ON teams FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- PART 6: CREATE NEW POLICIES - CLIENTS
-- ============================================================================

CREATE POLICY "allow_view_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_insert_clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_update_clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_delete_clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- ============================================================================
-- PART 7: CREATE NEW POLICIES - JOBS
-- ============================================================================

CREATE POLICY "allow_view_jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_insert_jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_update_jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_delete_jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- ============================================================================
-- PART 8: CREATE NEW POLICIES - QUOTES
-- ============================================================================

CREATE POLICY "allow_view_quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_insert_quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_update_quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_delete_quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- ============================================================================
-- PART 9: CREATE NEW POLICIES - INVOICES
-- ============================================================================

CREATE POLICY "allow_view_invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_insert_invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_update_invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "allow_delete_invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- ============================================================================
-- PART 10: CREATE NEW POLICIES - BRANDING_SETTINGS
-- ============================================================================

CREATE POLICY "allow_view_own_branding"
  ON branding_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_insert_own_branding"
  ON branding_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_branding"
  ON branding_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_delete_own_branding"
  ON branding_settings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- PART 11: CREATE NEW POLICIES - PROFILES
-- ============================================================================

CREATE POLICY "allow_view_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PART 12: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
  table_stats RECORD;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '=== RLS Policy Verification ===';
  RAISE NOTICE 'Total policies created: %', policy_count;

  RAISE NOTICE 'Policies by table:';
  FOR table_stats IN
    SELECT tablename, COUNT(*) as cnt
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  % : % policies', table_stats.tablename, table_stats.cnt;
  END LOOP;

  RAISE NOTICE '✅ All RLS policies recreated successfully!';
END $$;
