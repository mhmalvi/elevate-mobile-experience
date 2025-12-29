-- ============================================================================
-- Add Missing Authentication Trigger
-- Date: 2025-12-29
-- Purpose: Create trigger that calls handle_new_user() when users sign up
--
-- CRITICAL FIX: This trigger was missing from migrations, causing new users
-- to not get profiles/teams created when they sign up.
-- ============================================================================

-- ============================================================================
-- VERIFICATION: Check if trigger already exists
-- ============================================================================

DO $$
BEGIN
  -- Log current state
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'Trigger on_auth_user_created already exists - skipping creation';
  ELSE
    RAISE NOTICE 'Trigger on_auth_user_created does not exist - will create';
  END IF;
END $$;

-- ============================================================================
-- CREATE THE MISSING TRIGGER
-- ============================================================================

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that creates profiles/teams for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  trigger_exists BOOLEAN;
  function_exists BOOLEAN;
BEGIN
  -- Check trigger was created
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
    AND event_object_table = 'users'
    AND event_object_schema = 'auth'
  ) INTO trigger_exists;

  -- Check function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
  ) INTO function_exists;

  RAISE NOTICE '=== Authentication Trigger Verification ===';

  IF function_exists THEN
    RAISE NOTICE '✓ Function handle_new_user() exists';
  ELSE
    RAISE WARNING '✗ Function handle_new_user() NOT FOUND!';
    RAISE EXCEPTION 'Critical: handle_new_user function missing. Run migration 20251228160000 first.';
  END IF;

  IF trigger_exists THEN
    RAISE NOTICE '✓ Trigger on_auth_user_created created successfully';
  ELSE
    RAISE WARNING '✗ Trigger on_auth_user_created NOT FOUND!';
    RAISE EXCEPTION 'Critical: Trigger creation failed';
  END IF;

  RAISE NOTICE '=== SUCCESS: Authentication trigger is active ===';
  RAISE NOTICE 'New users will now automatically get:';
  RAISE NOTICE '  1. Profile created in profiles table';
  RAISE NOTICE '  2. Team created in teams table';
  RAISE NOTICE '  3. Team membership created in team_members table';
END $$;

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Ensure the function can be executed
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Add helpful comment (skipped - requires superuser permissions)
-- COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
--   'Automatically creates profile, team, and team membership when new user signs up. Calls handle_new_user() function.';
