-- Fix RLS policies to support team-based access
-- This migration updates RLS policies for clients, jobs, and branding_settings
-- to allow access based on team membership

-- ============================================================================
-- DROP OLD POLICIES THAT ONLY CHECK user_id
-- ============================================================================

-- Drop old clients policies
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

-- Drop old jobs policies
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON jobs;

-- Drop old branding_settings policies
DROP POLICY IF EXISTS "Users can view their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can insert their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can update their own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can delete their own branding settings" ON branding_settings;

-- ============================================================================
-- CREATE NEW TEAM-AWARE POLICIES FOR CLIENTS
-- ============================================================================

-- Users can view clients in their team OR their own clients (backward compatibility)
CREATE POLICY "Team members can view team clients"
  ON clients FOR SELECT
  USING (
    -- Own clients (backward compatibility for users without teams)
    user_id = auth.uid()
    OR
    -- Team clients (check if user is a member of the team)
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = clients.team_id
        AND tm.user_id = auth.uid()
      )
    )
  );

-- Team members with write access can insert clients
CREATE POLICY "Team members can insert team clients"
  ON clients FOR INSERT
  WITH CHECK (
    -- Own client (backward compatibility)
    user_id = auth.uid()
    OR
    -- Team client (must be team member with appropriate role)
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = clients.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can update clients
CREATE POLICY "Team members can update team clients"
  ON clients FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = clients.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = clients.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can delete clients
CREATE POLICY "Team members can delete team clients"
  ON clients FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = clients.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- ============================================================================
-- CREATE NEW TEAM-AWARE POLICIES FOR JOBS
-- ============================================================================

-- Users can view jobs in their team OR their own jobs
CREATE POLICY "Team members can view team jobs"
  ON jobs FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = jobs.team_id
        AND tm.user_id = auth.uid()
      )
    )
  );

-- Team members with write access can insert jobs
CREATE POLICY "Team members can insert team jobs"
  ON jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = jobs.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can update jobs
CREATE POLICY "Team members can update team jobs"
  ON jobs FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = jobs.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = jobs.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can delete jobs
CREATE POLICY "Team members can delete team jobs"
  ON jobs FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = jobs.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- ============================================================================
-- CREATE NEW TEAM-AWARE POLICIES FOR BRANDING_SETTINGS
-- ============================================================================

-- Users can view their own branding settings (per-user, not team-based)
CREATE POLICY "Users can view their own branding settings"
  ON branding_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own branding settings
CREATE POLICY "Users can insert their own branding settings"
  ON branding_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own branding settings
CREATE POLICY "Users can update their own branding settings"
  ON branding_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own branding settings
CREATE POLICY "Users can delete their own branding settings"
  ON branding_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE SIMILAR POLICIES FOR QUOTES AND INVOICES
-- ============================================================================

-- Drop old quotes policies
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON quotes;

-- Team members can view team quotes
CREATE POLICY "Team members can view team quotes"
  ON quotes FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = quotes.team_id
        AND tm.user_id = auth.uid()
      )
    )
  );

-- Team members with write access can insert quotes
CREATE POLICY "Team members can insert team quotes"
  ON quotes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = quotes.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can update quotes
CREATE POLICY "Team members can update team quotes"
  ON quotes FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = quotes.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can delete quotes
CREATE POLICY "Team members can delete team quotes"
  ON quotes FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = quotes.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Drop old invoices policies
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;

-- Team members can view team invoices
CREATE POLICY "Team members can view team invoices"
  ON invoices FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = invoices.team_id
        AND tm.user_id = auth.uid()
      )
    )
  );

-- Team members with write access can insert invoices
CREATE POLICY "Team members can insert team invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = invoices.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can update invoices
CREATE POLICY "Team members can update team invoices"
  ON invoices FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = invoices.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Team members with write access can delete invoices
CREATE POLICY "Team members can delete team invoices"
  ON invoices FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = invoices.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'member')
      )
    )
  );

COMMENT ON POLICY "Team members can view team clients" ON clients IS 'Allow team members to view clients in their team';
COMMENT ON POLICY "Team members can view team jobs" ON jobs IS 'Allow team members to view jobs in their team';
COMMENT ON POLICY "Team members can view team quotes" ON quotes IS 'Allow team members to view quotes in their team';
COMMENT ON POLICY "Team members can view team invoices" ON invoices IS 'Allow team members to view invoices in their team';
