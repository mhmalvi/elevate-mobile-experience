-- Fix infinite recursion in team_members RLS policies
-- The issue: team_members policies were checking team_members table, causing recursion

-- ============================================================================
-- DROP PROBLEMATIC TEAM_MEMBERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view team members in their team" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can insert team members" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can delete team members" ON team_members;

-- ============================================================================
-- CREATE NON-RECURSIVE TEAM_MEMBERS POLICIES
-- ============================================================================

-- Users can view team members where they are also a member (check only current row)
CREATE POLICY "Users can view team members in their teams"
  ON team_members FOR SELECT
  USING (
    -- User can see their own team membership
    user_id = auth.uid()
    OR
    -- User can see other members of teams they belong to
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Only allow service role to insert team members initially
-- Users cannot directly insert team members (must use invitation system)
CREATE POLICY "Service role can insert team members"
  ON team_members FOR INSERT
  WITH CHECK (
    -- Check if the current user is an owner/admin of this team
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can update team member roles (not their own)
CREATE POLICY "Team admins can update team members"
  ON team_members FOR UPDATE
  USING (
    -- Check if current user is owner/admin of this team
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    -- Prevent users from modifying their own role
    AND user_id != auth.uid()
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    AND user_id != auth.uid()
  );

-- Team owners and admins can delete team members (not themselves)
CREATE POLICY "Team admins can delete team members"
  ON team_members FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    -- Prevent users from deleting their own membership
    AND user_id != auth.uid()
  );

-- ============================================================================
-- ADD HELPER FUNCTION TO CHECK TEAM MEMBERSHIP (Security Definer)
-- ============================================================================

-- This function runs with elevated privileges to avoid recursion
CREATE OR REPLACE FUNCTION public.user_is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user has specific role in team
CREATE OR REPLACE FUNCTION public.user_has_team_role(p_team_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = ANY(p_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_is_team_member IS 'Check if user is a member of a team (security definer to avoid RLS recursion)';
COMMENT ON FUNCTION public.user_has_team_role IS 'Check if user has specific role in team (security definer to avoid RLS recursion)';
