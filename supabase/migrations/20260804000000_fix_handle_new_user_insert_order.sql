-- ============================================================================
-- Fix signup: handle_new_user() inserted team_members before profiles
--
-- BUG: 20260131120000_fix_team_members_fk.sql added
--        team_members_user_id_fkey_profiles  FK (user_id) -> profiles(user_id)
--      so PostgREST could infer the team_members -> profiles relationship.
--
--      handle_new_user() still inserted in the order:
--        teams -> team_members -> profiles
--
--      so the team_members row referenced a profiles row that did not exist
--      yet. Every new signup failed with:
--
--        23503: insert or update on table "team_members" violates foreign key
--        constraint "team_members_user_id_fkey_profiles"
--
--      surfacing through the API as "Database error creating new user".
--
--      Existing users were unaffected (their profiles row already existed),
--      which is why this stayed hidden on an established database.
--
-- FIX: insert profiles before team_members. teams still comes first because
--      profiles.team_id needs the new team id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_team_id UUID;
BEGIN
  -- 1. Team first: profiles.team_id depends on it
  INSERT INTO public.teams (name, owner_id, subscription_tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Team'),
    NEW.id,
    'free'
  )
  RETURNING id INTO new_team_id;

  -- 2. Profile second: team_members.user_id has an FK onto profiles.user_id
  INSERT INTO public.profiles (user_id, email, team_id)
  VALUES (NEW.id, NEW.email, new_team_id);

  -- 3. Membership last, now that both parents exist
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;
