/**
 * TradieMate - Test Actual Email & SMS Sending
 * This script sends a real email and SMS to verify the integrations work
 */

import https from 'https';

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8';
const TEST_EMAIL = 'yuanhuafung2021@gmail.com';
const TEST_PASSWORD = '90989098';

// Test recipient - must use Resend registered email in sandbox mode
const RECIPIENT_EMAIL = 'aethonautomation@gmail.com';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${options.token || SUPABASE_ANON_KEY}`,
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
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

async function login() {
  console.log('🔐 Logging in...');
  const response = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    body: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }
  });

  if (response.status === 200 && response.data.access_token) {
    console.log('✅ Login successful');
    return response.data.access_token;
  }
  throw new Error('Login failed');
}

async function getInvoiceForTesting(token) {
  console.log('📋 Getting invoice for testing...');
  const response = await makeRequest(
    `${SUPABASE_URL}/rest/v1/invoices?select=id,invoice_number,client:clients(name,email)&deleted_at=is.null&order=created_at.desc&limit=1`,
    { token }
  );

  if (response.status === 200 && response.data.length > 0) {
    console.log(`✅ Found invoice: ${response.data[0].invoice_number}`);
    return response.data[0];
  }
  throw new Error('No invoice found');
}

async function testEmailSending(token, invoice) {
  console.log('\n📧 TESTING EMAIL SENDING');
  console.log('='.repeat(50));
  console.log(`Sending invoice ${invoice.invoice_number} to ${RECIPIENT_EMAIL}...`);

  try {
    const response = await makeRequest(
      `${SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'POST',
        token,
        body: {
          type: 'email',
          recipientEmail: RECIPIENT_EMAIL,
          recipientName: 'Test User',
          documentType: 'invoice',
          documentId: invoice.id,
          message: 'This is a test email from TradieMate production testing.'
        }
      }
    );

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ EMAIL SENT SUCCESSFULLY!');
      console.log(`📧 Check ${RECIPIENT_EMAIL} for the invoice email`);
      return true;
    } else {
      console.log('❌ Email sending failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function testSMSSending(token, invoice) {
  console.log('\n📱 TESTING SMS SENDING');
  console.log('='.repeat(50));

  // Note: SMS requires a valid phone number
  // Using a test number - this may not actually deliver but tests the function
  const testPhone = '+61412345678'; // Australian format test number

  console.log(`Sending invoice ${invoice.invoice_number} via SMS to ${testPhone}...`);
  console.log('⚠️ Note: Using test number - actual SMS may not deliver');

  try {
    const response = await makeRequest(
      `${SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'POST',
        token,
        body: {
          type: 'sms',
          recipientPhone: testPhone,
          recipientName: 'Test User',
          documentType: 'invoice',
          documentId: invoice.id,
          message: 'TradieMate test SMS'
        }
      }
    );

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ SMS FUNCTION CALLED SUCCESSFULLY!');
      return true;
    } else {
      console.log('❌ SMS sending failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function testDirectEmailViaResend(token, invoice) {
  console.log('\n📧 TESTING DIRECT EMAIL VIA SEND-EMAIL FUNCTION');
  console.log('='.repeat(50));
  console.log(`Sending invoice ${invoice.invoice_number} to ${RECIPIENT_EMAIL}...`);

  try {
    const response = await makeRequest(
      `${SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'POST',
        token,
        body: {
          type: 'invoice',
          id: invoice.id,
          recipient_email: RECIPIENT_EMAIL,
          recipient_name: 'Test User',
          subject: `[TEST] Invoice ${invoice.invoice_number} from TradieMate`,
          message: 'This is a test email sent during production verification testing.'
        }
      }
    );

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ DIRECT EMAIL SENT SUCCESSFULLY!');
      console.log(`📧 Check ${RECIPIENT_EMAIL} for the invoice email`);
      return true;
    } else {
      console.log('❌ Direct email sending failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 TradieMate Email & SMS Integration Test');
  console.log('='.repeat(60));

  try {
    const token = await login();
    const invoice = await getInvoiceForTesting(token);

    // Test email via send-email function (direct Resend integration)
    const emailResult = await testDirectEmailViaResend(token, invoice);

    // Test via send-notification function
    // await testEmailSending(token, invoice);

    // Test SMS (optional - will use Twilio credits)
    // Uncomment to test SMS:
    // await testSMSSending(token, invoice);

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Email Test: ${emailResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\n💡 Please check your email inbox for the test invoice!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
