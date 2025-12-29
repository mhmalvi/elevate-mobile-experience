-- ============================================================================
-- COMPREHENSIVE FIX - Apply all pending fixes
-- ============================================================================

-- Part 1: Remove extra policies that might cause issues
DROP POLICY IF EXISTS "Anyone can view quotes for document display" ON quotes CASCADE;
DROP POLICY IF EXISTS "Anyone can view invoices for document display" ON invoices CASCADE;
DROP POLICY IF EXISTS "Allow anyone to view quotes" ON quotes CASCADE;
DROP POLICY IF EXISTS "Allow anyone to view invoices" ON invoices CASCADE;

-- Part 2: Fix existing users who don't have profiles/teams
DO $$
DECLARE
  user_record RECORD;
  new_team_id UUID;
  users_fixed INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Fixing Existing Users ===';

  -- Loop through users who don't have profiles
  FOR user_record IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
  LOOP
    -- Create a team for this user
    INSERT INTO public.teams (name, owner_id, subscription_tier)
    VALUES (
      COALESCE(
        user_record.raw_user_meta_data->>'business_name',
        user_record.raw_user_meta_data->>'full_name',
        'My Team'
      ),
      user_record.id,
      'free'
    )
    RETURNING id INTO new_team_id;

    -- Add user as owner of the team
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, user_record.id, 'owner');

    -- Create profile with team_id
    INSERT INTO public.profiles (user_id, email, team_id)
    VALUES (
      user_record.id,
      user_record.email,
      new_team_id
    );

    users_fixed := users_fixed + 1;
    RAISE NOTICE 'Fixed user: %', user_record.email;
  END LOOP;

  RAISE NOTICE 'Total users fixed: %', users_fixed;
END $$;

-- Part 3: Backfill team_id for existing data
DO $$
DECLARE
  clients_updated INTEGER;
  jobs_updated INTEGER;
  quotes_updated INTEGER;
  invoices_updated INTEGER;
BEGIN
  RAISE NOTICE '=== Backfilling team_id ===';

  -- Update clients
  UPDATE public.clients c
  SET team_id = p.team_id
  FROM public.profiles p
  WHERE c.user_id = p.user_id
  AND c.team_id IS NULL
  AND p.team_id IS NOT NULL;
  GET DIAGNOSTICS clients_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % clients', clients_updated;

  -- Update jobs
  UPDATE public.jobs j
  SET team_id = p.team_id
  FROM public.profiles p
  WHERE j.user_id = p.user_id
  AND j.team_id IS NULL
  AND p.team_id IS NOT NULL;
  GET DIAGNOSTICS jobs_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % jobs', jobs_updated;

  -- Update quotes
  UPDATE public.quotes q
  SET team_id = p.team_id
  FROM public.profiles p
  WHERE q.user_id = p.user_id
  AND q.team_id IS NULL
  AND p.team_id IS NOT NULL;
  GET DIAGNOSTICS quotes_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % quotes', quotes_updated;

  -- Update invoices
  UPDATE public.invoices i
  SET team_id = p.team_id
  FROM public.profiles p
  WHERE i.user_id = p.user_id
  AND i.team_id IS NULL
  AND p.team_id IS NOT NULL;
  GET DIAGNOSTICS invoices_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % invoices', invoices_updated;
END $$;

-- Part 4: Final verification
DO $$
DECLARE
  user_count INTEGER;
  profile_count INTEGER;
  team_count INTEGER;
  policy_issues INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO team_count FROM public.teams;

  -- Check for tables with too many policies
  SELECT COUNT(*) INTO policy_issues
  FROM (
    SELECT tablename, COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('clients', 'jobs', 'quotes', 'invoices')
    GROUP BY tablename
    HAVING COUNT(*) > 4
  ) subq;

  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL STATUS ===';
  RAISE NOTICE 'Users: %, Profiles: %, Teams: %', user_count, profile_count, team_count;

  IF user_count = profile_count AND profile_count = team_count THEN
    RAISE NOTICE '✅ All users have profiles and teams';
  ELSE
    RAISE WARNING '⚠ User/Profile/Team count mismatch';
  END IF;

  IF policy_issues = 0 THEN
    RAISE NOTICE '✅ All tables have correct number of policies';
  ELSE
    RAISE WARNING '⚠ % tables have duplicate policies', policy_issues;
  END IF;

  RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
