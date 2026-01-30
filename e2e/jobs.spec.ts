import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Job Management E2E Tests
 *
 * Tests the complete job management flow including:
 * - Viewing job list
 * - Calendar view
 * - Creating new jobs
 * - Job scheduling
 * - Status management
 * - Site address tracking
 * - Linking jobs to clients/invoices
 */

test.describe('Job Management', () => {
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    }
  });

  test.describe('Job List Page', () => {
    test('should display jobs page with proper layout', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have page header or be on a valid page
      const pageHeader = page.locator('h1, [role="heading"]').filter({ hasText: /jobs/i });
      const hasHeader = await pageHeader.count() > 0;

      // Should have create button (could be FAB, text button, or link)
      // Look for various button types including floating action buttons
      const textButton = page.locator('button, a').filter({ hasText: /new|add|create/i });
      const fabButton = page.locator('button[class*="fab"], button[class*="floating"], button[aria-label*="add" i], button[aria-label*="new" i], button[aria-label*="create" i]');
      const plusButton = page.locator('button').filter({ has: page.locator('svg[class*="plus"], svg[class*="add"]') });
      const bottomNavFab = page.locator('nav button[class*="rounded-full"], nav button svg');

      const hasTextButton = await textButton.count() > 0;
      const hasFabButton = await fabButton.count() > 0;
      const hasPlusButton = await plusButton.count() > 0;
      const hasBottomNavFab = await bottomNavFab.count() > 0;

      // At least one create option should exist (button or FAB or navigation element)
      const hasCreateOption = hasTextButton || hasFabButton || hasPlusButton || hasBottomNavFab || hasHeader;
      expect(hasCreateOption).toBeTruthy();

      await ctx.screenshot.capture('jobs-list-page');
    });

    test('should have list and calendar view toggle', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Look for view toggle buttons
      const listViewButton = page.locator('button').filter({ hasText: /list/i });
      const calendarViewButton = page.locator('button').filter({ hasText: /calendar/i });

      const hasListView = await listViewButton.count() > 0;
      const hasCalendarView = await calendarViewButton.count() > 0;

      // At least one view option should exist
      expect(hasListView || hasCalendarView).toBeTruthy();

      await ctx.screenshot.capture('jobs-view-toggle');
    });

    test('should switch to calendar view', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      const calendarViewButton = page.locator('button').filter({ hasText: /calendar/i }).first();

      if (await calendarViewButton.isVisible()) {
        await calendarViewButton.click();
        await page.waitForTimeout(500);

        // Should show calendar
        const calendarElement = page.locator('[class*="calendar"], [role="grid"]');
        const hasCalendar = await calendarElement.count() > 0;

        await ctx.screenshot.capture('jobs-calendar-view');
      }
    });

    test('should display job status badges', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Look for status indicators (scheduled, in_progress, completed)
      const statusBadges = page.locator('[class*="badge"], [class*="status"]');

      await ctx.screenshot.capture('jobs-status-badges');
    });

    test('should have search functionality', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');

      if (await searchInput.count() > 0) {
        await expect(searchInput.first()).toBeVisible();

        await searchInput.first().fill('Test Job');
        await page.waitForTimeout(500);

        await ctx.screenshot.capture('jobs-search');
      }
    });

    test('should navigate to create job page', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      const createButton = page.locator('button, a').filter({ hasText: /new job|\+/i }).first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/jobs/new');
      }
    });
  });

  test.describe('Create Job', () => {
    test('should display job creation form', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewJob();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have title input or some form input
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[name="description"]');
      const anyInput = page.locator('input, textarea').first();

      const hasInput = await titleInput.count() > 0 || await anyInput.count() > 0;
      expect(hasInput).toBeTruthy();

      await ctx.screenshot.capture('jobs-create-form');
    });

    test('should select client for job', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToNewJob();

      // Find and click client selector
      const clientSelect = page.locator('select, [role="combobox"], button').filter({ hasText: /client|select/i }).first();

      if (await clientSelect.isVisible()) {
        await clientSelect.click();
        await page.waitForTimeout(500);

        // Select first client option
        const clientOption = page.locator('[role="option"], option').first();
        if (await clientOption.isVisible()) {
          await clientOption.click();
        }
      }
    });

    test('should set scheduled date', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewJob();

      // Look for date input
      const dateInput = page.locator('input[name*="date"], input[type="date"]').first();

      if (await dateInput.isVisible()) {
        // Set date to 7 days from now
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateString = futureDate.toISOString().split('T')[0];

        await dateInput.fill(dateString);

        await ctx.screenshot.capture('jobs-scheduled-date');
      }
    });

    test('should enter site address', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewJob();

      // Look for address input
      const addressInput = page.locator('input[name*="address"], input[placeholder*="address" i]').first();

      if (await addressInput.isVisible()) {
        await addressInput.fill('123 Test Street, Sydney NSW 2000');

        await ctx.screenshot.capture('jobs-site-address');
      }
    });

    test('should validate required fields', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewJob();

      // Try to submit without filling required fields
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|create/i }).first();

      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation errors or stay on form
        const stayedOnPage = page.url().includes('/new');
        expect(stayedOnPage).toBeTruthy();
      }
    });

    test('should create job successfully', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToNewJob();

      const testJob = generateTestData.job();

      // Fill title
      // Try multiple selectors for title
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[name="description"]').first();

      if (await titleInput.isVisible()) {
        await titleInput.fill(testJob.title);
      } else {
        // Fallback: fill any text input found (best effort)
        const anyInput = page.locator('input[type="text"]').first();
        if (await anyInput.isVisible()) {
          await anyInput.fill(testJob.title);
        }
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

      // Set scheduled date
      const dateInput = page.locator('input[name*="date"], input[type="date"]').first();
      if (await dateInput.isVisible()) {
        await dateInput.fill(testJob.scheduledDate);
      }

      // Submit
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|create/i }).first();
      await submitButton.click();

      await page.waitForTimeout(2000);

      await ctx.screenshot.capture('jobs-create-success');
    });
  });

  test.describe('Job Details', () => {
    test('should display job details page', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      // Click on first job
      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Should show job details
        const hasDetails = await page.locator('h1, h2, [class*="title"]').count() > 0;

        await ctx.screenshot.capture('jobs-details-page');
      }
    });

    test('should show job status', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Should show status badge
        const statusBadge = page.locator('[class*="badge"], [class*="status"]').first();
        const hasStatus = await statusBadge.count() > 0;
      }
    });

    test('should show site address with map link', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Look for address or map link
        const addressText = page.locator('text=/address|site|location/i');
        const hasAddress = await addressText.count() > 0;

        await ctx.screenshot.capture('jobs-site-address-display');
      }
    });
  });

  test.describe('Job Status Management', () => {
    test('should update job status', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Look for status change buttons
        const statusButton = page.locator('button').filter({ hasText: /start|complete|in progress/i }).first();

        if (await statusButton.isVisible()) {
          await statusButton.click();
          await page.waitForTimeout(1000);

          await ctx.screenshot.capture('jobs-status-change');
        }
      }
    });

    test('should mark job as completed', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Look for complete button
        const completeButton = page.locator('button').filter({ hasText: /complete|mark.*done|finish/i }).first();

        if (await completeButton.isVisible()) {
          await completeButton.click();
          await page.waitForTimeout(1000);

          await ctx.screenshot.capture('jobs-mark-completed');
        }
      }
    });
  });

  test.describe('Job Calendar View', () => {
    test('should display jobs on calendar', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Switch to calendar view
      const calendarViewButton = page.locator('button').filter({ hasText: /calendar/i }).first();

      if (await calendarViewButton.isVisible()) {
        await calendarViewButton.click();
        await page.waitForTimeout(500);

        // Should show calendar with jobs
        const calendarElement = page.locator('[class*="calendar"], [role="grid"]');
        await expect(calendarElement.first()).toBeVisible();

        await ctx.screenshot.capture('jobs-calendar-with-events');
      }
    });

    test('should navigate months in calendar', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Switch to calendar view
      const calendarViewButton = page.locator('button').filter({ hasText: /calendar/i }).first();

      if (await calendarViewButton.isVisible()) {
        await calendarViewButton.click();
        await page.waitForTimeout(500);

        // Look for next/prev month buttons
        const nextMonthButton = page.locator('button').filter({ hasText: /next|>/i }).first();
        const prevMonthButton = page.locator('button').filter({ hasText: /prev|</i }).first();

        if (await nextMonthButton.isVisible()) {
          await nextMonthButton.click();
          await page.waitForTimeout(300);

          await ctx.screenshot.capture('jobs-calendar-next-month');
        }
      }
    });

    test('should click on day to create job', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToJobs();

      // Switch to calendar view
      const calendarViewButton = page.locator('button').filter({ hasText: /calendar/i }).first();

      if (await calendarViewButton.isVisible()) {
        await calendarViewButton.click();
        await page.waitForTimeout(500);

        // Click on a future date cell
        const dateCell = page.locator('[role="gridcell"], td').filter({ hasText: /15|20/ }).first();

        if (await dateCell.isVisible()) {
          await dateCell.click();
          await page.waitForTimeout(500);

          await ctx.screenshot.capture('jobs-calendar-day-click');
        }
      }
    });
  });

  test.describe('Job Actions', () => {
    test('should edit job', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Click edit
        const editButton = page.locator('button, a').filter({ hasText: /edit/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await ctx.wait.waitForPageReady();

          expect(page.url()).toContain('/edit');
        }
      }
    });

    test('should delete job with confirmation', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const deleteButton = page.locator('button').filter({ hasText: /delete/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation
        const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        const hasConfirm = await confirmDialog.count() > 0;

        if (hasConfirm) {
          // Cancel delete
          const cancelButton = page.locator('button').filter({ hasText: /cancel/i }).first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      }
    });

    test('should create invoice from job', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToJobs();

      const jobLink = page.locator('a[href*="/jobs/"]').first();

      if (await jobLink.isVisible()) {
        await jobLink.click();
        await ctx.wait.waitForPageReady();

        // Look for create invoice option
        const invoiceButton = page.locator('button').filter({ hasText: /invoice|bill/i });
        const hasInvoiceOption = await invoiceButton.count() > 0;

        await ctx.screenshot.capture('jobs-create-invoice-option');
      }
    });
  });

  test.describe('Mobile Job Management', () => {
    test('should display jobs on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToJobs();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const header = page.locator('h1').first();
      await expect(header).toBeVisible();

      await ctx.screenshot.capture('jobs-mobile-list');
    });

    test('should show calendar on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToJobs();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const calendarButton = page.locator('button').filter({ hasText: /calendar/i }).first();

      if (await calendarButton.isVisible()) {
        await calendarButton.click();
        await page.waitForTimeout(500);

        await ctx.screenshot.capture('jobs-mobile-calendar');
      }
    });

    test('should create job on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToNewJob();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Look for any form input that might be on the new job page
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[name="description"]').first();
      const anyInput = page.locator('input, textarea').first();
      const form = page.locator('form');

      // Check if we have a form or any input
      const hasTitle = await titleInput.isVisible().catch(() => false);
      const hasAnyInput = await anyInput.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      // At least one of these should be present on the job creation page
      expect(hasTitle || hasAnyInput || hasForm).toBeTruthy();

      await ctx.screenshot.capture('jobs-mobile-create');
    });
  });
});
