-- Completely eliminate recursion by simplifying team_members policies
-- Use security definer functions to bypass RLS when checking membership

-- ============================================================================
-- DROP EXISTING TEAM_MEMBERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view team members in their teams" ON team_members;
DROP POLICY IF EXISTS "Service role can insert team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete team members" ON team_members;

-- ============================================================================
-- SIMPLIFIED TEAM_MEMBERS POLICIES (NO RECURSION)
-- ============================================================================

-- Users can only view team memberships that involve them directly
CREATE POLICY "Users can view their own team memberships"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    -- Allow viewing if user is member of the same team (using helper function)
    public.user_is_team_member(team_id, auth.uid())
  );

-- Allow inserting team members if user is owner/admin (using helper function)
CREATE POLICY "Team admins can insert members"
  ON team_members FOR INSERT
  WITH CHECK (
    public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Allow updating team members if user is owner/admin
CREATE POLICY "Team admins can update members"
  ON team_members FOR UPDATE
  USING (
    user_id != auth.uid()  -- Can't update own role
    AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    user_id != auth.uid()
    AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Allow deleting team members if user is owner/admin
CREATE POLICY "Team admins can delete members"
  ON team_members FOR DELETE
  USING (
    user_id != auth.uid()  -- Can't delete own membership
    AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- ============================================================================
-- UPDATE OTHER TABLE POLICIES TO USE HELPER FUNCTIONS
-- ============================================================================

-- Recreate clients policies using helper function
DROP POLICY IF EXISTS "Team members can view team clients" ON clients;
DROP POLICY IF EXISTS "Team members can insert team clients" ON clients;
DROP POLICY IF EXISTS "Team members can update team clients" ON clients;
DROP POLICY IF EXISTS "Team members can delete team clients" ON clients;

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
  )
  WITH CHECK (
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

-- Recreate jobs policies using helper function
DROP POLICY IF EXISTS "Team members can view team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can insert team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can update team jobs" ON jobs;
DROP POLICY IF EXISTS "Team members can delete team jobs" ON jobs;

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
  )
  WITH CHECK (
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

-- Recreate quotes policies using helper function
DROP POLICY IF EXISTS "Team members can view team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can insert team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update team quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete team quotes" ON quotes;

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

-- Recreate invoices policies using helper function
DROP POLICY IF EXISTS "Team members can view team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can insert team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can update team invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can delete team invoices" ON invoices;

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

COMMENT ON POLICY "Users can view their own team memberships" ON team_members IS 'Allow users to see team memberships using security definer functions';
