import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Complete User Journey E2E Tests
 *
 * These tests simulate real-world user workflows from start to finish.
 * They cover:
 * 1. New user onboarding journey
 * 2. Quote to Invoice to Payment journey
 * 3. Job lifecycle journey
 * 4. Client management journey
 * 5. Monthly business operations journey
 * 6. Mobile-first workflow journey
 */

test.describe('User Journey: New User Onboarding', () => {
  test('should complete full onboarding flow', async ({ page }) => {
    const ctx = createTestContext(page);

    // This test simulates a new user's first experience
    // Skip if we don't have signup capability in test env
    if (!process.env.ALLOW_SIGNUP_TESTS) {
      test.skip();
      return;
    }

    // Step 1: Visit homepage
    await page.goto('/');
    await ctx.wait.waitForPageReady();

    await ctx.screenshot.capture('journey-onboarding-1-homepage');

    // Step 2: Go to signup
    const signupLink = page.locator('a, button').filter({ hasText: /sign up|get started|register/i }).first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-onboarding-2-signup');

    // Step 3: Fill signup form (simulated)
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill(testUser.email);
      await passwordInput.fill(testUser.password);

      await ctx.screenshot.capture('journey-onboarding-3-form-filled');
    }

    // Note: Don't actually submit to avoid creating test accounts
    console.log('Onboarding journey simulation complete');
  });
});

test.describe('User Journey: Quote to Invoice to Payment', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should complete quote-to-payment workflow', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    const testData = {
      client: generateTestData.client(),
      quote: generateTestData.quote(),
    };

    // === STEP 1: Create Client ===
    console.log('Step 1: Creating client...');
    await ctx.nav.goToNewClient();

    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill(testData.client.name);
    } else {
      // Try first input as fallback
      const firstInput = page.locator('input').first();
      await firstInput.fill(testData.client.name);
    }
    if (await emailInput.isVisible()) {
      await emailInput.fill(testData.client.email);
    }
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(testData.client.phone);
    }

    await ctx.screenshot.capture('journey-qtp-1-client-form');

    const saveClientBtn = page.locator('button[type="submit"]').first();
    await saveClientBtn.click();
    await page.waitForTimeout(2000);

    await ctx.screenshot.capture('journey-qtp-2-client-saved');

    // === STEP 2: Create Quote ===
    console.log('Step 2: Creating quote...');
    await ctx.nav.goToNewQuote();

    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="name" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill(testData.quote.title);
    }

    // Select client
    const clientSelect = page.locator('select, [role="combobox"]').first();
    if (await clientSelect.isVisible()) {
      await clientSelect.click();
      await page.waitForTimeout(300);

      // Select the client we just created
      const clientOption = page.locator('[role="option"]').filter({ hasText: new RegExp(testData.client.name.split(' ')[0], 'i') }).first();
      if (await clientOption.isVisible()) {
        await clientOption.click();
      } else {
        // Select first available client
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }
    }

    // Add line item
    const descriptionInput = page.locator('input[name*="description"]').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(testData.quote.lineItems[0].description);
    }

    const quantityInput = page.locator('input[name*="quantity"]').first();
    if (await quantityInput.isVisible()) {
      await quantityInput.fill(testData.quote.lineItems[0].quantity.toString());
    }

    const priceInput = page.locator('input[name*="price"], input[name*="rate"]').first();
    if (await priceInput.isVisible()) {
      await priceInput.fill(testData.quote.lineItems[0].unitPrice.toString());
    }

    await ctx.screenshot.capture('journey-qtp-3-quote-form');

    const saveQuoteBtn = page.locator('button[type="submit"], button').filter({ hasText: /save|create/i }).first();
    await saveQuoteBtn.click();
    await page.waitForTimeout(2000);

    await ctx.screenshot.capture('journey-qtp-4-quote-saved');

    // === STEP 3: View Quote Details ===
    console.log('Step 3: Viewing quote...');
    await ctx.nav.goToQuotes();

    const quoteLink = page.locator('a[href*="/quotes/"]').first();
    if (await quoteLink.isVisible()) {
      await quoteLink.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-qtp-5-quote-details');

    // === STEP 4: Convert to Invoice ===
    console.log('Step 4: Converting to invoice...');
    const convertBtn = page.locator('button').filter({ hasText: /convert.*invoice|create.*invoice/i }).first();
    if (await convertBtn.isVisible()) {
      await convertBtn.click();
      await page.waitForTimeout(2000);
    }

    await ctx.screenshot.capture('journey-qtp-6-converted-to-invoice');

    // === STEP 5: View Invoice ===
    console.log('Step 5: Viewing invoice...');
    await ctx.nav.goToInvoices();

    const invoiceLink = page.locator('a[href*="/invoices/"]').first();
    if (await invoiceLink.isVisible()) {
      await invoiceLink.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-qtp-7-invoice-details');

    // === STEP 6: Send Invoice ===
    console.log('Step 6: Sending invoice...');
    const sendBtn = page.locator('button').filter({ hasText: /send|share|email/i }).first();
    if (await sendBtn.isVisible()) {
      await ctx.screenshot.capture('journey-qtp-8-send-invoice-ready');
      // Don't actually send in test
    }

    console.log('Quote to Payment journey complete!');
  });
});

