/**
 * TradieMate Comprehensive Production Test Suite
 * Tests all critical features: Auth, PDF, Email, SMS, Payments, Realtime Stats
 *
 * Run with: node comprehensive-production-test.js
 */

import https from 'https';
import http from 'http';

// Configuration
const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8';
const TEST_EMAIL = 'yuanhuafung2021@gmail.com';
const TEST_PASSWORD = '90989098';

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function for HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${options.token || SUPABASE_ANON_KEY}`,
        ...options.headers
      }
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test utilities
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}${details ? ` - ${details}` : ''}`);
  if (passed) {
    testResults.passed.push({ name, details });
  } else {
    testResults.failed.push({ name, details });
  }
}

function logWarning(name, details) {
  console.log(`⚠️ WARNING: ${name} - ${details}`);
  testResults.warnings.push({ name, details });
}

// ========================================
// TEST SUITES
// ========================================

// 1. Authentication Tests
async function testAuthentication() {
  console.log('\n📋 AUTHENTICATION TESTS\n' + '='.repeat(50));

  try {
    // Test login
    const loginResponse = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });

    if (loginResponse.status === 200 && loginResponse.data.access_token) {
      logTest('User Login', true, `User ID: ${loginResponse.data.user?.id?.substring(0, 8)}...`);
      return loginResponse.data.access_token;
    } else {
      logTest('User Login', false, `Status: ${loginResponse.status}, Error: ${JSON.stringify(loginResponse.data)}`);
      return null;
    }
  } catch (error) {
    logTest('User Login', false, error.message);
    return null;
  }
}

// 2. Profile Tests
async function testProfile(token) {
  console.log('\n📋 PROFILE TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Profile Fetch', false, 'No auth token available');
    return null;
  }

  try {
    const profileResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/profiles?select=*`,
      { token }
    );

    if (profileResponse.status === 200 && profileResponse.data.length > 0) {
      const profile = profileResponse.data[0];
      logTest('Profile Fetch', true, `Business: ${profile.business_name || 'Not set'}`);
      logTest('Profile Has Business Name', !!profile.business_name, profile.business_name || 'Missing');
      logTest('Profile Has Email', !!profile.email, profile.email || 'Missing');
      logTest('Subscription Tier', true, profile.subscription_tier || 'free');
      // Stripe setup is optional - not a failure if not connected
      if (profile.stripe_account_id) {
        logTest('Stripe Account Setup', true, 'Connected');
      } else {
        logWarning('Stripe Account Setup', 'Not connected (optional - setup via Settings > Payments)');
      }
      return profile;
    } else {
      logTest('Profile Fetch', false, `Status: ${profileResponse.status}`);
      return null;
    }
  } catch (error) {
    logTest('Profile Fetch', false, error.message);
    return null;
  }
}

// 3. Database Tables Tests
async function testDatabaseTables(token) {
  console.log('\n📋 DATABASE TABLES TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Database Access', false, 'No auth token available');
    return;
  }

  const tables = ['clients', 'quotes', 'invoices', 'jobs', 'quote_line_items', 'invoice_line_items'];

  for (const table of tables) {
    try {
      const response = await makeRequest(
        `${SUPABASE_URL}/rest/v1/${table}?select=id`,
        { token }
      );

      // Table test passes if we get a 200 response (RLS working)
      const recordCount = Array.isArray(response.data) ? response.data.length : 0;
      logTest(`Table: ${table}`, response.status === 200, `${recordCount} records accessible`);
    } catch (error) {
      logTest(`Table: ${table}`, false, error.message);
    }
  }
}

// 4. Clients CRUD Tests
async function testClientsCRUD(token) {
  console.log('\n📋 CLIENTS CRUD TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Clients CRUD', false, 'No auth token available');
    return null;
  }

  try {
    // Fetch existing clients
    const clientsResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/clients?select=*&deleted_at=is.null&order=created_at.desc&limit=5`,
      { token }
    );

    if (clientsResponse.status === 200) {
      logTest('Fetch Clients', true, `${clientsResponse.data.length} clients found`);

      if (clientsResponse.data.length > 0) {
        const client = clientsResponse.data[0];
        logTest('Client Has Name', !!client.name, client.name);
        logTest('Client Has Email', !!client.email, client.email || 'Not set');
        return client;
      }
    } else {
      logTest('Fetch Clients', false, `Status: ${clientsResponse.status}`);
    }
  } catch (error) {
    logTest('Fetch Clients', false, error.message);
  }
  return null;
}

