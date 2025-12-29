-- ============================================================================
-- NUCLEAR POLICY RESET
-- Drop ALL policies and recreate with simple, working ones
-- ============================================================================

-- Function to drop all policies on a table
CREATE OR REPLACE FUNCTION drop_all_policies(table_name text) RETURNS void AS $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop all policies on main tables
SELECT drop_all_policies('clients');
SELECT drop_all_policies('jobs');
SELECT drop_all_policies('quotes');
SELECT drop_all_policies('invoices');
SELECT drop_all_policies('usage_tracking');
SELECT drop_all_policies('quote_templates');
SELECT drop_all_policies('invoice_line_items');
SELECT drop_all_policies('quote_line_items');

-- ============================================================================
-- CLIENTS
-- ============================================================================
CREATE POLICY "clients_policy_select" ON clients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "clients_policy_insert" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "clients_policy_update" ON clients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "clients_policy_delete" ON clients
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- JOBS
-- ============================================================================
CREATE POLICY "jobs_policy_select" ON jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "jobs_policy_insert" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "jobs_policy_update" ON jobs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "jobs_policy_delete" ON jobs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- QUOTES
-- ============================================================================
CREATE POLICY "quotes_policy_select" ON quotes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "quotes_policy_insert" ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "quotes_policy_update" ON quotes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "quotes_policy_delete" ON quotes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- INVOICES
-- ============================================================================
CREATE POLICY "invoices_policy_select" ON invoices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "invoices_policy_insert" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "invoices_policy_update" ON invoices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "invoices_policy_delete" ON invoices
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- USAGE_TRACKING
-- ============================================================================
CREATE POLICY "usage_tracking_policy_select" ON usage_tracking
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usage_tracking_policy_insert" ON usage_tracking
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usage_tracking_policy_update" ON usage_tracking
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usage_tracking_policy_delete" ON usage_tracking
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- QUOTE_TEMPLATES - Allow all authenticated users to read
-- ============================================================================
CREATE POLICY "quote_templates_policy_select" ON quote_templates
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- INVOICE_LINE_ITEMS - Check parent invoice ownership
-- ============================================================================
CREATE POLICY "invoice_line_items_policy_select" ON invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_policy_insert" ON invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_policy_update" ON invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_policy_delete" ON invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- ============================================================================
-- QUOTE_LINE_ITEMS - Check parent quote ownership
-- ============================================================================
CREATE POLICY "quote_line_items_policy_select" ON quote_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_policy_insert" ON quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_policy_update" ON quote_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "quote_line_items_policy_delete" ON quote_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

-- Clean up the function
DROP FUNCTION drop_all_policies(text);

-- Verification
DO $$
DECLARE
  clients_count INTEGER;
  jobs_count INTEGER;
  quotes_count INTEGER;
  invoices_count INTEGER;
  usage_count INTEGER;
  templates_count INTEGER;
  invoice_items_count INTEGER;
  quote_items_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO clients_count FROM pg_policies WHERE tablename = 'clients';
  SELECT COUNT(*) INTO jobs_count FROM pg_policies WHERE tablename = 'jobs';
  SELECT COUNT(*) INTO quotes_count FROM pg_policies WHERE tablename = 'quotes';
  SELECT COUNT(*) INTO invoices_count FROM pg_policies WHERE tablename = 'invoices';
  SELECT COUNT(*) INTO usage_count FROM pg_policies WHERE tablename = 'usage_tracking';
  SELECT COUNT(*) INTO templates_count FROM pg_policies WHERE tablename = 'quote_templates';
  SELECT COUNT(*) INTO invoice_items_count FROM pg_policies WHERE tablename = 'invoice_line_items';
  SELECT COUNT(*) INTO quote_items_count FROM pg_policies WHERE tablename = 'quote_line_items';

  RAISE NOTICE '';
  RAISE NOTICE '=== NUCLEAR RESET COMPLETE ===';
  RAISE NOTICE 'clients: % policies', clients_count;
  RAISE NOTICE 'jobs: % policies', jobs_count;
  RAISE NOTICE 'quotes: % policies', quotes_count;
  RAISE NOTICE 'invoices: % policies', invoices_count;
  RAISE NOTICE 'usage_tracking: % policies', usage_count;
  RAISE NOTICE 'quote_templates: % policies', templates_count;
  RAISE NOTICE 'invoice_line_items: % policies', invoice_items_count;
  RAISE NOTICE 'quote_line_items: % policies', quote_items_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ All old policies completely removed';
  RAISE NOTICE '✅ Fresh simple policies created';
  RAISE NOTICE '✅ CRITICAL: Close ALL browser tabs and restart browser!';
  RAISE NOTICE '✅ Or use incognito mode to test';
END $$;