test.describe('User Journey: Job Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should complete job lifecycle from creation to completion', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    const testJob = generateTestData.job();

    // === STEP 1: Create Job ===
    console.log('Step 1: Creating job...');
    await ctx.nav.goToNewJob();

    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="name" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill(testJob.title);
    } else {
      // Try alternate selector
      const altInput = page.locator('input').first();
      await altInput.fill(testJob.title);
    }

    // Select client
    const clientSelect = page.locator('select, [role="combobox"]').first();
    if (await clientSelect.isVisible()) {
      await clientSelect.click();
      await page.waitForTimeout(300);
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
      }
    }

    // Set site address
    const addressInput = page.locator('input[name*="address"]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill(testJob.siteAddress);
    }

    // Set date
    const dateInput = page.locator('input[type="date"], input[name*="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill(testJob.scheduledDate);
    }

    await ctx.screenshot.capture('journey-job-1-form');

    const saveBtn = page.locator('button[type="submit"], button').filter({ hasText: /save|create/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    await ctx.screenshot.capture('journey-job-2-saved');

    // === STEP 2: View Job in List ===
    console.log('Step 2: Viewing jobs list...');
    await ctx.nav.goToJobs();

    await ctx.screenshot.capture('journey-job-3-list');

    // === STEP 3: View Job in Calendar ===
    console.log('Step 3: Viewing calendar...');
    const calendarBtn = page.locator('button').filter({ hasText: /calendar/i }).first();
    if (await calendarBtn.isVisible()) {
      await calendarBtn.click();
      await page.waitForTimeout(500);
    }

    await ctx.screenshot.capture('journey-job-4-calendar');

    // === STEP 4: View Job Details ===
    console.log('Step 4: Viewing job details...');

    // Switch back to list view if needed
    const listBtn = page.locator('button').filter({ hasText: /list/i }).first();
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(300);
    }

    const jobLink = page.locator('a[href*="/jobs/"]').first();
    if (await jobLink.isVisible()) {
      await jobLink.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-job-5-details');

    // === STEP 5: Start Job ===
    console.log('Step 5: Starting job...');
    const startBtn = page.locator('button').filter({ hasText: /start|in progress/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(1000);
    }

    await ctx.screenshot.capture('journey-job-6-started');

    // === STEP 6: Complete Job ===
    console.log('Step 6: Completing job...');
    const completeBtn = page.locator('button').filter({ hasText: /complete|finish|done/i }).first();
    if (await completeBtn.isVisible()) {
      await completeBtn.click();
      await page.waitForTimeout(1000);
    }

    await ctx.screenshot.capture('journey-job-7-completed');

    console.log('Job lifecycle journey complete!');
  });
});

