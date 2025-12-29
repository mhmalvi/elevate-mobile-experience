-- ============================================================================
-- Final Fixes and Verification
-- Date: 2025-12-29
-- Purpose: Ensure all RLS policies, team setup, and features are working
-- ============================================================================

-- ============================================================================
-- VERIFY SECURITY DEFINER FUNCTIONS EXIST
-- ============================================================================

-- Recreate helper functions if they don't exist
CREATE OR REPLACE FUNCTION public.user_is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  is_member BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
  ) INTO is_member;
  RETURN is_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_team_role(
  p_team_id UUID,
  p_user_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  has_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = ANY(p_roles)
  ) INTO has_role;
  RETURN has_role;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_is_team_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_team_role(UUID, UUID, TEXT[]) TO authenticated;

-- ============================================================================
-- ENSURE ALL USERS HAVE TEAMS
-- ============================================================================

-- Create teams for any users who still don't have them
DO $$
DECLARE
  user_record RECORD;
  new_team_id UUID;
BEGIN
  FOR user_record IN
    SELECT p.user_id, p.business_name, p.email
    FROM public.profiles p
    LEFT JOIN public.team_members tm ON tm.user_id = p.user_id
    WHERE tm.user_id IS NULL
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
-- VERIFY BRANDING_SETTINGS POLICIES
-- ============================================================================

-- Ensure branding_settings policies exist
DO $$
BEGIN
  -- Drop and recreate to ensure they're correct
  DROP POLICY IF EXISTS "Users can view their own branding settings" ON branding_settings;
  DROP POLICY IF EXISTS "Users can insert their own branding settings" ON branding_settings;
  DROP POLICY IF EXISTS "Users can update their own branding settings" ON branding_settings;
  DROP POLICY IF EXISTS "Users can delete their own branding settings" ON branding_settings;

  CREATE POLICY "Users can view their own branding settings"
    ON branding_settings FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own branding settings"
    ON branding_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update their own branding settings"
    ON branding_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own branding settings"
    ON branding_settings FOR DELETE
    USING (auth.uid() = user_id);
END $$;

-- ============================================================================
-- VERIFY PROFILES TABLE HAS STRIPE FIELDS
-- ============================================================================

-- Ensure Stripe fields exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE;

-- Ensure team_id field exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- ============================================================================
-- VERIFY ALL TABLES HAVE TEAM_ID AND PROPER INDEXES
-- ============================================================================

-- Ensure team_id columns exist
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Backfill team_id for existing data
UPDATE public.clients c
SET team_id = p.team_id
FROM public.profiles p
WHERE c.user_id = p.user_id
AND c.team_id IS NULL
AND p.team_id IS NOT NULL;

UPDATE public.jobs j
SET team_id = p.team_id
FROM public.profiles p
WHERE j.user_id = p.user_id
AND j.team_id IS NULL
AND p.team_id IS NOT NULL;

UPDATE public.quotes q
SET team_id = p.team_id
FROM public.profiles p
WHERE q.user_id = p.user_id
AND q.team_id IS NULL
AND p.team_id IS NOT NULL;

UPDATE public.invoices i
SET team_id = p.team_id
FROM public.profiles p
WHERE i.user_id = p.user_id
AND i.team_id IS NULL
AND p.team_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

DO $$
DECLARE
  team_count INTEGER;
  user_count INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO team_count FROM teams;
  SELECT COUNT(*) INTO user_count FROM profiles;
  SELECT COUNT(*) INTO orphan_count FROM profiles p
    LEFT JOIN team_members tm ON tm.user_id = p.user_id
    WHERE tm.user_id IS NULL;

  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'Total teams: %', team_count;
  RAISE NOTICE 'Total users: %', user_count;
  RAISE NOTICE 'Users without teams: %', orphan_count;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % users without teams - this should not happen!', orphan_count;
  ELSE
    RAISE NOTICE '✓ All users have teams';
  END IF;
END $$;
