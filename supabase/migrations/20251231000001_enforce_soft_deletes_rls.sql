-- Migration: Enforce Soft Deletes in RLS Policies
-- This ensures that soft-deleted records are not visible in queries

-- ============================================
-- CLIENTS TABLE - Add soft delete filter
-- ============================================

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated
  USING (
    -- Only show non-deleted records
    deleted_at IS NULL
    AND (
      -- User owns the client OR is a team member
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
        
      ))
    )
  );

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients
  FOR UPDATE TO authenticated
  USING (
    -- Only allow updates on non-deleted records
    deleted_at IS NULL
    AND (
      -- User owns the client OR is team admin/owner
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = clients.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
        
      ))
    )
  );

-- ============================================
-- QUOTES TABLE - Add soft delete filter
-- ============================================

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = quotes.team_id
        AND team_members.user_id = auth.uid()
        
      ))
    )
  );

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = quotes.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin', 'member')
        
      ))
    )
  );

-- ============================================
-- INVOICES TABLE - Add soft delete filter
-- ============================================

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = invoices.team_id
        AND team_members.user_id = auth.uid()
        
      ))
    )
  );

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = invoices.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin', 'member')
        
      ))
    )
  );

-- ============================================
-- JOBS TABLE - Add soft delete filter
-- ============================================

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = jobs.team_id
        AND team_members.user_id = auth.uid()
        
      ))
    )
  );

DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR
      (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = jobs.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin', 'member')
        
      ))
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "clients_select" ON clients IS 'Only show non-deleted clients to owners and team members';
COMMENT ON POLICY "quotes_select" ON quotes IS 'Only show non-deleted quotes to owners and team members';
COMMENT ON POLICY "invoices_select" ON invoices IS 'Only show non-deleted invoices to owners and team members';
COMMENT ON POLICY "jobs_select" ON jobs IS 'Only show non-deleted jobs to owners and team members';
