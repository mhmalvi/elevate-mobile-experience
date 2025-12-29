-- ============================================================================
-- Remove the extra "Anyone can view clients" policy
-- This policy is interfering with our proper policies
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can view clients for document display" ON clients;

-- Verify we now have exactly 4 policies
DO $$
DECLARE
  policy_count INTEGER;
  policy_record RECORD;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'clients';

  RAISE NOTICE '=== FINAL VERIFICATION ===';
  RAISE NOTICE 'Total policies on clients table: %', policy_count;

  IF policy_count = 4 THEN
    RAISE NOTICE '✅ SUCCESS: Exactly 4 policies (perfect!)';
  ELSIF policy_count > 4 THEN
    RAISE WARNING '⚠ WARNING: Still have % policies (expected 4)', policy_count;
  ELSIF policy_count < 4 THEN
    RAISE WARNING '⚠ WARNING: Only % policies (expected 4)', policy_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Current policies:';
  FOR policy_record IN
    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients' ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  ✓ % (%)', policy_record.policyname, policy_record.cmd;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== CLIENTS TABLE IS NOW READY ===';
  RAISE NOTICE 'Users can access clients if they:';
  RAISE NOTICE '  1. Own the client (user_id = their ID)';
  RAISE NOTICE '  2. OR are a member of the client''s team';
END $$;