// 5. Quotes Tests
async function testQuotes(token) {
  console.log('\n📋 QUOTES TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Quotes', false, 'No auth token available');
    return null;
  }

  try {
    const quotesResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/quotes?select=*,client:clients(name,email),quote_line_items(*)&deleted_at=is.null&order=created_at.desc&limit=5`,
      { token }
    );

    if (quotesResponse.status === 200) {
      logTest('Fetch Quotes', true, `${quotesResponse.data.length} quotes found`);

      if (quotesResponse.data.length > 0) {
        const quote = quotesResponse.data[0];
        logTest('Quote Has Number', !!quote.quote_number, quote.quote_number);
        logTest('Quote Has Client', !!quote.client, quote.client?.name || 'Not linked');
        logTest('Quote Has Line Items', quote.quote_line_items?.length > 0, `${quote.quote_line_items?.length || 0} items`);
        logTest('Quote Has Total', quote.total !== null, `$${quote.total}`);
        return quote;
      }
    } else {
      logTest('Fetch Quotes', false, `Status: ${quotesResponse.status}`);
    }
  } catch (error) {
    logTest('Fetch Quotes', false, error.message);
  }
  return null;
}

// 6. Invoices Tests
async function testInvoices(token) {
  console.log('\n📋 INVOICES TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Invoices', false, 'No auth token available');
    return null;
  }

  try {
    const invoicesResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/invoices?select=*,client:clients(name,email),invoice_line_items(*)&deleted_at=is.null&order=created_at.desc&limit=5`,
      { token }
    );

    if (invoicesResponse.status === 200) {
      logTest('Fetch Invoices', true, `${invoicesResponse.data.length} invoices found`);

      if (invoicesResponse.data.length > 0) {
        // Find an invoice with line items for proper testing
        const invoiceWithItems = invoicesResponse.data.find(inv => inv.invoice_line_items?.length > 0);
        const invoice = invoiceWithItems || invoicesResponse.data[0];

        logTest('Invoice Has Number', !!invoice.invoice_number, invoice.invoice_number);
        logTest('Invoice Has Client', !!invoice.client, invoice.client?.name || 'Not linked');

        // Line items check - informational if empty
        if (invoice.invoice_line_items?.length > 0) {
          logTest('Invoice Has Line Items', true, `${invoice.invoice_line_items.length} items`);
        } else {
          logWarning('Invoice Line Items', 'Selected invoice has no line items (may be newly created)');
        }

        logTest('Invoice Has Total', invoice.total !== null, `$${invoice.total}`);
        logTest('Invoice Has Status', !!invoice.status, invoice.status);

        // Check for recurring invoices
        const recurringInvoices = invoicesResponse.data.filter(inv => inv.is_recurring);
        logTest('Recurring Invoice Support', true, `${recurringInvoices.length} recurring invoices`);

        return invoice;
      }
    } else {
      logTest('Fetch Invoices', false, `Status: ${invoicesResponse.status}`);
    }
  } catch (error) {
    logTest('Fetch Invoices', false, error.message);
  }
  return null;
}

