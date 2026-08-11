-- ============================================================================
-- TradieMate demo seed
--
-- Rewritten 2026-08-11. The previous version had drifted badly from the schema
-- and failed on its first statement:
--
--   * profiles.abn was renamed business_number during the internationalisation
--     work; city / state / postcode / primary_color / secondary_color /
--     subscription_status no longer exist on profiles at all
--   * it INSERTed into public.payments, which does not exist
--   * it INSERTed a profiles row for a user_id with no matching auth.users row,
--     so even with correct columns the FK would have failed
--
-- Verified against the live schema (19 public tables, PostgreSQL 17.6) by
-- executing inside a transaction and rolling back.
--
-- Idempotent: safe to run repeatedly. Re-running refreshes the demo rows rather
-- than duplicating them.
--
-- Run via:  npx supabase db reset --linked
-- ============================================================================

DO $$
DECLARE
  demo_user_id  UUID := '00000000-0000-0000-0000-000000000001';
  demo_team_id  UUID;
  client_a      UUID := 'c0000001-0000-0000-0000-000000000001';
  client_b      UUID := 'c0000002-0000-0000-0000-000000000001';
  client_c      UUID := 'c0000003-0000-0000-0000-000000000001';
  quote_a       UUID := 'a0000001-0000-0000-0000-000000000001';
  invoice_a     UUID := 'b0000001-0000-0000-0000-000000000001';
  job_a         UUID := 'd0000001-0000-0000-0000-000000000001';
BEGIN

  -- --------------------------------------------------------------------------
  -- 1. Auth user
  --
  -- handle_new_user() fires on this insert and creates teams -> profiles ->
  -- team_members in that order. Do not insert those three directly: the trigger
  -- owns them, and duplicating its work is what made the old seed unrunnable.
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      demo_user_id,
      'authenticated', 'authenticated',
      'demo@example.test',
      extensions.crypt('demo-seed-only', extensions.gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"business_name":"Northside Plumbing"}'::jsonb,
      '', '', '', ''
    );
  END IF;

  SELECT team_id INTO demo_team_id FROM public.profiles WHERE user_id = demo_user_id;

  -- --------------------------------------------------------------------------
  -- 2. Profile
  --
  -- The trigger creates a bare profile (user_id, email, team_id). Fill in the
  -- business detail here. Locale columns are set explicitly rather than left to
  -- defaults so the seed exercises the internationalisation path.
  -- --------------------------------------------------------------------------
  UPDATE public.profiles SET
    business_name          = 'Northside Plumbing',
    trade_type             = 'plumber',
    business_number        = '12 345 678 901',
    license_number         = 'PL-48812',
    phone                  = '+61 412 345 678',
    address                = '123 Example Street, Sydney NSW 2000',
    tax_registered         = TRUE,
    default_hourly_rate    = 110.00,
    payment_terms          = 14,
    subscription_tier      = 'pro',
    onboarding_completed   = TRUE,
    country_code           = 'AU',
    currency_code          = 'AUD',
    -- Fraction, not a percentage: profiles_tax_rate_range enforces 0 <= x <= 1,
    -- so 10% GST is 0.10. Writing 10.00 here fails the constraint.
    tax_rate               = 0.10,
    tax_label              = 'GST',
    tax_inclusive_pricing  = TRUE,
    locale                 = 'en-AU'
  WHERE user_id = demo_user_id;

  -- --------------------------------------------------------------------------
  -- 3. Clients
  -- --------------------------------------------------------------------------
  INSERT INTO public.clients (id, user_id, team_id, name, email, phone, address, suburb, state, postcode, notes)
  VALUES
    (client_a, demo_user_id, demo_team_id, 'Sarah Chen',      'sarah.chen@example.test',  '+61 400 111 222', '14 Harbour View Road', 'Mosman',     'NSW', '2088', 'Prefers SMS over calls.'),
    (client_b, demo_user_id, demo_team_id, 'Mercer Property', 'accounts@example.test',    '+61 2 9000 1234', '88 Commerce Way',       'Parramatta', 'NSW', '2150', 'Commercial. Invoices go to accounts@.'),
    (client_c, demo_user_id, demo_team_id, 'Tom Whitfield',   'tom.w@example.test',       '+61 400 333 444', '5 Orchard Lane',        'Newtown',    'NSW', '2042', NULL)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

  -- --------------------------------------------------------------------------
  -- 4. Quote (accepted) with line items
  --
  -- Totals are GST-inclusive to match tax_inclusive_pricing above:
  -- subtotal 2400.00 + 240.00 GST = 2640.00
  -- --------------------------------------------------------------------------
  INSERT INTO public.quotes (id, user_id, team_id, client_id, quote_number, title, description, status,
                             subtotal, tax_amount, total, terms, valid_until, accepted_at)
  VALUES (quote_a, demo_user_id, demo_team_id, client_a, 'Q-1001',
          'Bathroom re-pipe', 'Replace failing copper with PEX, reinstate fixtures.',
          'accepted', 2400.00, 240.00, 2640.00,
          'Valid 30 days. 50% deposit on acceptance.', NOW() + INTERVAL '30 days', NOW() - INTERVAL '6 days')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total = EXCLUDED.total;

  DELETE FROM public.quote_line_items WHERE quote_id = quote_a;
  INSERT INTO public.quote_line_items (quote_id, description, item_type, quantity, unit, unit_price, total, sort_order)
  VALUES
    (quote_a, 'Labour — re-pipe bathroom',      'labour',   16, 'hour', 110.00, 1760.00, 1),
    (quote_a, 'PEX pipe and fittings',          'material',  1, 'lot',  480.00,  480.00, 2),
    (quote_a, 'Mixer tap replacement',          'material',  1, 'each', 160.00,  160.00, 3);

  -- --------------------------------------------------------------------------
  -- 5. Job in progress, converted from the quote
  -- --------------------------------------------------------------------------
  INSERT INTO public.jobs (id, user_id, team_id, client_id, quote_id, title, description, status,
                           site_address, scheduled_date, actual_hours, material_costs)
  VALUES (job_a, demo_user_id, demo_team_id, client_a, quote_a,
          'Bathroom re-pipe', 'Converted from Q-1001.', 'in_progress',
          '14 Harbour View Road, Mosman NSW 2088', CURRENT_DATE + 2, 6.5, 640.00)
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- --------------------------------------------------------------------------
  -- 6. Invoice (sent, partially paid) with line items
  -- --------------------------------------------------------------------------
  INSERT INTO public.invoices (id, user_id, team_id, client_id, invoice_number, title, description, status,
                               subtotal, tax_amount, total, amount_paid, terms, due_date, sent_at)
  VALUES (invoice_a, demo_user_id, demo_team_id, client_b, 'INV-2001',
          'Quarterly maintenance', 'Scheduled maintenance across three sites.',
          'partially_paid', 1800.00, 180.00, 1980.00, 990.00,
          'Net 14.', CURRENT_DATE + 14, NOW() - INTERVAL '3 days')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount_paid = EXCLUDED.amount_paid;

  DELETE FROM public.invoice_line_items WHERE invoice_id = invoice_a;
  INSERT INTO public.invoice_line_items (invoice_id, description, item_type, quantity, unit, unit_price, total, sort_order)
  VALUES
    (invoice_a, 'Site inspection and service', 'labour',   12, 'hour', 125.00, 1500.00, 1),
    (invoice_a, 'Replacement seals and valves','material',  1, 'lot',  300.00,  300.00, 2);

  RAISE NOTICE 'Seed complete: user %, team %', demo_user_id, demo_team_id;

END $$;
