-- ============================================================================
-- DIAGNOSTIC CHECK
-- Verify auth.uid() is working and policies are correct
-- ============================================================================

-- Create a simple test function to check auth
CREATE OR REPLACE FUNCTION public.test_auth() RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'auth_uid', auth.uid()::text,
    'auth_email', auth.email(),
    'auth_role', auth.role(),
    'session_valid', CASE WHEN auth.uid() IS NOT NULL THEN true ELSE false END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.test_auth() TO authenticated;

-- Verify policy structure
DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSTIC REPORT ===';
  RAISE NOTICE '';

  -- Check clients policies
  RAISE NOTICE 'CLIENTS table policies:';
  FOR policy_rec IN
    SELECT policyname, cmd,
           CASE WHEN qual IS NOT NULL THEN 'Has USING' ELSE 'No USING' END as using_clause
    FROM pg_policies
    WHERE tablename = 'clients'
    ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  - %: % (%)', policy_rec.cmd, policy_rec.policyname, policy_rec.using_clause;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'To test authentication, run in Supabase SQL Editor:';
  RAISE NOTICE '  SELECT test_auth();';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected result if logged in:';
  RAISE NOTICE '  auth_uid: <your-user-id>';
  RAISE NOTICE '  session_valid: true';
END $$;