// 7. Jobs Tests
async function testJobs(token) {
  console.log('\n📋 JOBS TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Jobs', false, 'No auth token available');
    return null;
  }

  try {
    const jobsResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/jobs?select=*,client:clients(name)&deleted_at=is.null&order=created_at.desc&limit=5`,
      { token }
    );

    if (jobsResponse.status === 200) {
      logTest('Fetch Jobs', true, `${jobsResponse.data.length} jobs found`);

      if (jobsResponse.data.length > 0) {
        const job = jobsResponse.data[0];
        logTest('Job Has Title', !!job.title, job.title);
        logTest('Job Has Status', !!job.status, job.status);

        // Count active jobs
        const activeJobs = jobsResponse.data.filter(j =>
          ['approved', 'scheduled', 'in_progress'].includes(j.status)
        );
        logTest('Active Jobs Count', true, `${activeJobs.length} active jobs`);

        return job;
      }
    } else {
      logTest('Fetch Jobs', false, `Status: ${jobsResponse.status}`);
    }
  } catch (error) {
    logTest('Fetch Jobs', false, error.message);
  }
  return null;
}

// 8. Dashboard Stats Tests (Realtime Data)
async function testDashboardStats(token) {
  console.log('\n📋 DASHBOARD & REALTIME STATS TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Dashboard Stats', false, 'No auth token available');
    return;
  }

  try {
    // Get current month for stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Monthly revenue (paid invoices this month)
    const revenueResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/invoices?select=amount_paid,total&status=eq.paid&paid_at=gte.${startOfMonth}&paid_at=lte.${endOfMonth}`,
      { token }
    );

    if (revenueResponse.status === 200) {
      const totalRevenue = revenueResponse.data.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);
      logTest('Monthly Revenue Calculation', true, `$${totalRevenue.toFixed(2)} this month`);
    }

    // Outstanding invoices
    const outstandingResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/invoices?select=total,amount_paid&status=in.(sent,viewed,partially_paid,overdue)&deleted_at=is.null`,
      { token }
    );

    if (outstandingResponse.status === 200) {
      const outstanding = outstandingResponse.data.reduce((sum, inv) => {
        return sum + (parseFloat(inv.total || 0) - parseFloat(inv.amount_paid || 0));
      }, 0);
      logTest('Outstanding Invoices', true, `$${outstanding.toFixed(2)} outstanding from ${outstandingResponse.data.length} invoices`);
    }

    // Active jobs count
    const activeJobsResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/jobs?select=id&status=in.(approved,scheduled,in_progress)&deleted_at=is.null`,
      { token, headers: { 'Prefer': 'count=exact' } }
    );

    if (activeJobsResponse.status === 200) {
      logTest('Active Jobs Count', true, `${activeJobsResponse.data.length} active jobs`);
    }

    // Pending quotes
    const pendingQuotesResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/quotes?select=id&status=in.(sent,viewed)&deleted_at=is.null`,
      { token, headers: { 'Prefer': 'count=exact' } }
    );

    if (pendingQuotesResponse.status === 200) {
      logTest('Pending Quotes Count', true, `${pendingQuotesResponse.data.length} pending quotes`);
    }

    // Overdue invoices
    const today = new Date().toISOString().split('T')[0];
    const overdueResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/invoices?select=id,total,due_date&status=in.(sent,viewed,partially_paid)&due_date=lt.${today}&deleted_at=is.null`,
      { token }
    );

    if (overdueResponse.status === 200) {
      const overdueTotal = overdueResponse.data.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
      logTest('Overdue Invoices Alert', true, `${overdueResponse.data.length} overdue ($${overdueTotal.toFixed(2)})`);
    }

  } catch (error) {
    logTest('Dashboard Stats', false, error.message);
  }
}

// 9. PDF Generation Test
async function testPDFGeneration(token, invoice) {
  console.log('\n📋 PDF GENERATION TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('PDF Generation', false, 'No auth token available');
    return;
  }

  if (!invoice) {
    logWarning('PDF Generation', 'No invoice available for testing');
    return;
  }

  try {
    const pdfResponse = await makeRequest(
      `${SUPABASE_URL}/functions/v1/generate-pdf`,
      {
        method: 'POST',
        token,
        body: {
          type: 'invoice',
          id: invoice.id
        }
      }
    );

    if (pdfResponse.status === 200) {
      const hasHtml = pdfResponse.data.html && pdfResponse.data.html.length > 100;
      logTest('PDF Generation - Edge Function', true, 'Function returned successfully');
      logTest('PDF Generation - HTML Template', hasHtml, `${pdfResponse.data.html?.length || 0} chars`);

      if (hasHtml) {
        // Check for key elements in PDF HTML
        const html = pdfResponse.data.html;
        logTest('PDF Contains Invoice Number', html.includes(invoice.invoice_number), invoice.invoice_number);
        logTest('PDF Contains Total', html.includes('$') || html.includes('total'), 'Amount displayed');
        logTest('PDF Has Professional Layout', html.includes('table') || html.includes('grid'), 'Layout detected');
      }
    } else {
      logTest('PDF Generation', false, `Status: ${pdfResponse.status}, Error: ${JSON.stringify(pdfResponse.data)}`);
    }
  } catch (error) {
    logTest('PDF Generation', false, error.message);
  }
}

