-- Migration to create teams for all users and update handle_new_user function
-- This fixes the onboarding issue by ensuring all users have teams

-- ============================================================================
-- PART 1: Update handle_new_user function to create teams for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_team_id UUID;
BEGIN
  -- Create a team for the new user
  INSERT INTO public.teams (name, owner_id, subscription_tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Team'),
    NEW.id,
    'free'
  )
  RETURNING id INTO new_team_id;

  -- Add user as owner of the team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, NEW.id, 'owner');

  -- Create profile with team_id
  INSERT INTO public.profiles (user_id, email, team_id)
  VALUES (NEW.id, NEW.email, new_team_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PART 2: Create teams for existing users who don't have teams
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_team_id UUID;
BEGIN
  -- Loop through all users who don't have a team yet
  FOR user_record IN
    SELECT p.user_id, p.business_name, p.email
    FROM public.profiles p
    WHERE p.team_id IS NULL
  LOOP
    -- Create a team for this user
    INSERT INTO public.teams (name, owner_id, subscription_tier)
    VALUES (
      COALESCE(user_record.business_name, 'My Team'),
      user_record.user_id,
      'free'
    )
    RETURNING id INTO new_team_id;

    -- Add user as owner of the team
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, user_record.user_id, 'owner');

    -- Update profile with team_id
    UPDATE public.profiles
    SET team_id = new_team_id
    WHERE user_id = user_record.user_id;

    RAISE NOTICE 'Created team % for user %', new_team_id, user_record.email;
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: Backfill team_id for data in other tables
-- ============================================================================

-- Update clients to inherit team_id from user's profile
UPDATE public.clients c
SET team_id = p.team_id
FROM public.profiles p
WHERE c.user_id = p.user_id
AND c.team_id IS NULL
AND p.team_id IS NOT NULL;

-- Update quotes to inherit team_id from user's profile
UPDATE public.quotes q
SET team_id = p.team_id
FROM public.profiles p
WHERE q.user_id = p.user_id
AND q.team_id IS NULL
AND p.team_id IS NOT NULL;

-- Update invoices to inherit team_id from user's profile
UPDATE public.invoices i
SET team_id = p.team_id
FROM public.profiles p
WHERE i.user_id = p.user_id
AND i.team_id IS NULL
AND p.team_id IS NOT NULL;

-- Update jobs to inherit team_id from user's profile (if jobs table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    UPDATE public.jobs j
    SET team_id = p.team_id
    FROM public.profiles p
    WHERE j.user_id = p.user_id
    AND j.team_id IS NULL
    AND p.team_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON FUNCTION public.handle_new_user IS 'Creates team and profile for new users';