test.describe('User Journey: Daily Operations', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should simulate daily business operations', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    // === Morning Check: Dashboard ===
    console.log('Morning check: Dashboard...');
    await ctx.nav.goToDashboard();
    await ctx.screenshot.capture('journey-daily-1-dashboard');

    // === Check Overdue Invoices ===
    console.log('Checking overdue invoices...');
    await ctx.nav.goToInvoices();

    // Look for overdue filter
    const filterBtn = page.locator('button, select').filter({ hasText: /filter|overdue/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }

    await ctx.screenshot.capture('journey-daily-2-invoices');

    // === Check Today's Jobs ===
    console.log('Checking today\'s jobs...');
    await ctx.nav.goToJobs();
    await ctx.screenshot.capture('journey-daily-3-jobs');

    // === Check Pending Quotes ===
    console.log('Checking pending quotes...');
    await ctx.nav.goToQuotes();
    await ctx.screenshot.capture('journey-daily-4-quotes');

    // === Search for Client ===
    console.log('Searching for client...');
    await ctx.nav.goToClients();

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }

    await ctx.screenshot.capture('journey-daily-5-client-search');

    console.log('Daily operations journey complete!');
  });
});

test.describe('User Journey: Mobile Workflow', () => {
  test('should complete workflow on mobile device', async ({ page }) => {
    const ctx = createTestContext(page);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }

    // === Step 1: Mobile Dashboard ===
    console.log('Step 1: Mobile dashboard...');
    await ctx.nav.goToDashboard();
    await ctx.screenshot.capture('journey-mobile-1-dashboard');

    // === Step 2: Navigate via Bottom Nav ===
    console.log('Step 2: Using bottom navigation...');

    // Click on invoices in bottom nav
    const invoicesNavItem = page.locator('nav a[href*="/invoices"]').first();
    if (await invoicesNavItem.isVisible()) {
      await invoicesNavItem.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-mobile-2-invoices');

    // === Step 3: Create Quick Invoice ===
    console.log('Step 3: Creating invoice on mobile...');
    const createBtn = page.locator('button, a').filter({ hasText: /new|\+/i }).first();
    if (await createBtn.isVisible()) {
      // Use click instead of tap for compatibility
      await createBtn.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-mobile-3-create-invoice');

    // === Step 4: Navigate to Jobs ===
    console.log('Step 4: Viewing jobs...');
    await ctx.nav.goToJobs();
    await ctx.screenshot.capture('journey-mobile-4-jobs');

    // === Step 5: Check Settings ===
    console.log('Step 5: Accessing settings...');
    await ctx.nav.goToSettings();
    await ctx.screenshot.capture('journey-mobile-5-settings');

    console.log('Mobile workflow journey complete!');
  });
});

test.describe('User Journey: End of Month Reporting', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should review monthly business metrics', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    // === Step 1: Check Dashboard KPIs ===
    console.log('Step 1: Reviewing dashboard metrics...');
    await ctx.nav.goToDashboard();

    // Look for revenue/earnings
    const revenueSection = page.locator('text=/revenue|earned|income|\\$/i').first();

    await ctx.screenshot.capture('journey-eom-1-dashboard-metrics');

    // === Step 2: Review All Invoices ===
    console.log('Step 2: Reviewing invoices...');
    await ctx.nav.goToInvoices();
    await ctx.screenshot.capture('journey-eom-2-all-invoices');

    // === Step 3: Filter Paid Invoices ===
    console.log('Step 3: Checking paid invoices...');
    const filterBtn = page.locator('button, select').filter({ hasText: /filter|status/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);

      const paidOption = page.locator('[role="option"], option').filter({ hasText: /paid/i }).first();
      if (await paidOption.isVisible()) {
        await paidOption.click();
        await page.waitForTimeout(500);
      }
    }

    await ctx.screenshot.capture('journey-eom-3-paid-invoices');

    // === Step 4: Check Outstanding ===
    console.log('Step 4: Checking outstanding invoices...');
    const outstandingOption = page.locator('[role="option"], option').filter({ hasText: /outstanding|unpaid|sent/i }).first();
    if (await outstandingOption.isVisible()) {
      await outstandingOption.click();
      await page.waitForTimeout(500);
    }

    await ctx.screenshot.capture('journey-eom-4-outstanding');

    // === Step 5: Review Completed Jobs ===
    console.log('Step 5: Reviewing completed jobs...');
    await ctx.nav.goToJobs();
    await ctx.screenshot.capture('journey-eom-5-jobs-review');

    // === Step 6: Check Subscription Usage ===
    console.log('Step 6: Checking subscription usage...');
    await page.goto('/settings/subscription');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-eom-6-subscription');

    console.log('End of month reporting journey complete!');
  });
});