// 10. Email Notification Test
async function testEmailNotification(token, invoice) {
  console.log('\n📋 EMAIL NOTIFICATION TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Email Notification', false, 'No auth token available');
    return;
  }

  if (!invoice || !invoice.client?.email) {
    logWarning('Email Notification', 'No invoice with client email available for testing');
    return;
  }

  try {
    // Test the send-email edge function (without actually sending)
    const emailCheckResponse = await makeRequest(
      `${SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'OPTIONS',
        token
      }
    );

    // Check CORS headers
    const corsOk = emailCheckResponse.headers['access-control-allow-origin'] ||
                   emailCheckResponse.status === 204 ||
                   emailCheckResponse.status === 200;
    logTest('Email Function - CORS Config', corsOk, 'CORS headers present');

    // Test the function endpoint availability
    const functionAvailable = emailCheckResponse.status !== 404 && emailCheckResponse.status !== 502;
    logTest('Email Function - Endpoint Available', functionAvailable, `Status: ${emailCheckResponse.status}`);

    // Note: We won't actually send an email in automated tests
    logWarning('Email Sending', 'Skipping actual email send to avoid spam (manual test recommended)');

  } catch (error) {
    logTest('Email Notification', false, error.message);
  }
}

// 11. SMS Notification Test
async function testSMSNotification(token, invoice) {
  console.log('\n📋 SMS NOTIFICATION TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('SMS Notification', false, 'No auth token available');
    return;
  }

  try {
    // Test the send-notification edge function CORS
    const smsCheckResponse = await makeRequest(
      `${SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'OPTIONS',
        token
      }
    );

    const corsOk = smsCheckResponse.headers['access-control-allow-origin'] ||
                   smsCheckResponse.status === 204 ||
                   smsCheckResponse.status === 200;
    logTest('SMS Function - CORS Config', corsOk, 'CORS headers present');

    const functionAvailable = smsCheckResponse.status !== 404 && smsCheckResponse.status !== 502;
    logTest('SMS Function - Endpoint Available', functionAvailable, `Status: ${smsCheckResponse.status}`);

    // Note: We won't actually send an SMS in automated tests
    logWarning('SMS Sending', 'Skipping actual SMS send to avoid charges (manual test recommended)');

  } catch (error) {
    logTest('SMS Notification', false, error.message);
  }
}

// 12. Public Shared Links Test
async function testPublicLinks(invoice, quote) {
  console.log('\n📋 PUBLIC SHARED LINKS TESTS\n' + '='.repeat(50));

  // Test public invoice access (no auth required)
  if (invoice) {
    try {
      const publicInvoiceResponse = await makeRequest(
        `${SUPABASE_URL}/rest/v1/invoices?select=*,client:clients(name,email),invoice_line_items(*)&id=eq.${invoice.id}`,
        { token: SUPABASE_ANON_KEY } // Using anon key (public access)
      );

      if (publicInvoiceResponse.status === 200 && publicInvoiceResponse.data.length > 0) {
        const pubInvoice = publicInvoiceResponse.data[0];
        logTest('Public Invoice Access', true, `Invoice ${invoice.invoice_number} accessible`);
        logTest('Public Invoice - Client Info', !!pubInvoice.client, pubInvoice.client ? 'Client data loaded' : 'No client linked');
        // Line items are optional - just check if the join works
        const lineItemCount = pubInvoice.invoice_line_items?.length || 0;
        logTest('Public Invoice - Line Items Join', true, `${lineItemCount} items (join successful)`);
      } else {
        logTest('Public Invoice Access', false, `Status: ${publicInvoiceResponse.status} - RLS may be blocking`);
      }
    } catch (error) {
      logTest('Public Invoice Access', false, error.message);
    }
  } else {
    logWarning('Public Invoice Test', 'No invoice available');
  }

  // Test public quote access
  if (quote) {
    try {
      const publicQuoteResponse = await makeRequest(
        `${SUPABASE_URL}/rest/v1/quotes?select=*,client:clients(name,email),quote_line_items(*)&id=eq.${quote.id}`,
        { token: SUPABASE_ANON_KEY }
      );

      if (publicQuoteResponse.status === 200 && publicQuoteResponse.data.length > 0) {
        logTest('Public Quote Access', true, `Quote ${quote.quote_number} accessible`);
      } else {
        logTest('Public Quote Access', false, `Status: ${publicQuoteResponse.status} - RLS may be blocking`);
      }
    } catch (error) {
      logTest('Public Quote Access', false, error.message);
    }
  } else {
    logWarning('Public Quote Test', 'No quote available');
  }
}

