-- ============================================================================
-- FIX ANON RLS POLICIES & TEAM_MEMBERS SELECT LEAK
-- ============================================================================
--
-- Issues fixed:
-- 1. team_members_select uses USING(true) — leaks all team membership to any
--    authenticated user. Replace with team-scoped check.
-- 2. Anon SELECT policies on clients, profiles, branding_settings use USING(true)
--    allowing enumeration of ALL rows. Restrict to rows referenced by an
--    invoice or quote (for public pages) or by direct user_id lookup.
--
-- Tables affected: team_members, clients, profiles, branding_settings
--
-- Note: Anon policies on invoices, quotes, invoice_line_items, quote_line_items
-- are kept as USING(true) because the public pages query by UUID (unguessable).
-- The UUID effectively acts as a bearer token for read access.
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIX 1: team_members SELECT — scope to own teams only
-- ============================================================================

DROP POLICY IF EXISTS team_members_select ON public.team_members;

CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (
    -- Can only see members of teams you belong to
    public.user_is_team_member(team_id, auth.uid())
  );

-- ============================================================================
-- FIX 2: clients anon SELECT — restrict to clients referenced by invoices/quotes
-- ============================================================================

DROP POLICY IF EXISTS clients_anon_select ON public.clients;

CREATE POLICY clients_anon_select ON public.clients
  FOR SELECT TO anon
  USING (
    -- Only allow reading client data if the client is attached to an invoice or quote
    -- (public pages look up the client via the invoice/quote's client_id)
    id IN (SELECT client_id FROM public.invoices WHERE client_id IS NOT NULL)
    OR id IN (SELECT client_id FROM public.quotes WHERE client_id IS NOT NULL)
  );

-- ============================================================================
-- FIX 3: profiles anon SELECT — restrict to profiles that own an invoice/quote
-- ============================================================================

DROP POLICY IF EXISTS profiles_anon_select ON public.profiles;

CREATE POLICY profiles_anon_select ON public.profiles
  FOR SELECT TO anon
  USING (
    -- Only allow reading profile data for users who have created invoices or quotes
    -- (public pages load the profile via the invoice/quote's user_id)
    user_id IN (SELECT DISTINCT user_id FROM public.invoices WHERE user_id IS NOT NULL)
    OR user_id IN (SELECT DISTINCT user_id FROM public.quotes WHERE user_id IS NOT NULL)
  );

-- ============================================================================
-- FIX 4: branding_settings anon SELECT — same restriction as profiles
-- ============================================================================

DROP POLICY IF EXISTS branding_settings_anon_select ON public.branding_settings;

CREATE POLICY branding_settings_anon_select ON public.branding_settings
  FOR SELECT TO anon
  USING (
    -- Only allow reading branding for users who have created invoices or quotes
    user_id IN (SELECT DISTINCT user_id FROM public.invoices WHERE user_id IS NOT NULL)
    OR user_id IN (SELECT DISTINCT user_id FROM public.quotes WHERE user_id IS NOT NULL)
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  policy_qual TEXT;
BEGIN
  -- Verify team_members no longer has USING(true)
  SELECT qual INTO policy_qual
  FROM pg_policies
  WHERE tablename = 'team_members'
    AND schemaname = 'public'
    AND policyname = 'team_members_select';

  IF policy_qual = 'true' THEN
    RAISE WARNING 'FAIL: team_members_select still has USING(true)!';
  ELSE
    RAISE NOTICE 'OK: team_members_select is properly scoped';
  END IF;

  -- Verify clients_anon_select no longer has USING(true)
  SELECT qual INTO policy_qual
  FROM pg_policies
  WHERE tablename = 'clients'
    AND schemaname = 'public'
    AND policyname = 'clients_anon_select';

  IF policy_qual = 'true' THEN
    RAISE WARNING 'FAIL: clients_anon_select still has USING(true)!';
  ELSE
    RAISE NOTICE 'OK: clients_anon_select is properly scoped';
  END IF;

  -- Verify profiles_anon_select
  SELECT qual INTO policy_qual
  FROM pg_policies
  WHERE tablename = 'profiles'
    AND schemaname = 'public'
    AND policyname = 'profiles_anon_select';

  IF policy_qual = 'true' THEN
    RAISE WARNING 'FAIL: profiles_anon_select still has USING(true)!';
  ELSE
    RAISE NOTICE 'OK: profiles_anon_select is properly scoped';
  END IF;

  -- Verify branding_settings_anon_select
  SELECT qual INTO policy_qual
  FROM pg_policies
  WHERE tablename = 'branding_settings'
    AND schemaname = 'public'
    AND policyname = 'branding_settings_anon_select';

  IF policy_qual = 'true' THEN
    RAISE WARNING 'FAIL: branding_settings_anon_select still has USING(true)!';
  ELSE
    RAISE NOTICE 'OK: branding_settings_anon_select is properly scoped';
  END IF;
END $$;

COMMIT;
