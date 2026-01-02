// Insert seed data with actual user ID
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'Set' : 'Not set');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  console.error('Available keys:', Object.keys(envVars).join(', '));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertSeedData() {
  console.log('🌱 Inserting seed data...\n');

  // Get the first user from auth.users or use a default
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  let userId;
  if (users && users.users && users.users.length > 0) {
    userId = users.users[0].id;
    console.log(`✅ Using existing user: ${users.users[0].email} (${userId})`);
  } else {
    // Create a demo user if none exists
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'demo@tradiemate.com',
      password: 'DemoPass123!',
      email_confirm: true
    });

    if (createError) {
      console.error('Error creating demo user:', createError);
      return;
    }

    userId = newUser.user.id;
    console.log(`✅ Created demo user: demo@tradiemate.com (${userId})`);
    console.log(`   Password: DemoPass123!`);
  }

  // Insert profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      email: 'demo@tradiemate.com',
      business_name: 'Demo Plumbing Services',
      abn: '12345678901',
      phone: '+61412345678',
      address: '123 Demo Street',
      city: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      primary_color: '#2563eb',
      secondary_color: '#3b82f6',
      subscription_tier: 'pro',
      subscription_status: 'active',
      usage_count: 45
    });

  if (profileError) {
    console.error('Error inserting profile:', profileError);
  } else {
    console.log('✅ Profile created');
  }

  // Insert clients
  const clients = [
    {
      id: 'c0000001-0000-0000-0000-000000000001',
      user_id: userId,
      name: 'Acme Corporation',
      email: 'john@acme.com',
      phone: '+61298765432',
      address: '456 Business Ave',
      city: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      notes: 'Regular client - prefers email communication'
    },
    {
      id: 'c0000002-0000-0000-0000-000000000001',
      user_id: userId,
      name: 'Smith Residence',
      email: 'sarah.smith@gmail.com',
      phone: '+61411223344',
      address: '789 Residential Rd',
      city: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      notes: 'Repeat customer - bathroom renovation project'
    },
    {
      id: 'c0000003-0000-0000-0000-000000000001',
      user_id: userId,
      name: 'Tech Startup Pty Ltd',
      email: 'admin@techstartup.com.au',
      phone: '+61287654321',
      address: '321 Innovation Hub',
      city: 'Brisbane',
      state: 'QLD',
      postcode: '4000',
      notes: 'New office fit-out - fast payment'
    }
  ];

  for (const client of clients) {
    const { error } = await supabase.from('clients').upsert(client);
    if (error) console.error(`Error inserting client ${client.name}:`, error);
  }
  console.log(`✅ ${clients.length} clients created`);

  // Insert invoices
  const invoices = [
    {
      id: 'i0000001-0000-0000-0000-000000000001',
      user_id: userId,
      client_id: 'c0000001-0000-0000-0000-000000000001',
      invoice_number: 'INV-2025-001',
      status: 'sent',
      issue_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal: 1500.00,
      gst: 150.00,
      total: 1650.00,
      amount_paid: 0.00,
      notes: 'Emergency leak repair - completed 7 days ago',
      terms: 'Payment due within 14 days. Late fees apply after due date.',
      is_recurring: false
    },
    {
      id: 'i0000002-0000-0000-0000-000000000001',
      user_id: userId,
      client_id: 'c0000002-0000-0000-0000-000000000001',
      invoice_number: 'INV-2025-002',
      status: 'paid',
      issue_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      due_date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal: 3200.00,
      gst: 320.00,
      total: 3520.00,
      amount_paid: 3520.00,
      notes: 'Hot water system replacement - paid in full',
      terms: 'Thank you for your business!',
      is_recurring: false
    },
    {
      id: 'i0000003-0000-0000-0000-000000000001',
      user_id: userId,
      client_id: 'c0000003-0000-0000-0000-000000000001',
      invoice_number: 'INV-2025-003',
      status: 'overdue',
      issue_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      due_date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal: 5600.00,
      gst: 560.00,
      total: 6160.00,
      amount_paid: 0.00,
      notes: 'Commercial bathroom installation - OVERDUE',
      terms: 'Payment overdue. Please contact us immediately.',
      is_recurring: false
    }
  ];

  for (const invoice of invoices) {
    const { error } = await supabase.from('invoices').upsert(invoice);
    if (error) console.error(`Error inserting invoice ${invoice.invoice_number}:`, error);
  }
  console.log(`✅ ${invoices.length} invoices created`);

  // Insert invoice line items
  const invoiceLineItems = [
    // Invoice 1
    { id: 'il000001-0000-0000-0000-000000000001', invoice_id: 'i0000001-0000-0000-0000-000000000001', description: 'Emergency callout fee (after hours)', quantity: 1, unit_price: 250.00, total: 250.00, item_order: 1 },
    { id: 'il000002-0000-0000-0000-000000000001', invoice_id: 'i0000001-0000-0000-0000-000000000001', description: 'Pipe repair and replacement', quantity: 1, unit_price: 800.00, total: 800.00, item_order: 2 },
    { id: 'il000003-0000-0000-0000-000000000001', invoice_id: 'i0000001-0000-0000-0000-000000000001', description: 'Materials and fittings', quantity: 1, unit_price: 450.00, total: 450.00, item_order: 3 },
    // Invoice 2
    { id: 'il000004-0000-0000-0000-000000000001', invoice_id: 'i0000002-0000-0000-0000-000000000001', description: 'Rheem hot water system (315L)', quantity: 1, unit_price: 2200.00, total: 2200.00, item_order: 1 },
    { id: 'il000005-0000-0000-0000-000000000001', invoice_id: 'i0000002-0000-0000-0000-000000000001', description: 'Installation and old unit removal', quantity: 1, unit_price: 800.00, total: 800.00, item_order: 2 },
    { id: 'il000006-0000-0000-0000-000000000001', invoice_id: 'i0000002-0000-0000-0000-000000000001', description: 'Tempering valve and compliance', quantity: 1, unit_price: 200.00, total: 200.00, item_order: 3 },
    // Invoice 3
    { id: 'il000007-0000-0000-0000-000000000001', invoice_id: 'i0000003-0000-0000-0000-000000000001', description: 'Commercial toilet suites (x3)', quantity: 3, unit_price: 650.00, total: 1950.00, item_order: 1 },
    { id: 'il000008-0000-0000-0000-000000000001', invoice_id: 'i0000003-0000-0000-0000-000000000001', description: 'Hand basins and taps (x3)', quantity: 3, unit_price: 380.00, total: 1140.00, item_order: 2 },
    { id: 'il000009-0000-0000-0000-000000000001', invoice_id: 'i0000003-0000-0000-0000-000000000001', description: 'Accessibility compliance upgrades', quantity: 1, unit_price: 1200.00, total: 1200.00, item_order: 3 },
    { id: 'il000010-0000-0000-0000-000000000001', invoice_id: 'i0000003-0000-0000-0000-000000000001', description: 'Labor and installation (2 days)', quantity: 2, unit_price: 655.00, total: 1310.00, item_order: 4 }
  ];

  for (const item of invoiceLineItems) {
    const { error } = await supabase.from('invoice_line_items').insert(item);
    if (error && !error.message.includes('duplicate')) {
      console.error(`Error inserting line item:`, error);
    }
  }
  console.log(`✅ ${invoiceLineItems.length} invoice line items created`);

  console.log('\n✨ Seed data insertion complete!\n');
  console.log('📊 Summary:');
  console.log('  - 1 profile (Demo Plumbing Services)');
  console.log('  - 3 clients');
  console.log('  - 3 invoices (sent, paid, overdue)');
  console.log('  - 10 line items');
  console.log('\n🔑 Invoice IDs for testing:');
  console.log('  - Sent: i0000001-0000-0000-0000-000000000001');
  console.log('  - Paid: i0000002-0000-0000-0000-000000000001');
  console.log('  - Overdue: i0000003-0000-0000-0000-000000000001');
}

insertSeedData().catch(console.error);