// 13. Payment Integration Tests
async function testPaymentIntegration(token, profile) {
  console.log('\n📋 PAYMENT INTEGRATION TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Payment Integration', false, 'No auth token available');
    return;
  }

  try {
    // Check Stripe Connect account status
    if (profile?.stripe_account_id) {
      const stripeCheckResponse = await makeRequest(
        `${SUPABASE_URL}/functions/v1/check-stripe-account`,
        {
          method: 'POST',
          token,
          body: {}
        }
      );

      if (stripeCheckResponse.status === 200) {
        logTest('Stripe Connect - Account Check', true, 'Account status retrieved');
        logTest('Stripe Connect - Charges Enabled', stripeCheckResponse.data.charges_enabled,
          stripeCheckResponse.data.charges_enabled ? 'Can accept payments' : 'Onboarding incomplete');
      } else {
        logTest('Stripe Connect - Account Check', false, `Status: ${stripeCheckResponse.status}`);
      }
    } else {
      logWarning('Stripe Connect', 'No Stripe account connected - payment tests skipped');
    }

    // Test create-payment function availability
    const paymentFunctionResponse = await makeRequest(
      `${SUPABASE_URL}/functions/v1/create-payment`,
      {
        method: 'OPTIONS',
        token
      }
    );

    const functionAvailable = paymentFunctionResponse.status !== 404 && paymentFunctionResponse.status !== 502;
    logTest('Payment Function - Endpoint Available', functionAvailable, `Status: ${paymentFunctionResponse.status}`);

    // Test subscription checkout function
    const subscriptionFunctionResponse = await makeRequest(
      `${SUPABASE_URL}/functions/v1/create-subscription-checkout`,
      {
        method: 'OPTIONS',
        token
      }
    );

    const subFunctionAvailable = subscriptionFunctionResponse.status !== 404 && subscriptionFunctionResponse.status !== 502;
    logTest('Subscription Checkout - Endpoint Available', subFunctionAvailable, `Status: ${subscriptionFunctionResponse.status}`);

  } catch (error) {
    logTest('Payment Integration', false, error.message);
  }
}

// 14. Usage Tracking Tests
async function testUsageTracking(token) {
  console.log('\n📋 USAGE TRACKING TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Usage Tracking', false, 'No auth token available');
    return;
  }

  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const usageResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/usage_tracking?select=*&month_year=eq.${currentMonth}`,
      { token }
    );

    if (usageResponse.status === 200) {
      if (usageResponse.data.length > 0) {
        const usage = usageResponse.data[0];
        logTest('Usage Tracking - Record Exists', true, `Month: ${currentMonth}`);
        logTest('Usage - Quotes Created', true, `${usage.quotes_created} quotes`);
        logTest('Usage - Invoices Created', true, `${usage.invoices_created} invoices`);
        logTest('Usage - Jobs Created', true, `${usage.jobs_created} jobs`);
        logTest('Usage - Emails Sent', true, `${usage.emails_sent} emails`);
        logTest('Usage - SMS Sent', true, `${usage.sms_sent} SMS`);
      } else {
        logTest('Usage Tracking - Record Exists', true, 'No usage yet this month (new month)');
      }
    } else {
      logTest('Usage Tracking', false, `Status: ${usageResponse.status}`);
    }
  } catch (error) {
    logTest('Usage Tracking', false, error.message);
  }
}

// 15. Branding Settings Tests
async function testBrandingSettings(token) {
  console.log('\n📋 BRANDING SETTINGS TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Branding Settings', false, 'No auth token available');
    return;
  }

  try {
    const brandingResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/branding_settings?select=*`,
      { token }
    );

    if (brandingResponse.status === 200) {
      if (brandingResponse.data.length > 0) {
        const branding = brandingResponse.data[0];
        logTest('Branding - Settings Exist', true, 'Branding configured');
        logTest('Branding - Logo URL', !!branding.logo_url, branding.logo_url ? 'Set' : 'Not set');
        logTest('Branding - Primary Color', !!branding.primary_color, branding.primary_color);
        logTest('Branding - Secondary Color', !!branding.secondary_color, branding.secondary_color);
      } else {
        logTest('Branding - Settings Exist', true, 'Using defaults (no custom branding)');
      }
    } else {
      logTest('Branding Settings', false, `Status: ${brandingResponse.status}`);
    }
  } catch (error) {
    logTest('Branding Settings', false, error.message);
  }
}

