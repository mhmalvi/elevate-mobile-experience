-- ============================================================================
-- FIX RLS PERMISSIONS - Add missing policies for usage_tracking and verify others
-- ============================================================================

-- First, enable RLS on usage_tracking if not already enabled
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on usage_tracking if any
DROP POLICY IF EXISTS "Users can view their own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can insert their own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update their own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can delete their own usage" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_select_policy" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_insert_policy" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_update_policy" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_delete_policy" ON usage_tracking;

-- Create proper RLS policies for usage_tracking
CREATE POLICY "usage_tracking_select_policy"
  ON usage_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "usage_tracking_insert_policy"
  ON usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_tracking_update_policy"
  ON usage_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_tracking_delete_policy"
  ON usage_tracking FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add RLS policies for quote_templates (public read access)
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view quote templates" ON quote_templates;
DROP POLICY IF EXISTS "quote_templates_select_policy" ON quote_templates;

CREATE POLICY "quote_templates_select_policy"
  ON quote_templates FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can view templates

-- Verify all tables have RLS enabled
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'profiles', 'teams', 'team_members', 'clients',
      'jobs', 'quotes', 'invoices', 'branding_settings',
      'quote_templates', 'recurring_invoices', 'xero_integration',
      'usage_tracking'
    )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

-- Final status check
DO $$
DECLARE
  usage_policies INTEGER;
  template_policies INTEGER;
  total_users INTEGER;
  users_with_teams INTEGER;
BEGIN
  -- Check usage_tracking policies
  SELECT COUNT(*) INTO usage_policies
  FROM pg_policies
  WHERE tablename = 'usage_tracking';

  -- Check quote_templates policies
  SELECT COUNT(*) INTO template_policies
  FROM pg_policies
  WHERE tablename = 'quote_templates';

  -- Check user/team consistency
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_with_teams FROM profiles WHERE team_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== RLS PERMISSION FIX COMPLETE ===';
  RAISE NOTICE 'usage_tracking policies: % (expected: 4)', usage_policies;
  RAISE NOTICE 'quote_templates policies: % (expected: 1)', template_policies;
  RAISE NOTICE 'Users with teams: % / %', users_with_teams, total_users;

  IF usage_policies = 4 AND template_policies >= 1 THEN
    RAISE NOTICE '✅ All policies created successfully';
  ELSE
    RAISE WARNING '⚠ Policy count mismatch';
  END IF;

  IF users_with_teams = total_users AND total_users > 0 THEN
    RAISE NOTICE '✅ All users have team assignments';
  ELSE
    RAISE WARNING '⚠ % users missing team assignments', total_users - users_with_teams;
  END IF;
END $$;
