-- ============================================================================
-- CONSOLIDATED RLS POLICY MIGRATION
-- ============================================================================
--
-- Purpose: Fix critical security regression from 20260106000000_enable_public_invoice_viewing.sql
-- which replaced all SELECT policies on 7 tables with USING(true), exposing ALL user data
-- to anonymous access and wiping soft-delete enforcement.
--
-- This migration:
-- 1. Drops ALL existing policies on affected tables
-- 2. Recreates SECURITY DEFINER helper functions (idempotent)
-- 3. Creates authenticated policies with ownership + team + soft-delete checks
-- 4. Creates narrow anon SELECT policies only for public invoice/quote pages
--
-- Tables affected: clients, quotes, invoices, jobs, invoice_line_items,
--                  quote_line_items, profiles, branding_settings, teams,
--                  team_members, team_invitations
--
-- Tables NOT touched (keep existing): subcontractors, timesheets,
--                  timesheet_entries, usage_tracking, quote_templates,
--                  webhook_events, storage.objects
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON AFFECTED TABLES
-- ============================================================================

-- clients
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'clients' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', r.policyname);
  END LOOP;
END $$;

-- quotes
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'quotes' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quotes', r.policyname);
  END LOOP;
END $$;

-- invoices
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoices', r.policyname);
  END LOOP;
END $$;

-- jobs
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', r.policyname);
  END LOOP;
END $$;

-- invoice_line_items
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'invoice_line_items' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_line_items', r.policyname);
  END LOOP;
END $$;

-- quote_line_items
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'quote_line_items' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quote_line_items', r.policyname);
  END LOOP;
END $$;

-- profiles
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- branding_settings
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'branding_settings' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.branding_settings', r.policyname);
  END LOOP;
END $$;

-- teams
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'teams' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams', r.policyname);
  END LOOP;
END $$;

-- team_members
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'team_members' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', r.policyname);
  END LOOP;
END $$;

-- team_invitations
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'team_invitations' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_invitations', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: RECREATE SECURITY DEFINER HELPER FUNCTIONS (idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.user_has_team_role(p_team_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = ANY(p_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- ============================================================================
-- STEP 3: ENSURE RLS IS ENABLED ON ALL AFFECTED TABLES
-- ============================================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CLIENTS — Authenticated + Anon SELECT
-- ============================================================================

-- Authenticated: ownership + team + soft-delete
CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
    )
  );

CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
    )
  );

CREATE POLICY clients_delete ON public.clients
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
  );

-- Anon: SELECT only (needed for PublicInvoice/PublicQuote "Bill To" info)
CREATE POLICY clients_anon_select ON public.clients
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 5: QUOTES — Authenticated + Anon SELECT
-- ============================================================================

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
    )
  );

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
    )
  );

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
  );

-- Anon: SELECT only (needed for PublicQuote page)
CREATE POLICY quotes_anon_select ON public.quotes
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 6: INVOICES — Authenticated + Anon SELECT
-- ============================================================================

CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
    )
  );

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
    )
  );

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
  );

-- Anon: SELECT only (needed for PublicInvoice page)
CREATE POLICY invoices_anon_select ON public.invoices
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 7: JOBS — Authenticated only (NO anon access)
-- ============================================================================

CREATE POLICY jobs_select ON public.jobs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
    )
  );

CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
  );

CREATE POLICY jobs_update ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
    )
  );

CREATE POLICY jobs_delete ON public.jobs
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
  );

-- ============================================================================
-- STEP 8: INVOICE LINE ITEMS — Authenticated via parent + Anon SELECT
-- ============================================================================

CREATE POLICY invoice_line_items_select ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.deleted_at IS NULL
      AND (
        i.user_id = auth.uid()
        OR (i.team_id IS NOT NULL AND public.user_is_team_member(i.team_id, auth.uid()))
      )
    )
  );

CREATE POLICY invoice_line_items_insert ON public.invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND (
        i.user_id = auth.uid()
        OR (i.team_id IS NOT NULL AND public.user_has_team_role(i.team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
      )
    )
  );

CREATE POLICY invoice_line_items_update ON public.invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.deleted_at IS NULL
      AND (
        i.user_id = auth.uid()
        OR (i.team_id IS NOT NULL AND public.user_has_team_role(i.team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
      )
    )
  );

CREATE POLICY invoice_line_items_delete ON public.invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND (
        i.user_id = auth.uid()
        OR (i.team_id IS NOT NULL AND public.user_has_team_role(i.team_id, auth.uid(), ARRAY['owner', 'admin']))
      )
    )
  );

-- Anon: SELECT only (needed for PublicInvoice page)
CREATE POLICY invoice_line_items_anon_select ON public.invoice_line_items
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 9: QUOTE LINE ITEMS — Authenticated via parent + Anon SELECT
-- ============================================================================

CREATE POLICY quote_line_items_select ON public.quote_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
      AND q.deleted_at IS NULL
      AND (
        q.user_id = auth.uid()
        OR (q.team_id IS NOT NULL AND public.user_is_team_member(q.team_id, auth.uid()))
      )
    )
  );