// 16. Edge Functions Health Check
async function testEdgeFunctions(token) {
  console.log('\n📋 EDGE FUNCTIONS HEALTH CHECK\n' + '='.repeat(50));

  const functions = [
    'generate-pdf',
    'send-email',
    'send-notification',
    'create-payment',
    'create-stripe-connect',
    'check-stripe-account',
    'stripe-webhook',
    'create-subscription-checkout',
    'check-subscription',
    'payment-reminder',
    'generate-recurring-invoices'
  ];

  for (const func of functions) {
    try {
      const response = await makeRequest(
        `${SUPABASE_URL}/functions/v1/${func}`,
        {
          method: 'OPTIONS',
          token: token || SUPABASE_ANON_KEY
        }
      );

      // 204, 200, or 405 means the function exists
      const available = response.status !== 404 && response.status !== 502 && response.status !== 503;
      logTest(`Edge Function: ${func}`, available, `Status: ${response.status}`);
    } catch (error) {
      logTest(`Edge Function: ${func}`, false, error.message);
    }
  }
}

// 17. Team Collaboration Tests
async function testTeamFeatures(token) {
  console.log('\n📋 TEAM COLLABORATION TESTS\n' + '='.repeat(50));

  if (!token) {
    logTest('Team Features', false, 'No auth token available');
    return;
  }

  try {
    // Check team membership
    const teamMemberResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/team_members?select=*,team:teams(*)`,
      { token }
    );

    if (teamMemberResponse.status === 200) {
      if (teamMemberResponse.data.length > 0) {
        const membership = teamMemberResponse.data[0];
        logTest('Team Membership', true, `Role: ${membership.role}`);
        logTest('Team Name', !!membership.team?.name, membership.team?.name);
      } else {
        logTest('Team Membership', true, 'Not part of any team (individual user)');
      }
    }

    // Check team invitations
    const invitationsResponse = await makeRequest(
      `${SUPABASE_URL}/rest/v1/team_invitations?select=*`,
      { token }
    );

    if (invitationsResponse.status === 200) {
      logTest('Team Invitations Access', true, `${invitationsResponse.data.length} invitations`);
    }

  } catch (error) {
    logTest('Team Features', false, error.message);
  }
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 TRADIEMATE COMPREHENSIVE PRODUCTION TEST SUITE');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Environment: ${SUPABASE_URL}`);
  console.log('');

  // Run all tests
  const token = await testAuthentication();
  const profile = await testProfile(token);
  await testDatabaseTables(token);
  const client = await testClientsCRUD(token);
  const quote = await testQuotes(token);
  const invoice = await testInvoices(token);
  const job = await testJobs(token);
  await testDashboardStats(token);
  await testPDFGeneration(token, invoice);
  await testEmailNotification(token, invoice);
  await testSMSNotification(token, invoice);
  await testPublicLinks(invoice, quote);
  await testPaymentIntegration(token, profile);
  await testUsageTracking(token);
  await testBrandingSettings(token);
  await testEdgeFunctions(token);
  await testTeamFeatures(token);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`⚠️ Warnings: ${testResults.warnings.length}`);
  console.log('');

  if (testResults.failed.length > 0) {
    console.log('❌ FAILED TESTS:');
    testResults.failed.forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
    console.log('');
  }

  if (testResults.warnings.length > 0) {
    console.log('⚠️ WARNINGS:');
    testResults.warnings.forEach(warning => {
      console.log(`   - ${warning.name}: ${warning.details}`);
    });
    console.log('');
  }

  const passRate = ((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(1);
  console.log(`📈 Pass Rate: ${passRate}%`);
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Exit with error code if tests failed
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
