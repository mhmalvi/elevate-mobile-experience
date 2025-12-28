-- Add missing RLS policies for team tables
-- This fixes 403 errors when users try to access team data

-- ============================================================================
-- Team Members Policies
-- ============================================================================

-- Users can view team members in their team
CREATE POLICY "Users can view team members in their team"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Team owners and admins can insert team members
CREATE POLICY "Team owners and admins can insert team members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can update team member roles
CREATE POLICY "Team owners and admins can update team members"
  ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can delete team members
CREATE POLICY "Team owners and admins can delete team members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Team Invitations Policies
-- ============================================================================

-- Users can view invitations for their team
CREATE POLICY "Users can view team invitations"
  ON team_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_invitations.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR email = auth.email()
  );

-- Team owners and admins can create invitations
CREATE POLICY "Team owners and admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_invitations.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can update invitations
CREATE POLICY "Team owners and admins can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_invitations.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can delete invitations
CREATE POLICY "Team owners and admins can delete invitations"
  ON team_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_invitations.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Teams Policies (Additional)
-- ============================================================================

-- Team owners can update their team
CREATE POLICY "Team owners can update their team"
  ON teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'owner'
    )
  );

-- Team owners can delete their team
CREATE POLICY "Team owners can delete their team"
  ON teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'owner'
    )
  );

COMMENT ON POLICY "Users can view team members in their team" ON team_members IS 'Allow users to see members of teams they belong to';
COMMENT ON POLICY "Users can view team invitations" ON team_invitations IS 'Allow team admins and invited users to view invitations';
