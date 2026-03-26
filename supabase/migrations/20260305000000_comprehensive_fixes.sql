-- ============================================================================
-- COMPREHENSIVE DATABASE FIXES
-- ============================================================================
--
-- Created: 2026-03-05
--
-- Fixes included:
--   1. Add missing indexes on frequently queried columns
--   2. Create generic update_updated_at_column() function
--   3. Add missing updated_at triggers for subcontractors, teams, timesheets,
--      and timesheet_entries
--   4. Add team_id column to subcontractors for team-based access
--   5. Add team-based RLS SELECT policy for subcontractors
--   6. Add profiles DELETE policy (was missing)
--   7. Re-create team_members leave/delete policy in correct migration order
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD MISSING INDEXES
-- ============================================================================
-- These indexes improve query performance for common lookups, filtering,
-- and sorting operations across the main entity tables.

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);

-- ============================================================================
-- 2. CREATE GENERIC update_updated_at_column() FUNCTION
-- ============================================================================
-- A reusable trigger function that sets updated_at = NOW() on any row update.
-- This replaces the need for per-table functions like
-- update_branding_settings_updated_at().

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. ADD MISSING updated_at TRIGGERS
-- ============================================================================
-- These tables have an updated_at column but no trigger to auto-set it.

-- subcontractors
DROP TRIGGER IF EXISTS update_subcontractors_updated_at ON public.subcontractors;
CREATE TRIGGER update_subcontractors_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- teams
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- timesheets
DROP TRIGGER IF EXISTS update_timesheets_updated_at ON public.timesheets;
CREATE TRIGGER update_timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- timesheet_entries
DROP TRIGGER IF EXISTS update_timesheet_entries_updated_at ON public.timesheet_entries;
CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. ADD team_id COLUMN TO subcontractors
-- ============================================================================
-- Allows subcontractors to be shared within a team, not just owned by one user.

ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subcontractors_team_id ON public.subcontractors(team_id);

-- ============================================================================
-- 5. ADD TEAM-BASED RLS SELECT POLICY FOR subcontractors
-- ============================================================================
-- The existing policy only allows user_id = auth.uid(). We replace it with a
-- broader policy that also grants access to team members.

DROP POLICY IF EXISTS "Users can view own subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_team_select" ON public.subcontractors;

CREATE POLICY "subcontractors_team_select" ON public.subcontractors
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. ADD profiles DELETE POLICY
-- ============================================================================
-- Users should be able to delete their own profile (e.g., account deletion).

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. RE-CREATE team_members LEAVE/DELETE POLICY
-- ============================================================================
-- The original migration 20240131_add_leave_team_policy.sql has a timestamp
-- that sorts before the teams/team_members table creation (20251228150000).
-- Re-create the policy here to guarantee it exists regardless of migration
-- execution order.

DROP POLICY IF EXISTS "Users can delete their own team membership" ON public.team_members;
DROP POLICY IF EXISTS "team_members_leave_team" ON public.team_members;

CREATE POLICY "team_members_leave_team" ON public.team_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  idx_count INTEGER;
  trigger_count INTEGER;
  col_exists BOOLEAN;
  policy_exists BOOLEAN;
BEGIN
  -- Verify indexes were created (spot check a few)
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('idx_quotes_user_id', 'idx_invoices_status', 'idx_jobs_scheduled_date');
  IF idx_count >= 3 THEN
    RAISE NOTICE 'OK: Key indexes created successfully (% found)', idx_count;
  ELSE
    RAISE WARNING 'WARN: Some indexes may not have been created (% of 3 found)', idx_count;
  END IF;

  -- Verify updated_at triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name IN (
      'update_subcontractors_updated_at',
      'update_teams_updated_at',
      'update_timesheets_updated_at',
      'update_timesheet_entries_updated_at'
    );
  IF trigger_count >= 4 THEN
    RAISE NOTICE 'OK: All 4 updated_at triggers created';
  ELSE
    RAISE WARNING 'WARN: Only % of 4 updated_at triggers found', trigger_count;
  END IF;

  -- Verify team_id column on subcontractors
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subcontractors'
      AND column_name = 'team_id'
  ) INTO col_exists;
  IF col_exists THEN
    RAISE NOTICE 'OK: subcontractors.team_id column exists';
  ELSE
    RAISE WARNING 'FAIL: subcontractors.team_id column not found';
  END IF;

  -- Verify team_members_leave_team policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'team_members'
      AND policyname = 'team_members_leave_team'
  ) INTO policy_exists;
  IF policy_exists THEN
    RAISE NOTICE 'OK: team_members_leave_team policy exists';
  ELSE
    RAISE WARNING 'FAIL: team_members_leave_team policy not found';
  END IF;

  -- Verify profiles_delete policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_delete'
  ) INTO policy_exists;
  IF policy_exists THEN
    RAISE NOTICE 'OK: profiles_delete policy exists';
  ELSE
    RAISE WARNING 'FAIL: profiles_delete policy not found';
  END IF;
END $$;

COMMIT;
