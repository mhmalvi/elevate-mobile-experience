-- TradieMate Seed Data for Testing
-- This script creates demo data for testing all features

-- First, let's create a test user profile
-- NOTE: You need to create this user in Supabase Auth first
-- For now, we'll use a placeholder user_id that you should replace

-- Insert a test profile (replace with your actual user_id from Supabase Auth)
INSERT INTO profiles (
  user_id,
  email,
  business_name,
  abn,
  phone,
  address,
  city,
  state,
  postcode,
  logo_url,
  primary_color,
  secondary_color,
  subscription_tier,
  subscription_status,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with real user_id
  'demo@tradiemate.com',
  'Demo Plumbing Services',
  '12345678901',
  '+61412345678',
  '123 Demo Street',
  'Sydney',
  'NSW',
  '2000',
  NULL,
  '#2563eb', -- Blue
  '#3b82f6', -- Light Blue
  'pro',
  'active',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  abn = EXCLUDED.abn,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  postcode = EXCLUDED.postcode,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_status = EXCLUDED.subscription_status;

-- Insert test clients
INSERT INTO clients (
  id,
  user_id,
  name,
  email,
  phone,
  address,
  city,
  state,
  postcode,
  notes,
  created_at
) VALUES
(
  'c0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Acme Corporation',
  'john@acme.com',
  '+61298765432',
  '456 Business Ave',
  'Sydney',
  'NSW',
  '2000',
  'Regular client - prefers email communication',
  NOW() - INTERVAL '30 days'
),
(
  'c0000002-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Smith Residence',
  'sarah.smith@gmail.com',
  '+61411223344',
  '789 Residential Rd',
  'Melbourne',
  'VIC',
  '3000',
  'Repeat customer - bathroom renovation project',
  NOW() - INTERVAL '15 days'
),
(
  'c0000003-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Tech Startup Pty Ltd',
  'admin@techstartup.com.au',
  '+61287654321',
  '321 Innovation Hub',
  'Brisbane',
  'QLD',
  '4000',
  'New office fit-out - fast payment',
  NOW() - INTERVAL '7 days'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- Insert test quotes
INSERT INTO quotes (
  id,
  user_id,
  client_id,
  quote_number,
  status,
  issue_date,
  valid_until,
  subtotal,
  gst,
  total,
  notes,
  terms,
  created_at
) VALUES
(
  'q0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'QT-2025-001',
  'sent',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '25 days',
  2500.00,
  250.00,
  2750.00,
  'Kitchen plumbing installation - includes all materials and labor',
  'Quote valid for 30 days. 50% deposit required to commence work.',
  NOW() - INTERVAL '5 days'
),
(
  'q0000002-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000001',
  'QT-2025-002',
  'accepted',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '20 days',
  4800.00,
  480.00,
  5280.00,
  'Complete bathroom renovation including fixtures and tiling',
  'Payment due within 7 days of completion.',
  NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  subtotal = EXCLUDED.subtotal,
  gst = EXCLUDED.gst,
  total = EXCLUDED.total;

-- Insert quote line items
INSERT INTO quote_line_items (
  id,
  quote_id,
  description,
  quantity,
  unit_price,
  total,
  item_order
) VALUES
-- Quote 1 items
(
  'ql000001-0000-0000-0000-000000000001',
  'q0000001-0000-0000-0000-000000000001',
  'Kitchen sink installation (premium stainless steel)',
  1,
  800.00,
  800.00,
  1
),
(
  'ql000002-0000-0000-0000-000000000001',
  'q0000001-0000-0000-0000-000000000001',
  'Water supply pipe replacement (copper pipes, 15m)',
  15,
  45.00,
  675.00,
  2
),
(
  'ql000003-0000-0000-0000-000000000001',
  'q0000001-0000-0000-0000-000000000001',
  'Dishwasher connection and installation',
  1,
  350.00,
  350.00,
  3
),
(
  'ql000004-0000-0000-0000-000000000001',
  'q0000001-0000-0000-0000-000000000001',
  'Labor and materials',
  1,
  675.00,
  675.00,
  4
),
-- Quote 2 items
(
  'ql000005-0000-0000-0000-000000000001',
  'q0000002-0000-0000-0000-000000000001',
  'Toilet suite removal and installation (Caroma dual flush)',
  1,
  950.00,
  950.00,
  1
),
(
  'ql000006-0000-0000-0000-000000000001',
  'q0000002-0000-0000-0000-000000000001',
  'Shower screen installation (frameless glass 1800x900mm)',
  1,
  1200.00,
  1200.00,
  2
),
(
  'ql000007-0000-0000-0000-000000000001',
  'q0000002-0000-0000-0000-000000000001',
  'Vanity unit with basin (1200mm)',
  1,
  850.00,
  850.00,
  3
),
(
  'ql000008-0000-0000-0000-000000000001',
  'q0000002-0000-0000-0000-000000000001',
  'Tiling work (walls and floor, 10sqm)',
  10,
  120.00,
  1200.00,
  4
),
(
  'ql000009-0000-0000-0000-000000000001',
  'q0000002-0000-0000-0000-000000000001',
  'Plumbing and waterproofing',
  1,
  600.00,
  600.00,
  5
)
ON CONFLICT (id) DO NOTHING;

-- Insert test invoices
INSERT INTO invoices (
  id,
  user_id,
  client_id,
  invoice_number,
  status,
  issue_date,
  due_date,
  subtotal,
  gst,
  total,
  amount_paid,
  notes,
  terms,
  is_recurring,
  created_at
) VALUES
(
  'i0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'INV-2025-001',
  'sent',
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '7 days',
  1500.00,
  150.00,
  1650.00,
  0.00,
  'Emergency leak repair - completed 7 days ago',
  'Payment due within 14 days. Late fees apply after due date.',
  false,
  NOW() - INTERVAL '7 days'
),
(
  'i0000002-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000001',
  'INV-2025-002',
  'paid',
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '16 days',
  3200.00,
  320.00,
  3520.00,
  3520.00,
  'Hot water system replacement - paid in full',
  'Thank you for your business!',
  false,
  NOW() - INTERVAL '30 days'
),
(
  'i0000003-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000003-0000-0000-0000-000000000001',
  'INV-2025-003',
  'overdue',
  CURRENT_DATE - INTERVAL '25 days',
  CURRENT_DATE - INTERVAL '11 days',
  5600.00,
  560.00,
  6160.00,
  0.00,
  'Commercial bathroom installation - OVERDUE',
  'Payment overdue. Please contact us immediately.',
  false,
  NOW() - INTERVAL '25 days'
),
(
  'i0000004-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'INV-2025-004',
  'partially_paid',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '4 days',
  4000.00,
  400.00,
  4400.00,
  2200.00,
  'Office plumbing upgrade - 50% deposit received',
  'Remaining balance due on completion.',
  false,
  NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  amount_paid = EXCLUDED.amount_paid;

-- Insert invoice line items
INSERT INTO invoice_line_items (
  id,
  invoice_id,
  description,
  quantity,
  unit_price,
  total,
  item_order
) VALUES
-- Invoice 1 items
(
  'il000001-0000-0000-0000-000000000001',
  'i0000001-0000-0000-0000-000000000001',
  'Emergency callout fee (after hours)',
  1,
  250.00,
  250.00,
  1
),
(
  'il000002-0000-0000-0000-000000000001',
  'i0000001-0000-0000-0000-000000000001',
  'Pipe repair and replacement',
  1,
  800.00,
  800.00,
  2
),
(
  'il000003-0000-0000-0000-000000000001',
  'i0000001-0000-0000-0000-000000000001',
  'Materials and fittings',
  1,
  450.00,
  450.00,
  3
),
-- Invoice 2 items
(
  'il000004-0000-0000-0000-000000000001',
  'i0000002-0000-0000-0000-000000000001',
  'Rheem hot water system (315L)',
  1,
  2200.00,
  2200.00,
  1
),
(
  'il000005-0000-0000-0000-000000000001',
  'i0000002-0000-0000-0000-000000000001',
  'Installation and old unit removal',
  1,
  800.00,
  800.00,
  2
),
(
  'il000006-0000-0000-0000-000000000001',
  'i0000002-0000-0000-0000-000000000001',
  'Tempering valve and compliance',
  1,
  200.00,
  200.00,
  3
),
-- Invoice 3 items
(
  'il000007-0000-0000-0000-000000000001',
  'i0000003-0000-0000-0000-000000000001',
  'Commercial toilet suites (x3)',
  3,
  650.00,
  1950.00,
  1
),
(
  'il000008-0000-0000-0000-000000000001',
  'i0000003-0000-0000-0000-000000000001',
  'Hand basins and taps (x3)',
  3,
  380.00,
  1140.00,
  2
),
(
  'il000009-0000-0000-0000-000000000001',
  'i0000003-0000-0000-0000-000000000001',
  'Accessibility compliance upgrades',
  1,
  1200.00,
  1200.00,
  3
),
(
  'il000010-0000-0000-0000-000000000001',
  'i0000003-0000-0000-0000-000000000001',
  'Labor and installation (2 days)',
  2,
  655.00,
  1310.00,
  4
),
-- Invoice 4 items
(
  'il000011-0000-0000-0000-000000000001',
  'i0000004-0000-0000-0000-000000000001',
  'Water filtration system installation',
  1,
  1800.00,
  1800.00,
  1
),
(
  'il000012-0000-0000-0000-000000000001',
  'i0000004-0000-0000-0000-000000000001',
  'Kitchen plumbing upgrades',
  1,
  1200.00,
  1200.00,
  2
),
(
  'il000013-0000-0000-0000-000000000001',
  'i0000004-0000-0000-0000-000000000001',
  'Bathroom fixture replacements',
  1,
  1000.00,
  1000.00,
  3
)
ON CONFLICT (id) DO NOTHING;

-- Insert payment records
INSERT INTO payments (
  id,
  invoice_id,
  amount,
  payment_date,
  payment_method,
  transaction_id,
  notes,
  created_at
) VALUES
(
  'p0000001-0000-0000-0000-000000000001',
  'i0000002-0000-0000-0000-000000000001',
  3520.00,
  CURRENT_DATE - INTERVAL '20 days',
  'bank_transfer',
  'TXN-20250110-001',
  'Full payment received via bank transfer',
  NOW() - INTERVAL '20 days'
),
(
  'p0000002-0000-0000-0000-000000000001',
  'i0000004-0000-0000-0000-000000000001',
  2200.00,
  CURRENT_DATE - INTERVAL '9 days',
  'credit_card',
  'STRIPE-ch_3ABC123',
  '50% deposit - Stripe payment',
  NOW() - INTERVAL '9 days'
)
ON CONFLICT (id) DO NOTHING;

-- Insert test jobs
INSERT INTO jobs (
  id,
  user_id,
  client_id,
  title,
  description,
  status,
  priority,
  scheduled_date,
  scheduled_time,
  location,
  estimated_duration,
  notes,
  created_at
) VALUES
(
  'j0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'Kitchen Renovation - Plumbing Work',
  'Complete kitchen plumbing installation including sink, dishwasher, and water filtration system',
  'in_progress',
  'high',
  CURRENT_DATE + INTERVAL '2 days',
  '09:00',
  '456 Business Ave, Sydney NSW 2000',
  4,
  'Client requested early start. Bring ladder and extra fittings.',
  NOW() - INTERVAL '3 days'
),
(
  'j0000002-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000001',
  'Bathroom Inspection',
  'Pre-renovation inspection and assessment',
  'completed',
  'medium',
  CURRENT_DATE - INTERVAL '5 days',
  '14:00',
  '789 Residential Rd, Melbourne VIC 3000',
  1,
  'Inspection completed. Quote sent.',
  NOW() - INTERVAL '8 days'
),
(
  'j0000003-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'c0000003-0000-0000-0000-000000000001',
  'Emergency Leak Repair',
  'Urgent leak in main water line - immediate response required',
  'scheduled',
  'urgent',
  CURRENT_DATE + INTERVAL '1 day',
  '08:00',
  '321 Innovation Hub, Brisbane QLD 4000',
  2,
  'Emergency callout - client notified of after-hours rates',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status;

-- Update usage tracking for the demo profile
UPDATE profiles
SET
  usage_count = 45,
  usage_reset_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 1 demo profile (Demo Plumbing Services)';
  RAISE NOTICE '  - 3 clients (Acme Corp, Smith Residence, Tech Startup)';
  RAISE NOTICE '  - 2 quotes (1 sent, 1 accepted)';
  RAISE NOTICE '  - 4 invoices (1 sent, 1 paid, 1 overdue, 1 partially paid)';
  RAISE NOTICE '  - 3 jobs (1 in progress, 1 completed, 1 scheduled)';
  RAISE NOTICE '  - 2 payment records';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Replace user_id 00000000-0000-0000-0000-000000000001 with your actual auth user ID!';
END $$;