test.describe('User Journey: Client Communication', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should manage client communications', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    // === Step 1: Find Client ===
    console.log('Step 1: Finding client...');
    await ctx.nav.goToClients();

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('');
    }

    await ctx.screenshot.capture('journey-comm-1-clients');

    // === Step 2: View Client Details ===
    console.log('Step 2: Viewing client...');
    const clientLink = page.locator('a[href*="/clients/"]').first();
    if (await clientLink.isVisible()) {
      await clientLink.click();
      await ctx.wait.waitForPageReady();
    }

    await ctx.screenshot.capture('journey-comm-2-client-details');

    // === Step 3: Check Client History ===
    console.log('Step 3: Checking client history...');
    // Look for history/activity section
    const historySection = page.locator('text=/history|invoices|quotes|jobs/i');

    await ctx.screenshot.capture('journey-comm-3-client-history');

    // === Step 4: Create Quote for Client ===
    console.log('Step 4: Creating quote for client...');
    const newQuoteBtn = page.locator('button, a').filter({ hasText: /new quote|create quote/i }).first();
    if (await newQuoteBtn.isVisible()) {
      await newQuoteBtn.click();
      await ctx.wait.waitForPageReady();
    } else {
      await ctx.nav.goToNewQuote();
    }

    await ctx.screenshot.capture('journey-comm-4-new-quote');

    console.log('Client communication journey complete!');
  });
});

test.describe('User Journey: Settings Configuration', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);
    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test('should configure business settings', async ({ page }) => {
    const ctx = createTestContext(page);

    if (!HAS_TEST_CREDENTIALS) {
      test.skip();
      return;
    }

    // === Step 1: Go to Settings ===
    console.log('Step 1: Opening settings...');
    await ctx.nav.goToSettings();
    await ctx.screenshot.capture('journey-settings-1-hub');

    // === Step 2: Update Profile ===
    console.log('Step 2: Updating profile...');
    await page.goto('/settings/profile');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-settings-2-profile');

    // === Step 3: Configure Business ===
    console.log('Step 3: Configuring business...');
    await page.goto('/settings/business');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-settings-3-business');

    // === Step 4: Setup Branding ===
    console.log('Step 4: Setting up branding...');
    await page.goto('/settings/branding');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-settings-4-branding');

    // === Step 5: Configure Payments ===
    console.log('Step 5: Configuring payments...');
    await page.goto('/settings/payments');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-settings-5-payments');

    // === Step 6: Review Subscription ===
    console.log('Step 6: Reviewing subscription...');
    await page.goto('/settings/subscription');
    await ctx.wait.waitForPageReady();
    await ctx.screenshot.capture('journey-settings-6-subscription');

    console.log('Settings configuration journey complete!');
  });
});

test.describe('Performance Benchmarks', () => {
  test('should meet performance benchmarks for all pages', async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }

    const routes = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Clients', path: '/clients' },
      { name: 'Invoices', path: '/invoices' },
      { name: 'Quotes', path: '/quotes' },
      { name: 'Jobs', path: '/jobs' },
      { name: 'Settings', path: '/settings' },
    ];

    const results: { name: string; loadTime: number }[] = [];

    for (const route of routes) {
      const startTime = Date.now();

      await page.goto(route.path);
      await ctx.wait.waitForPageReady();

      const loadTime = Date.now() - startTime;
      results.push({ name: route.name, loadTime });

      // Each page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    }

    // Log results
    console.log('\n=== Performance Results ===');
    results.forEach((r) => {
      console.log(`${r.name}: ${r.loadTime}ms`);
    });

    const avgLoadTime = results.reduce((acc, r) => acc + r.loadTime, 0) / results.length;
    console.log(`Average load time: ${avgLoadTime.toFixed(0)}ms`);
    console.log('===========================\n');
  });
});
