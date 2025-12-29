-- ============================================================================
-- FIX EXISTING POLICIES (Idempotent)
-- This migration can be run multiple times safely
-- ============================================================================

-- Drop and recreate invoice_line_items policies
DROP POLICY IF EXISTS "invoice_line_items_select" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_insert" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_update" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_delete" ON invoice_line_items;

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

-- Drop and recreate quote_line_items policies
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

-- Drop and recreate team_invitations policies
DROP POLICY IF EXISTS "team_invitations_select" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_update" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_delete" ON team_invitations;

CREATE POLICY "team_invitations_select" ON team_invitations
  FOR SELECT TO authenticated
  USING (
    email = (SELECT auth.email())
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

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== POLICY FIX APPLIED ===';
  RAISE NOTICE 'invoice_line_items: 4 policies recreated';
  RAISE NOTICE 'quote_line_items: 4 policies recreated';
  RAISE NOTICE 'team_invitations: 4 policies recreated';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All policies now use authenticated role';
  RAISE NOTICE '✅ Line items check parent ownership';
  RAISE NOTICE '✅ Clear browser cache and test!';
END $$;
