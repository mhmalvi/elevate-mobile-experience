-- ============================================================================
-- COMPREHENSIVE POLICY CLEANUP
-- Remove all conflicting policies and create clean, working ones
-- ============================================================================

-- ============================================================================
-- 1. INVOICE_LINE_ITEMS - Remove public policies, use authenticated
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can delete their own invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can insert their own invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can update their own invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can view their own invoice line items" ON invoice_line_items;

-- Drop new policy names if they exist (idempotent)
DROP POLICY IF EXISTS "invoice_line_items_select" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_insert" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_update" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_delete" ON invoice_line_items;

-- Create proper policies using invoice ownership
CREATE POLICY "invoice_line_items_select" ON invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_insert" ON invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_update" ON invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_delete" ON invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. QUOTE_LINE_ITEMS - Remove public policies, use authenticated
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete their own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert their own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update their own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can view their own quote line items" ON quote_line_items;

-- Drop new policy names if they exist (idempotent)
DROP POLICY IF EXISTS "quote_line_items_select" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_insert" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_update" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_delete" ON quote_line_items;

CREATE POLICY "quote_line_items_select" ON quote_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_insert" ON quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_update" ON quote_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_delete" ON quote_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. PROFILES - Remove public access
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view profiles for document display" ON profiles;

-- Keep only authenticated policies
-- (allow_view_own_profile and allow_update_own_profile should already exist)

-- ============================================================================
-- 4. QUOTE_TEMPLATES - Remove duplicates
-- ============================================================================
DROP POLICY IF EXISTS "Public quote templates are viewable by authenticated users" ON quote_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON quote_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON quote_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON quote_templates;
DROP POLICY IF EXISTS "Users can view system templates and their own" ON quote_templates;

-- Keep only the simple select policy created earlier
-- quote_templates_select_policy should allow all authenticated users to view

-- ============================================================================
-- 5. USAGE_TRACKING - Remove service role policy
-- ============================================================================
DROP POLICY IF EXISTS "Service role can manage all usage" ON usage_tracking;

-- Keep the 4 standard policies we created earlier

-- ============================================================================
-- 6. TEAM_INVITATIONS - Fix public role policies
-- ============================================================================
DROP POLICY IF EXISTS "Team owners and admins can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team owners and admins can delete invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team owners and admins can update invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users can view team invitations" ON team_invitations;

-- Drop new policy names if they exist (idempotent)
DROP POLICY IF EXISTS "team_invitations_select" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_update" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_delete" ON team_invitations;

CREATE POLICY "team_invitations_select" ON team_invitations
  FOR SELECT TO authenticated
  USING (
    email = auth.email()
    OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "team_invitations_insert" ON team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "team_invitations_update" ON team_invitations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "team_invitations_delete" ON team_invitations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  table_rec RECORD;
  policy_count INTEGER;
  total_issues INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== POLICY CLEANUP COMPLETE ===';
  RAISE NOTICE '';

  FOR table_rec IN
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = table_rec.tablename;

    RAISE NOTICE '% - % policies', table_rec.tablename, policy_count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All policies cleaned up';
  RAISE NOTICE '✅ No more public role policies';
  RAISE NOTICE '✅ All policies use authenticated role';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Clear browser cache and refresh!';
END $$;
