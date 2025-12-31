-- Migration: Add Team Collaboration RLS Policies
-- This enables team members to access shared resources based on team membership

-- ============================================
-- CLIENTS TABLE - Team Collaboration
-- ============================================

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated
  USING (
    -- User owns the client OR is a team member
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = clients.team_id
      AND team_members.user_id = auth.uid()
      
    ))
  );

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User can insert as themselves OR as team member
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = clients.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients
  FOR UPDATE TO authenticated
  USING (
    -- User owns the client OR is team admin/owner
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = clients.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
      
    ))
  );

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients
  FOR DELETE TO authenticated
  USING (
    -- User owns the client OR is team owner
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = clients.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'owner'
      
    ))
  );

-- ============================================
-- QUOTES TABLE - Team Collaboration
-- ============================================

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = quotes.team_id
      AND team_members.user_id = auth.uid()
      
    ))
  );

DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = quotes.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = quotes.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = quotes.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
      
    ))
  );

-- ============================================
-- INVOICES TABLE - Team Collaboration
-- ============================================

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
      AND team_members.user_id = auth.uid()
      
    ))
  );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
      
    ))
  );

-- ============================================
-- JOBS TABLE - Team Collaboration
-- ============================================

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = jobs.team_id
      AND team_members.user_id = auth.uid()
      
    ))
  );

DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = jobs.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = jobs.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
      
    ))
  );

DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = jobs.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
      
    ))
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "clients_select" ON clients IS 'Allow users to view their own clients or clients in teams they belong to';
COMMENT ON POLICY "quotes_select" ON quotes IS 'Allow users to view their own quotes or quotes in teams they belong to';
COMMENT ON POLICY "invoices_select" ON invoices IS 'Allow users to view their own invoices or invoices in teams they belong to';
COMMENT ON POLICY "jobs_select" ON jobs IS 'Allow users to view their own jobs or jobs in teams they belong to';
