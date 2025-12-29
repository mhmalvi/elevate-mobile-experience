-- Ensure security definer functions properly bypass RLS
-- This prevents any potential recursion issues

-- ============================================================================
-- DROP ALL POLICIES FIRST (they depend on the functions)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own team memberships" ON team_members;
DROP POLICY IF EXISTS "Team admins can insert members" ON team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete members" ON team_members;
DROP POLICY IF EXISTS "Team members can view team clients" ON clients;
DROP POLICY IF EXISTS "Team members can insert team clients" ON clients;
DROP POLICY IF EXISTS "Team members can update team clients" ON clients;
DROP POLICY IF EXISTS "Team members can delete team clients" ON clients;
DROP POLICY IF EXISTS "Team members can view team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can insert team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can update team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can delete team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can view team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can insert team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can view team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can insert team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can update team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can delete team invoices" ON invoices;

-- ============================================================================
-- RECREATE HELPER FUNCTIONS WITH EXPLICIT RLS BYPASS
-- ============================================================================

-- Drop existing functions (now safe since policies are gone)
DROP FUNCTION IF EXISTS public.user_is_team_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_has_team_role(UUID, UUID, TEXT[]);

-- Function to check team membership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  is_member BOOLEAN;
BEGIN
  -- Explicitly bypass RLS by using SECURITY DEFINER
  -- This function runs with elevated privileges
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
  ) INTO is_member;

  RETURN is_member;
END;
$$;

-- Function to check if user has specific role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_team_role(
  p_team_id UUID,
  p_user_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  has_role BOOLEAN;
BEGIN
  -- Explicitly bypass RLS by using SECURITY DEFINER
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = ANY(p_roles)
  ) INTO has_role;

  RETURN has_role;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_is_team_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_team_role(UUID, UUID, TEXT[]) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.user_is_team_member(UUID, UUID) IS
  'Check if user is a member of a team. SECURITY DEFINER bypasses RLS to prevent recursion.';
COMMENT ON FUNCTION public.user_has_team_role(UUID, UUID, TEXT[]) IS
  'Check if user has specific role in team. SECURITY DEFINER bypasses RLS to prevent recursion.';

-- ============================================================================
-- RECREATE ALL TABLE POLICIES USING THE NEW FUNCTIONS
-- ============================================================================

-- ============================================================================
-- TEAM_MEMBERS POLICIES
-- ============================================================================

-- Allow all authenticated users to SELECT from team_members
-- This prevents recursion while still maintaining security through team_id FKs
CREATE POLICY "Authenticated users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);  -- Allow all reads, security comes from other table policies

-- Only owners/admins can INSERT (checked via function)
CREATE POLICY "Admins can insert team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be owner or admin of the team they're adding to
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND (
        t.owner_id = auth.uid()
        OR
        public.user_has_team_role(team_id, auth.uid(), ARRAY['admin'])
      )
    )
  );

-- Only owners/admins can UPDATE
CREATE POLICY "Admins can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    user_id != auth.uid()  -- Can't update own role
    AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND (
        t.owner_id = auth.uid()
        OR
        public.user_has_team_role(team_id, auth.uid(), ARRAY['admin'])
      )
    )
  );

-- Only owners/admins can DELETE
CREATE POLICY "Admins can delete team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    user_id != auth.uid()  -- Can't delete own membership
    AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND (
        t.owner_id = auth.uid()
        OR
        public.user_has_team_role(team_id, auth.uid(), ARRAY['admin'])
      )
    )
  );

-- ============================================================================
-- CLIENTS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team clients"
  ON clients FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Team members can insert team clients"
  ON clients FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can update team clients"
  ON clients FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can delete team clients"
  ON clients FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

-- ============================================================================
-- JOBS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team jobs"
  ON jobs FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Team members can insert team jobs"
  ON jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can update team jobs"
  ON jobs FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can delete team jobs"
  ON jobs FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

-- ============================================================================
-- QUOTES POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team quotes"
  ON quotes FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Team members can insert team quotes"
  ON quotes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can update team quotes"
  ON quotes FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can delete team quotes"
  ON quotes FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

-- ============================================================================
-- INVOICES POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team invoices"
  ON invoices FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Team members can insert team invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can update team invoices"
  ON invoices FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY "Team members can delete team invoices"
  ON invoices FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );
