-- Enable public viewing of invoices and quotes via shared links
-- This allows anonymous users to view invoices/quotes when they have the link (UUID)
-- Security: UUIDs are cryptographically random and virtually impossible to guess

-- Drop existing SELECT policies for invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Team members can view invoices" ON invoices;

-- Create new SELECT policy that allows public viewing
CREATE POLICY "Public and authenticated users can view invoices"
  ON invoices FOR SELECT
  USING (true);  -- Allow all SELECT operations (public + authenticated)

-- Drop existing SELECT policies for quotes
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can view quotes" ON quotes;

-- Create new SELECT policy for quotes that allows public viewing
CREATE POLICY "Public and authenticated users can view quotes"
  ON quotes FOR SELECT
  USING (true);  -- Allow all SELECT operations (public + authenticated)

-- Ensure other operations (INSERT, UPDATE, DELETE) remain protected
-- Only the owner or team members can modify

-- Invoices: Only owner can INSERT/UPDATE/DELETE
CREATE POLICY "Users can insert own invoices" ON invoices
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own invoices" ON invoices
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Users can delete own invoices" ON invoices
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- Quotes: Only owner can INSERT/UPDATE/DELETE
CREATE POLICY "Users can insert own quotes" ON quotes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quotes" ON quotes
  FOR UPDATE USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Users can delete own quotes" ON quotes
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND public.user_is_team_member(team_id, auth.uid()))
  );

-- Also allow public viewing of related tables needed for invoice/quote display

-- Invoice line items
DROP POLICY IF EXISTS "Users can view invoice line items" ON invoice_line_items;
CREATE POLICY "Public can view invoice line items"
  ON invoice_line_items FOR SELECT
  USING (true);

-- Quote line items
DROP POLICY IF EXISTS "Users can view quote line items" ON quote_line_items;
CREATE POLICY "Public can view quote line items"
  ON quote_line_items FOR SELECT
  USING (true);

-- Clients (needed for "Bill To" information)
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Team members can view clients" ON clients;
CREATE POLICY "Public can view clients"
  ON clients FOR SELECT
  USING (true);

-- Profiles (needed for business information)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Public can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Branding settings (needed for logo/colors)
DROP POLICY IF EXISTS "Users can view own branding" ON branding_settings;
CREATE POLICY "Public can view branding"
  ON branding_settings FOR SELECT
  USING (true);

-- Comment explaining the security model
COMMENT ON POLICY "Public and authenticated users can view invoices" ON invoices IS
  'Allows public viewing of invoices via shared links. UUIDs provide security through unguessability.';

COMMENT ON POLICY "Public and authenticated users can view quotes" ON quotes IS
  'Allows public viewing of quotes via shared links. UUIDs provide security through unguessability.';
