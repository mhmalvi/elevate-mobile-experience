-- ============================================================================
-- EMERGENCY FIX: Create profiles/teams for existing users
-- This fixes users who were created before the auth trigger was deployed
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_team_id UUID;
  fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== FIXING EXISTING USERS ===';

  -- Fix users without profiles
  FOR user_record IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
  LOOP
    RAISE NOTICE 'Creating profile for user: %', user_record.email;

    -- Create team
    INSERT INTO public.teams (name, owner_id, subscription_tier)
    VALUES (
      COALESCE(user_record.raw_user_meta_data->>'business_name', 'My Team'),
      user_record.id,
      'free'
    )
    RETURNING id INTO new_team_id;

    -- Create team membership
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, user_record.id, 'owner');

    -- Create profile
    INSERT INTO public.profiles (user_id, email, team_id)
    VALUES (user_record.id, user_record.email, new_team_id);

    fixed_count := fixed_count + 1;
    RAISE NOTICE '✓ Fixed user: % (team: %)', user_record.email, new_team_id;
  END LOOP;

  -- Fix profiles without teams
  FOR user_record IN
    SELECT p.user_id, p.email
    FROM public.profiles p
    WHERE p.team_id IS NULL
  LOOP
    RAISE NOTICE 'Adding team to profile: %', user_record.email;

    -- Create team
    INSERT INTO public.teams (name, owner_id, subscription_tier)
    VALUES ('My Team', user_record.user_id, 'free')
    RETURNING id INTO new_team_id;

    -- Create team membership
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, user_record.user_id, 'owner');

    -- Update profile
    UPDATE public.profiles SET team_id = new_team_id WHERE user_id = user_record.user_id;

    fixed_count := fixed_count + 1;
    RAISE NOTICE '✓ Added team to profile: % (team: %)', user_record.email, new_team_id;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== FIX COMPLETE ===';
  RAISE NOTICE 'Total users fixed: %', fixed_count;

  IF fixed_count = 0 THEN
    RAISE NOTICE 'All users already have profiles and teams ✓';
  END IF;
END $$;

-- Verify the fix
DO $$
DECLARE
  user_count INTEGER;
  profile_count INTEGER;
  team_count INTEGER;
  orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO team_count FROM public.teams;
  SELECT COUNT(*) INTO orphans
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

  RAISE NOTICE '';
  RAISE NOTICE '=== DATABASE STATUS ===';
  RAISE NOTICE 'Total users: %', user_count;
  RAISE NOTICE 'Total profiles: %', profile_count;
  RAISE NOTICE 'Total teams: %', team_count;
  RAISE NOTICE 'Users without profiles: %', orphans;

  IF orphans = 0 AND user_count = profile_count THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ SUCCESS: All users have profiles and teams!';
  ELSE
    RAISE WARNING '⚠ WARNING: % users still without profiles', orphans;
  END IF;
END $$;
