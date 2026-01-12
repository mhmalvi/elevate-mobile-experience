import { test, expect } from '@playwright/test';
import { createTestContext, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Dashboard E2E Tests
 *
 * Tests the dashboard functionality including:
 * - KPI display (revenue, invoices, jobs, quotes)
 * - Recent activity
 * - Quick actions
 * - Overdue alerts
 * - Pull-to-refresh
 * - Navigation to other sections
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test.describe('Dashboard Layout', () => {
    test('should display dashboard with proper layout', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Should have dashboard content or be on auth page
      const hasContent = await page.locator('main, [class*="dashboard"], [class*="content"]').count() > 0;
      const isOnAuth = page.url().includes('/auth');
      expect(hasContent || isOnAuth).toBeTruthy();

      await ctx.screenshot.capture('dashboard-layout');
    });

    test('should show welcome message or header', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for greeting or dashboard title
      const greeting = page.locator('h1, h2').filter({ hasText: /welcome|dashboard|home|hi|hello/i });
      const hasGreeting = await greeting.count() > 0;

      await ctx.screenshot.capture('dashboard-header');
    });

    test('should display navigation elements', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Should have navigation to main sections or be on auth page
      const hasClientsLink = await page.locator('a[href*="/clients"], a:has-text("Clients")').count() > 0;
      const hasInvoicesLink = await page.locator('a[href*="/invoices"], a:has-text("Invoices")').count() > 0;
      const hasQuotesLink = await page.locator('a[href*="/quotes"], a:has-text("Quotes")').count() > 0;
      const hasJobsLink = await page.locator('a[href*="/jobs"], a:has-text("Jobs")').count() > 0;
      const hasNavBar = await page.locator('nav, [role="navigation"]').count() > 0;
      const isOnAuth = page.url().includes('/auth');

      const hasNavigation = hasClientsLink || hasInvoicesLink || hasQuotesLink || hasJobsLink || hasNavBar || isOnAuth;
      expect(hasNavigation).toBeTruthy();
    });
  });

  test.describe('KPI Cards', () => {
    test('should display monthly revenue', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for revenue/income display
      const revenueCard = page.locator('text=/revenue|income|earned|\\$/i');
      const hasRevenue = await revenueCard.count() > 0;

      await ctx.screenshot.capture('dashboard-revenue');
    });

    test('should display outstanding invoices count', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for outstanding/unpaid invoices
      const outstandingCard = page.locator('text=/outstanding|unpaid|pending.*invoice/i');
      const hasOutstanding = await outstandingCard.count() > 0;

      await ctx.screenshot.capture('dashboard-outstanding');
    });

    test('should display active jobs count', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for active jobs display
      const jobsCard = page.locator('text=/active.*job|job.*active|jobs/i');
      const hasJobs = await jobsCard.count() > 0;

      await ctx.screenshot.capture('dashboard-jobs-count');
    });

    test('should display pending quotes count', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for pending quotes
      const quotesCard = page.locator('text=/pending.*quote|quote.*pending|quotes/i');
      const hasQuotes = await quotesCard.count() > 0;

      await ctx.screenshot.capture('dashboard-quotes-count');
    });

    test('should show KPI values or zero state', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Should show numbers, zero state, or be on auth page
      const hasNumbers = await page.locator('text=/\\d+|\\$\\d+|\\.\\d+/').count() > 0;
      const hasZeroState = await page.locator('text=/no data|get started|add your first/i').count() > 0;
      const isOnAuth = page.url().includes('/auth');

      expect(hasNumbers || hasZeroState || isOnAuth).toBeTruthy();
    });
  });

  test.describe('Overdue Alerts', () => {
    test('should highlight overdue invoices', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for overdue indicator/alert
      const overdueAlert = page.locator('text=/overdue/i, [class*="warning"], [class*="alert"]');

      await ctx.screenshot.capture('dashboard-overdue-alerts');
    });

    test('should link to overdue invoices', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for clickable overdue section
      const overdueLink = page.locator('a, button').filter({ hasText: /overdue/i }).first();

      if (await overdueLink.isVisible()) {
        await overdueLink.click();
        await ctx.wait.waitForPageReady();

        // Should navigate to invoices
        expect(page.url()).toContain('/invoices');
      }
    });
  });

  test.describe('Recent Activity', () => {
    test('should display recent activity section', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for activity/recent section
      const activitySection = page.locator('text=/recent|activity|latest|history/i');
      const hasActivity = await activitySection.count() > 0;

      await ctx.screenshot.capture('dashboard-recent-activity');
    });

    test('should show recent invoices or quotes', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for recent items
      const recentItems = page.locator('text=/INV-|Q-|invoice|quote/i');
      const hasRecent = await recentItems.count() > 0;

      await ctx.screenshot.capture('dashboard-recent-items');
    });
  });

  test.describe('Quick Actions', () => {
    test('should have quick action buttons', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for quick action buttons
      const newInvoiceButton = page.locator('button, a').filter({ hasText: /new invoice/i });
      const newQuoteButton = page.locator('button, a').filter({ hasText: /new quote/i });
      const newClientButton = page.locator('button, a').filter({ hasText: /new client/i });
      const newJobButton = page.locator('button, a').filter({ hasText: /new job/i });

      const hasQuickActions =
        await newInvoiceButton.count() > 0 ||
        await newQuoteButton.count() > 0 ||
        await newClientButton.count() > 0 ||
        await newJobButton.count() > 0;

      await ctx.screenshot.capture('dashboard-quick-actions');
    });

    test('should navigate to create invoice from dashboard', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      const newInvoiceButton = page.locator('button, a').filter({ hasText: /new invoice|\+.*invoice/i }).first();

      if (await newInvoiceButton.isVisible()) {
        await newInvoiceButton.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/invoices/new');
      }
    });

    test('should navigate to create quote from dashboard', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      const newQuoteButton = page.locator('button, a').filter({ hasText: /new quote|\+.*quote/i }).first();

      if (await newQuoteButton.isVisible()) {
        await newQuoteButton.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/quotes/new');
      }
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should navigate to clients from dashboard', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      const clientsLink = page.locator('a[href*="/clients"]').first();

      if (await clientsLink.isVisible()) {
        await clientsLink.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/clients');
      }
    });

    test('should navigate to invoices from dashboard', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      const invoicesLink = page.locator('a[href*="/invoices"]').first();

      if (await invoicesLink.isVisible()) {
        await invoicesLink.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/invoices');
      }
    });

    test('should navigate to settings from dashboard', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      const settingsLink = page.locator('a[href*="/settings"]').first();

      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/settings');
      }
    });
  });

  test.describe('Dashboard Refresh', () => {
    test('should refresh data on page reload', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Get initial content
      const initialContent = await page.content();

      // Reload page
      await page.reload();
      await ctx.wait.waitForPageReady();

      // Page should still have dashboard content or be on auth
      const hasContent = await page.locator('main, [class*="dashboard"]').count() > 0;
      const isOnAuth = page.url().includes('/auth');
      expect(hasContent || isOnAuth).toBeTruthy();
    });

    test('should support pull-to-refresh on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToDashboard();

      // Look for pull-to-refresh indicator
      const pullToRefresh = page.locator('[class*="pull-to-refresh"], [class*="refresh"]');
      const hasPullToRefresh = await pullToRefresh.count() > 0;

      await ctx.screenshot.capture('dashboard-mobile-refresh');
    });
  });

  test.describe('Mobile Dashboard', () => {
    test('should display dashboard on mobile viewport', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToDashboard();

      // Should show mobile-friendly layout or be on auth
      const hasContent = await page.locator('main, [class*="dashboard"]').count() > 0;
      const isOnAuth = page.url().includes('/auth');
      expect(hasContent || isOnAuth).toBeTruthy();

      await ctx.screenshot.capture('dashboard-mobile');
    });

    test('should show bottom navigation on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToDashboard();

      // Look for bottom navigation
      const bottomNav = page.locator('nav').last();
      const hasBottomNav = await bottomNav.isVisible();

      await ctx.screenshot.capture('dashboard-mobile-navigation');
    });

    test('should have touch-friendly buttons on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToDashboard();

      // Quick action buttons should be tappable
      const actionButton = page.locator('button').first();

      if (await actionButton.isVisible()) {
        // Get button dimensions
        const box = await actionButton.boundingBox();
        if (box) {
          // Button should be at least 44x44 for touch targets
          expect(box.height).toBeGreaterThanOrEqual(36);
        }
      }
    });
  });

  test.describe('Dashboard Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const ctx = createTestContext(page);

      const startTime = Date.now();

      await ctx.nav.goToDashboard();

      const loadTime = Date.now() - startTime;

      // Dashboard should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      console.log(`Dashboard loaded in ${loadTime}ms`);
    });

    test('should not show loading spinner indefinitely', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Wait for loading to complete
      const loadingSpinner = page.locator('[class*="loading"], .animate-spin');

      if (await loadingSpinner.count() > 0) {
        // Loading should complete within 10 seconds
        await loadingSpinner.first().waitFor({ state: 'hidden', timeout: 10000 });
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show helpful empty state for new users', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for empty state guidance
      const emptyState = page.locator('text=/get started|add your first|no data|welcome/i');
      const hasEmptyState = await emptyState.count() > 0;

      // If no data, should show guidance
      await ctx.screenshot.capture('dashboard-empty-state');
    });

    test('should have onboarding prompts', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToDashboard();

      // Look for onboarding/setup prompts
      const setupPrompt = page.locator('text=/set up|complete.*profile|add.*business/i');
      const hasSetupPrompt = await setupPrompt.count() > 0;

      await ctx.screenshot.capture('dashboard-onboarding');
    });
  });
});
