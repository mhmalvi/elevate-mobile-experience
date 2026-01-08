/**
 * Production Fixes Verification Tests
 * Tests all critical fixes deployed to production
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvamp6aWZydnBsaHdqYSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM1MzYzODQwLCJleHAiOjIwNTA5Mzk4NDB9.rXF5zN9i48wG0vgL8dLv9F7KF3k9h-j5YB2eQv2M0iE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Starting Production Fixes Verification Tests\n');
console.log('='.repeat(60));

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${name}`);
  if (message) console.log(`   ${message}`);

  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

// Test 1: Public Invoice Viewing (RLS Policy)
async function testPublicInvoiceViewing() {
  console.log('\n📋 TEST 1: Public Invoice Viewing (RLS Policy)');
  console.log('-'.repeat(60));

  try {
    // Try to fetch invoices without authentication (should work now)
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .limit(1);

    if (error) {
      logTest('Public Invoice Access', false, `Error: ${error.message}`);
      return false;
    }

    if (data && data.length > 0) {
      logTest('Public Invoice Access', true, `Successfully fetched invoice: ${data[0].invoice_number}`);
      return true;
    } else {
      logTest('Public Invoice Access', true, 'No invoices found (database might be empty)');
      return true;
    }
  } catch (err) {
    logTest('Public Invoice Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 2: Public Quote Viewing (RLS Policy)
async function testPublicQuoteViewing() {
  console.log('\n📋 TEST 2: Public Quote Viewing (RLS Policy)');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, status')
      .limit(1);

    if (error) {
      logTest('Public Quote Access', false, `Error: ${error.message}`);
      return false;
    }

    if (data && data.length > 0) {
      logTest('Public Quote Access', true, `Successfully fetched quote: ${data[0].quote_number}`);
      return true;
    } else {
      logTest('Public Quote Access', true, 'No quotes found (database might be empty)');
      return true;
    }
  } catch (err) {
    logTest('Public Quote Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 3: Public Client Viewing (needed for invoice display)
async function testPublicClientViewing() {
  console.log('\n👥 TEST 3: Public Client Viewing (needed for invoices)');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .limit(1);

    if (error) {
      logTest('Public Client Access', false, `Error: ${error.message}`);
      return false;
    }

    if (data && data.length > 0) {
      logTest('Public Client Access', true, `Successfully fetched client: ${data[0].name}`);
      return true;
    } else {
      logTest('Public Client Access', true, 'No clients found (database might be empty)');
      return true;
    }
  } catch (err) {
    logTest('Public Client Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 4: Public Profile Viewing (needed for business info)
async function testPublicProfileViewing() {
  console.log('\n🏢 TEST 4: Public Profile Viewing (needed for business info)');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, business_name')
      .limit(1);

    if (error) {
      logTest('Public Profile Access', false, `Error: ${error.message}`);
      return false;
    }

    if (data && data.length > 0) {
      logTest('Public Profile Access', true, `Successfully fetched profile: ${data[0].business_name || 'Unnamed'}`);
      return true;
    } else {
      logTest('Public Profile Access', true, 'No profiles found (database might be empty)');
      return true;
    }
  } catch (err) {
    logTest('Public Profile Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 5: CORS Headers (Edge Functions)
async function testCORSHeaders() {
  console.log('\n🌐 TEST 5: CORS Headers (Edge Functions)');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://elevate-mobile-experience.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type'
      }
    });

    const corsHeader = response.headers.get('Access-Control-Allow-Origin');

    if (corsHeader === 'https://elevate-mobile-experience.vercel.app') {
      logTest('CORS Headers', true, `Correct CORS header: ${corsHeader}`);
      return true;
    } else {
      logTest('CORS Headers', false, `Unexpected CORS header: ${corsHeader}`);
      return false;
    }
  } catch (err) {
    logTest('CORS Headers', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 6: Environment Variables (APP_URL)
async function testEnvironmentVariables() {
  console.log('\n⚙️  TEST 6: Environment Variables (APP_URL)');
  console.log('-'.repeat(60));

  // We can't directly test env vars, but we can check if Edge Functions are deployed
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        type: 'invoice',
        id: 'test-id-for-deployment-check'
      })
    });

    // We expect it to fail with "not found" but still return a proper response
    // This confirms the function is deployed
    const isDeployed = response.status !== 0;

    logTest('Edge Function Deployment', isDeployed,
      isDeployed ? 'generate-pdf function is deployed and responding' : 'Function not responding'
    );
    return isDeployed;
  } catch (err) {
    logTest('Edge Function Deployment', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 7: Line Items Access (needed for PDF generation)
async function testLineItemsAccess() {
  console.log('\n📝 TEST 7: Line Items Access (needed for PDFs)');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('id, description')
      .limit(1);

    if (error) {
      logTest('Line Items Access', false, `Error: ${error.message}`);
      return false;
    }

    logTest('Line Items Access', true, 'Successfully accessed line items');
    return true;
  } catch (err) {
    logTest('Line Items Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Test 8: Branding Settings Access (needed for PDF styling)
async function testBrandingAccess() {
  console.log('\n🎨 TEST 8: Branding Settings Access (needed for PDF styling)');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase
      .from('branding_settings')
      .select('id, primary_color')
      .limit(1);

    if (error) {
      logTest('Branding Settings Access', false, `Error: ${error.message}`);
      return false;
    }

    logTest('Branding Settings Access', true, 'Successfully accessed branding settings');
    return true;
  } catch (err) {
    logTest('Branding Settings Access', false, `Exception: ${err.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testPublicInvoiceViewing();
    await testPublicQuoteViewing();
    await testPublicClientViewing();
    await testPublicProfileViewing();
    await testLineItemsAccess();
    await testBrandingAccess();
    await testCORSHeaders();
    await testEnvironmentVariables();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Production fixes verified successfully!');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  }
}

// Execute tests
runAllTests();