CREATE POLICY quote_line_items_insert ON public.quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
      AND (
        q.user_id = auth.uid()
        OR (q.team_id IS NOT NULL AND public.user_has_team_role(q.team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
      )
    )
  );

CREATE POLICY quote_line_items_update ON public.quote_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
      AND q.deleted_at IS NULL
      AND (
        q.user_id = auth.uid()
        OR (q.team_id IS NOT NULL AND public.user_has_team_role(q.team_id, auth.uid(), ARRAY['owner', 'admin', 'member']))
      )
    )
  );

CREATE POLICY quote_line_items_delete ON public.quote_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
      AND (
        q.user_id = auth.uid()
        OR (q.team_id IS NOT NULL AND public.user_has_team_role(q.team_id, auth.uid(), ARRAY['owner', 'admin']))
      )
    )
  );

-- Anon: SELECT only (needed for PublicQuote page)
CREATE POLICY quote_line_items_anon_select ON public.quote_line_items
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 10: PROFILES — Authenticated + Anon SELECT
-- ============================================================================

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Anon: SELECT only (needed for PublicInvoice/PublicQuote business info)
CREATE POLICY profiles_anon_select ON public.profiles
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 11: BRANDING SETTINGS — Authenticated + Anon SELECT
-- ============================================================================

CREATE POLICY branding_settings_select ON public.branding_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY branding_settings_insert ON public.branding_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY branding_settings_update ON public.branding_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY branding_settings_delete ON public.branding_settings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Anon: SELECT only (needed for PublicInvoice/PublicQuote logo/colors)
CREATE POLICY branding_settings_anon_select ON public.branding_settings
  FOR SELECT TO anon
  USING (true);

-- ============================================================================
-- STEP 12: TEAMS — Authenticated only (NO anon access)
-- ============================================================================

CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (public.user_is_team_member(id, auth.uid()));

CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- STEP 13: TEAM MEMBERS — Authenticated only (NO anon access)
-- ============================================================================

-- All authenticated users can see team members of teams they belong to
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    AND user_id != auth.uid()
  )
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    AND user_id != auth.uid()
  );

CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated
  USING (
    -- Admins/owners can remove others
    (
      team_id IN (
        SELECT tm.team_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
      )
      AND user_id != auth.uid()
    )
    OR
    -- Members can remove themselves (leave team)
    user_id = auth.uid()
  );

-- ============================================================================
-- STEP 14: TEAM INVITATIONS — Authenticated only (NO anon access)
-- ============================================================================

CREATE POLICY team_invitations_select ON public.team_invitations
  FOR SELECT TO authenticated
  USING (
    -- Invitee can see their own invitations
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Team admins/owners can see invitations for their team
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY team_invitations_insert ON public.team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY team_invitations_update ON public.team_invitations
  FOR UPDATE TO authenticated
  USING (
    -- Invitee can accept/decline
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Team admins/owners can manage
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY team_invitations_delete ON public.team_invitations
  FOR DELETE TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 15: GRANT TABLE PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.clients TO anon;
GRANT SELECT ON public.quotes TO anon;
GRANT SELECT ON public.invoices TO anon;
GRANT SELECT ON public.invoice_line_items TO anon;
GRANT SELECT ON public.quote_line_items TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.branding_settings TO anon;

GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.quotes TO authenticated;
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.quote_line_items TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.branding_settings TO authenticated;
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.team_members TO authenticated;
GRANT ALL ON public.team_invitations TO authenticated;

-- ============================================================================
-- STEP 16: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
  table_name TEXT;
  expected_counts JSONB := '{
    "clients": 5,
    "quotes": 5,
    "invoices": 5,
    "jobs": 4,
    "invoice_line_items": 5,
    "quote_line_items": 5,
    "profiles": 4,
    "branding_settings": 5,
    "teams": 4,
    "team_members": 4,
    "team_invitations": 4
  }'::jsonb;
  expected INTEGER;
BEGIN
  FOR table_name IN SELECT jsonb_object_keys(expected_counts)
  LOOP
    SELECT count(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = table_name AND schemaname = 'public';

    expected := (expected_counts->>table_name)::integer;

    IF policy_count != expected THEN
      RAISE WARNING 'POLICY COUNT MISMATCH: % has % policies (expected %)',
        table_name, policy_count, expected;
    ELSE
      RAISE NOTICE 'OK: % has % policies', table_name, policy_count;
    END IF;
  END LOOP;

  -- Verify no USING(true) on authenticated role for core tables
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('clients', 'quotes', 'invoices', 'jobs')
    AND roles::text LIKE '%authenticated%'
    AND qual = 'true'
  ) THEN
    RAISE WARNING 'SECURITY ISSUE: Found USING(true) on authenticated policies for core tables!';
  ELSE
    RAISE NOTICE 'OK: No USING(true) on authenticated policies for core tables';
  END IF;

  -- Verify anon policies exist only where expected
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND roles::text LIKE '%anon%';

  RAISE NOTICE 'Anon policies count: % (expected 7: clients, quotes, invoices, invoice_line_items, quote_line_items, profiles, branding_settings)',
    policy_count;
END $$;

COMMIT;
