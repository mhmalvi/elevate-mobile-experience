/**
 * End-to-End Production Testing Script
 * Tests all critical features with real user credentials
 *
 * Run: node e2e-production-test.js
 */

import { chromium } from 'playwright';

const TEST_URL = 'https://elevate-mobile-experience.vercel.app';
const TEST_EMAIL = 'yuanhuafung2021@gmail.com';
const TEST_PASSWORD = '90989098';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message, screenshot = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${name}`);
  if (message) console.log(`   ${message}`);
  if (screenshot) console.log(`   Screenshot: ${screenshot}`);

  results.tests.push({ name, passed, message, screenshot });
  if (passed) results.passed++;
  else results.failed++;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 Starting End-to-End Production Tests');
  console.log('='.repeat(60));
  console.log(`Testing URL: ${TEST_URL}`);
  console.log(`Test User: ${TEST_EMAIL}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: './test-videos/' }
  });

  const page = await context.newPage();

  // Track console errors and network failures
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()?.errorText
    });
  });

  try {
    // Test 1: Navigate to site
    console.log('\n📋 TEST 1: Navigate to Production Site');
    console.log('-'.repeat(60));
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-results/01-homepage.png' });
    logTest('Navigate to Site', true, `Successfully loaded ${TEST_URL}`, 'test-results/01-homepage.png');

    // Test 2: Login
    console.log('\n📋 TEST 2: User Login');
    console.log('-'.repeat(60));
    try {
      // Wait for auth page to load
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });

      // Fill in credentials
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);

      await page.screenshot({ path: 'test-results/02-login-form.png' });

      // Click sign in button
      await page.click('button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Continue")');

      // Wait for dashboard
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await page.screenshot({ path: 'test-results/03-dashboard.png' });

      logTest('User Login', true, 'Successfully logged in and redirected to dashboard', 'test-results/03-dashboard.png');
    } catch (error) {
      await page.screenshot({ path: 'test-results/02-login-error.png' });
      logTest('User Login', false, `Login failed: ${error.message}`, 'test-results/02-login-error.png');
      throw error; // Can't continue without login
    }

    // Test 3: Navigate to Invoices
    console.log('\n📋 TEST 3: Navigate to Invoices');
    console.log('-'.repeat(60));
    try {
      // Wait for dashboard to finish loading
      await page.waitForLoadState('networkidle');
      await sleep(2000);

      // Try multiple ways to find invoices link
      const invoicesLink = await page.locator('a[href="/invoices"]').or(page.locator('text=Invoices')).first();
      await invoicesLink.click();
      await page.waitForURL('**/invoices', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await sleep(1000);
      await page.screenshot({ path: 'test-results/04-invoices-list.png' });
      logTest('Navigate to Invoices', true, 'Successfully navigated to invoices page', 'test-results/04-invoices-list.png');
    } catch (error) {
      await page.screenshot({ path: 'test-results/04-invoices-error.png' });
      logTest('Navigate to Invoices', false, `Failed to navigate: ${error.message}`, 'test-results/04-invoices-error.png');
    }

    // Test 4: Open first invoice (if exists)
    console.log('\n📋 TEST 4: Open Invoice Detail');
    console.log('-'.repeat(60));
    let invoiceId = null;
    try {
      // Wait for invoices to load
      await sleep(2000);

      // Look for invoice cards or links - try multiple selectors
      const invoiceCard = page.locator('div:has-text("Deck Build"), div:has-text("Door Installation")').first();

      if (await invoiceCard.isVisible()) {
        await invoiceCard.click();
        await page.waitForURL('**/invoices/**', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        await sleep(1000);

        // Extract invoice ID from URL
        const url = page.url();
        invoiceId = url.match(/\/invoices\/([^\/\?]+)/)?.[1];

        await page.screenshot({ path: 'test-results/05-invoice-detail.png' });
        logTest('Open Invoice Detail', true, `Successfully opened invoice: ${invoiceId}`, 'test-results/05-invoice-detail.png');
      } else {
        logTest('Open Invoice Detail', false, 'No clickable invoices found on the page');
      }
    } catch (error) {
      await page.screenshot({ path: 'test-results/05-invoice-error.png' });
      logTest('Open Invoice Detail', false, `Failed to open invoice: ${error.message}`, 'test-results/05-invoice-error.png');
    }

    // Test 5: PDF Preview & Download
    console.log('\n📋 TEST 5: PDF Generation & Download');
    console.log('-'.repeat(60));
    if (invoiceId) {
      try {
        // Look for Preview button
        const previewButton = page.locator('button:has-text("Preview")').first();

        if (await previewButton.isVisible()) {
          await previewButton.click();
          await sleep(1000);

          // Wait for PDF preview to load
          await page.waitForSelector('iframe[title*="Preview"], div:has-text("Preview")', { timeout: 5000 });
          await sleep(3000); // Wait for PDF HTML to render

          await page.screenshot({ path: 'test-results/06-pdf-preview.png' });

          // Check for "Download PDF" button
          const downloadButton = page.locator('button:has-text("Download PDF")');

          if (await downloadButton.isVisible()) {
            // Start waiting for download before clicking
            const downloadPromise = page.waitForEvent('download');
            await downloadButton.click();

            const download = await downloadPromise;
            const downloadPath = `test-results/downloaded-${download.suggestedFilename()}`;
            await download.saveAs(downloadPath);

            logTest('PDF Generation & Download', true, `PDF downloaded successfully: ${downloadPath}`, 'test-results/06-pdf-preview.png');
          } else {
            logTest('PDF Generation & Download', false, 'Download PDF button not found');
          }
        } else {
          logTest('PDF Generation & Download', false, 'Preview button not found on invoice detail page');
        }
      } catch (error) {
        await page.screenshot({ path: 'test-results/06-pdf-error.png' });
        logTest('PDF Generation & Download', false, `PDF generation failed: ${error.message}`, 'test-results/06-pdf-error.png');
      }
    } else {
      logTest('PDF Generation & Download', false, 'Skipped - No invoice to test');
    }

    // Test 6: SMS Notification
    console.log('\n📋 TEST 6: SMS Notification');
    console.log('-'.repeat(60));
    if (invoiceId) {
      try {
        // Look for SMS button
        const smsButton = page.locator('button:has-text("SMS")').first();

        if (await smsButton.isVisible()) {
          await smsButton.click();
          await sleep(1000);
          await page.screenshot({ path: 'test-results/07-sms-dialog.png' });

          // Check for phone input or SMS dialog
          const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone"]');

          if (await phoneInput.isVisible()) {
            // Fill in a test phone number (won't actually send)
            await phoneInput.fill('+61412345678');
            await page.screenshot({ path: 'test-results/08-sms-filled.png' });

            // Note: We won't actually click Send to avoid sending real SMS
            logTest('SMS Notification', true, 'SMS dialog opened successfully with phone input', 'test-results/07-sms-dialog.png');
          } else {
            logTest('SMS Notification', false, 'SMS dialog opened but no phone input found');
          }
        } else {
          logTest('SMS Notification', false, 'SMS button not found on invoice detail page');
        }
      } catch (error) {
        await page.screenshot({ path: 'test-results/07-sms-error.png' });
        logTest('SMS Notification', false, `SMS feature failed: ${error.message}`, 'test-results/07-sms-error.png');
      }
    } else {
      logTest('SMS Notification', false, 'Skipped - No invoice to test');
    }

    // Test 7: Shared Invoice Link (Public Access)
    console.log('\n📋 TEST 7: Shared Invoice Link (Public Access)');
    console.log('-'.repeat(60));
    if (invoiceId) {
      try {
        // Open in new incognito context (no auth)
        const incognitoContext = await browser.newContext({
          viewport: { width: 1280, height: 720 }
        });
        const incognitoPage = await incognitoContext.newPage();

        const publicUrl = `${TEST_URL}/i/${invoiceId}`;
        console.log(`   Testing public URL: ${publicUrl}`);

        await incognitoPage.goto(publicUrl, { waitUntil: 'networkidle' });
        await sleep(2000);
        await incognitoPage.screenshot({ path: 'test-results/09-public-invoice.png' });

        // Check if invoice is visible (not "Invoice Not Found")
        const notFoundText = await incognitoPage.locator('text="Invoice Not Found"').count();
        const invoiceContent = await incognitoPage.locator('text="Invoice", text="Total", text="Bill To"').count();

        if (notFoundText === 0 && invoiceContent > 0) {
          logTest('Shared Invoice Link', true, 'Public invoice link works without authentication', 'test-results/09-public-invoice.png');
        } else {
          logTest('Shared Invoice Link', false, 'Invoice not accessible or showing "Not Found"', 'test-results/09-public-invoice.png');
        }

        await incognitoContext.close();
      } catch (error) {
        logTest('Shared Invoice Link', false, `Shared link test failed: ${error.message}`);
      }
    } else {
      logTest('Shared Invoice Link', false, 'Skipped - No invoice to test');
    }

    // Test 8: Check for CORS Errors
    console.log('\n📋 TEST 8: CORS Errors Check');
    console.log('-'.repeat(60));
    const corsErrors = consoleErrors.filter(err =>
      err.includes('CORS') ||
      err.includes('Access-Control-Allow-Origin') ||
      err.includes('Cross-Origin')
    );

    if (corsErrors.length === 0) {
      logTest('CORS Errors Check', true, 'No CORS errors detected in console');
    } else {
      logTest('CORS Errors Check', false, `Found ${corsErrors.length} CORS errors: ${corsErrors.join(', ')}`);
    }

    // Test 9: Network Failures
    console.log('\n📋 TEST 9: Network Failures Check');
    console.log('-'.repeat(60));
    if (networkErrors.length === 0) {
      logTest('Network Failures Check', true, 'No network request failures detected');
    } else {
      const errorSummary = networkErrors.map(e => `${e.url}: ${e.failure}`).join('\n   ');
      logTest('Network Failures Check', false, `Found ${networkErrors.length} network failures:\n   ${errorSummary}`);
    }

    // Test 10: Console Errors
    console.log('\n📋 TEST 10: Console Errors Check');
    console.log('-'.repeat(60));
    if (consoleErrors.length === 0) {
      logTest('Console Errors Check', true, 'No console errors detected');
    } else {
      const nonCorsErrors = consoleErrors.filter(err =>
        !err.includes('CORS') &&
        !err.includes('Access-Control-Allow-Origin')
      );
      if (nonCorsErrors.length === 0) {
        logTest('Console Errors Check', true, 'No non-CORS console errors detected');
      } else {
        logTest('Console Errors Check', false, `Found ${nonCorsErrors.length} console errors (check browser console for details)`);
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error);
  } finally {
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! All critical features working correctly!');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
      console.log('\nFailed tests:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.message}`);
      });
    }

    console.log('\n📁 Screenshots saved to: test-results/');
    console.log('🎥 Video recording saved to: test-videos/');
    console.log('\n' + '='.repeat(60));

    await browser.close();

    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
